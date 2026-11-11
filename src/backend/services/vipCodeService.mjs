import crypto from 'node:crypto';
import { getDb } from '../db/database.mjs';
import { hashPassword } from './authService.mjs';

/**
 * KHO MÃ VIP KHÔI PHỤC MẬT KHẨU
 * - Giáo viên độc quyền nắm giữ & cấp mã VIP cho học sinh.
 * - Học sinh quên mật khẩu: nhập Username + Mã VIP hợp lệ -> luôn được phép tạo mật khẩu mới.
 * - Mã VIP dùng lại được nhiều lần (không hết hạn), Giáo viên có thể tạm khóa / đổi mã / xóa bất cứ lúc nào.
 */

export const DEFAULT_VIP_CODE_COUNT = 20;
const MAX_VIP_CODES = 200;

// Bảng chữ cái loại bỏ các ký tự dễ nhầm lẫn (0/O, 1/I/L) để học sinh nhập không bị sai
const VIP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Chống dò mã (brute-force): tối đa 10 lần nhập sai / 15 phút cho mỗi địa chỉ IP
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_FAILURES = 10;
const failedAttemptsByIp = new Map();

const GENERIC_INVALID_MESSAGE =
  'Tên đăng nhập hoặc Mã VIP không chính xác. Vui lòng kiểm tra lại hoặc liên hệ Giáo viên để được cấp mã.';

function randomSegment(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += VIP_ALPHABET[crypto.randomInt(0, VIP_ALPHABET.length)];
  }
  return out;
}

/**
 * Sinh 1 mã VIP ngẫu nhiên an toàn, định dạng: VIP-XXXX-XXXX
 */
export function generateVipCodeString() {
  return `VIP-${randomSegment(4)}-${randomSegment(4)}`;
}

/**
 * Chuẩn hóa mã học sinh nhập (bỏ khoảng trắng, dấu gạch, chữ thường -> chữ hoa)
 */
function normalizeVipInput(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^VIP/, '');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function insertUniqueVipCode(db, note = null) {
  const insert = db.prepare('INSERT INTO vip_codes (code, note) VALUES (?, ?)');
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateVipCodeString();
    const exists = db.prepare('SELECT id FROM vip_codes WHERE code = ?').get(code);
    if (!exists) {
      const info = insert.run(code, note);
      return { id: Number(info.lastInsertRowid), code };
    }
  }
  throw new Error('Không thể sinh mã VIP mới, vui lòng thử lại.');
}

/**
 * Đảm bảo kho mã VIP đã được khởi tạo (mặc định 20 mã) khi máy chủ khởi động
 */
export function ensureVipCodes(count = DEFAULT_VIP_CODE_COUNT) {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as c FROM vip_codes').get().c;
  if (existing > 0) return;
  for (let i = 0; i < count; i++) {
    insertUniqueVipCode(db, `Mã VIP số ${i + 1}`);
  }
}

export function listVipCodes() {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, code, note, is_active, use_count, last_used_at, last_used_username, created_at
       FROM vip_codes
       ORDER BY id ASC`
    )
    .all()
    .map((r) => ({ ...r, is_active: Boolean(r.is_active) }));
}

export function addVipCodes(count = 1) {
  const db = getDb();
  const n = Math.max(1, Math.min(50, Number(count) || 1));
  const total = db.prepare('SELECT COUNT(*) as c FROM vip_codes').get().c;
  if (total + n > MAX_VIP_CODES) {
    throw new Error(`Kho mã VIP tối đa ${MAX_VIP_CODES} mã.`);
  }
  const created = [];
  for (let i = 0; i < n; i++) {
    created.push(insertUniqueVipCode(db, `Mã VIP số ${total + i + 1}`));
  }
  return created;
}

/**
 * Đổi mã mới cho 1 mã VIP (dùng khi nghi ngờ mã đã bị lộ). Mã cũ lập tức hết hiệu lực.
 */
export function regenerateVipCode(id) {
  const db = getDb();
  const row = db.prepare('SELECT id FROM vip_codes WHERE id = ?').get(Number(id));
  if (!row) throw new Error('Không tìm thấy mã VIP.');
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateVipCodeString();
    const exists = db.prepare('SELECT id FROM vip_codes WHERE code = ?').get(code);
    if (!exists) {
      db.prepare(
        'UPDATE vip_codes SET code = ?, use_count = 0, last_used_at = NULL, last_used_username = NULL WHERE id = ?'
      ).run(code, row.id);
      return code;
    }
  }
  throw new Error('Không thể sinh mã VIP mới, vui lòng thử lại.');
}

export function updateVipCode(id, { isActive, note } = {}) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM vip_codes WHERE id = ?').get(Number(id));
  if (!row) throw new Error('Không tìm thấy mã VIP.');
  const newActive = isActive === undefined ? row.is_active : isActive ? 1 : 0;
  const newNote = note === undefined ? row.note : String(note || '').trim().slice(0, 120) || null;
  db.prepare('UPDATE vip_codes SET is_active = ?, note = ? WHERE id = ?').run(newActive, newNote, row.id);
}

export function deleteVipCode(id) {
  const db = getDb();
  db.prepare('DELETE FROM vip_codes WHERE id = ?').run(Number(id));
}

// ----------------------------------------------------------------------------
// LUỒNG HỌC SINH QUÊN MẬT KHẨU
// ----------------------------------------------------------------------------

function pruneAndCountFailures(ip) {
  const now = Date.now();
  const list = (failedAttemptsByIp.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  failedAttemptsByIp.set(ip, list);
  return list;
}

function assertNotRateLimited(ip) {
  const list = pruneAndCountFailures(ip);
  if (list.length >= RATE_LIMIT_MAX_FAILURES) {
    const waitMin = Math.ceil((RATE_LIMIT_WINDOW_MS - (Date.now() - list[0])) / 60000);
    const err = new Error(
      `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau khoảng ${waitMin} phút hoặc liên hệ Giáo viên.`
    );
    err.statusCode = 429;
    throw err;
  }
}

function recordFailure(ip) {
  const list = pruneAndCountFailures(ip);
  list.push(Date.now());
  failedAttemptsByIp.set(ip, list);
}

function invalidError() {
  const err = new Error(GENERIC_INVALID_MESSAGE);
  err.statusCode = 400;
  return err;
}

/**
 * Tìm tài khoản HỌC SINH theo Username (ưu tiên) hoặc Họ tên / Biệt danh (chỉ khi duy nhất)
 */
function findStudentForReset(identifier) {
  const db = getDb();
  const clean = String(identifier || '').trim();
  if (!clean) return null;

  const byUsername = db
    .prepare(
      `SELECT u.* FROM users u JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'STUDENT' AND LOWER(TRIM(u.username)) = LOWER(?)`
    )
    .get(clean);
  if (byUsername) return byUsername;

  const lower = clean.toLowerCase();
  const matches = db
    .prepare(`SELECT u.* FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'STUDENT'`)
    .all()
    .filter((u) =>
      [u.full_name, u.nickname].some((v) => String(v || '').trim().toLowerCase() === lower)
    );
  return matches.length === 1 ? matches[0] : null;
}

function findActiveVipCode(rawCode) {
  const db = getDb();
  const input = normalizeVipInput(rawCode);
  if (input.length < 6) return null;
  const rows = db.prepare('SELECT * FROM vip_codes WHERE is_active = 1').all();
  let matched = null;
  for (const row of rows) {
    // So sánh toàn bộ danh sách (không dừng sớm) để tránh lộ thông tin qua thời gian phản hồi
    if (safeEqual(normalizeVipInput(row.code), input)) matched = row;
  }
  return matched;
}

/**
 * Bước 1: Kiểm tra Username + Mã VIP. Hợp lệ -> cho phép hiện ô tạo mật khẩu mới.
 */
export function verifyVipCodeForStudent({ username, vipCode, ip = 'unknown' }) {
  assertNotRateLimited(ip);

  const student = findStudentForReset(username);
  const codeRow = findActiveVipCode(vipCode);

  if (!student || !codeRow) {
    recordFailure(ip);
    throw invalidError();
  }

  if (student.status === 'LOCKED') {
    const err = new Error('Tài khoản này đang bị Giáo viên khóa. Vui lòng liên hệ Giáo viên để được mở khóa.');
    err.statusCode = 403;
    throw err;
  }

  return { student, codeRow };
}

/**
 * Bước 2: Đặt mật khẩu mới cho học sinh sau khi xác thực lại Username + Mã VIP
 */
export function resetStudentPasswordWithVipCode({ username, vipCode, newPassword, confirmPassword, ip }) {
  const pwd = String(newPassword ?? '').trim();
  if (pwd.length < 6) {
    const err = new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
    err.statusCode = 400;
    throw err;
  }
  if (confirmPassword !== undefined && String(confirmPassword ?? '').trim() !== pwd) {
    const err = new Error('Mật khẩu nhập lại không khớp.');
    err.statusCode = 400;
    throw err;
  }

  const { student, codeRow } = verifyVipCodeForStudent({ username, vipCode, ip });
  const db = getDb();

  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hashPassword(pwd),
    student.id
  );
  db.prepare(
    "UPDATE vip_codes SET use_count = use_count + 1, last_used_at = datetime('now'), last_used_username = ? WHERE id = ?"
  ).run(student.username, codeRow.id);

  failedAttemptsByIp.delete(ip);
  return { username: student.username, fullName: student.full_name, password: pwd };
}

