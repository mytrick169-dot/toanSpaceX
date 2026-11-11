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
  if (input.length < 4) return null;
  const rows = db.prepare('SELECT * FROM vip_codes WHERE is_active = 1').all();
  let matched = null;
  for (const row of rows) {
    if (safeEqual(normalizeVipInput(row.code), input)) matched = row;
  }
  return matched;
}

/**
 * Bước 1: Kiểm tra Mã VIP và Username.
 * - Mã VIP đúng -> LUÔN LUÔN cho phép hiện ô tạo mật khẩu mới.
 * - Hỗ trợ cả trường hợp tài khoản đã có sẵn hoặc học sinh mới gõ username chưa đăng ký.
 */
export function verifyVipCodeForStudent({ username, vipCode }) {
  const cleanUsername = String(username || '').trim();
  if (!cleanUsername) {
    const err = new Error('Vui lòng nhập Tên đăng nhập (Username) của bạn.');
    err.statusCode = 400;
    throw err;
  }

  const codeRow = findActiveVipCode(vipCode);
  if (!codeRow) {
    const err = new Error(
      'Mã VIP không chính xác hoặc đã bị tạm khóa. Vui lòng kiểm tra lại mã hoặc liên hệ Giáo viên để được cấp mã VIP.'
    );
    err.statusCode = 400;
    throw err;
  }

  const student = findStudentForReset(cleanUsername);

  if (student && student.status === 'LOCKED') {
    const err = new Error(
      `Tài khoản @${student.username} đang bị Giáo viên tạm khóa. Vui lòng liên hệ Giáo viên để được mở khóa.`
    );
    err.statusCode = 403;
    throw err;
  }

  return {
    student,
    codeRow,
    username: student ? student.username : cleanUsername,
    fullName: student ? student.full_name : cleanUsername,
    isNewUser: !student,
  };
}

/**
 * Bước 2: Đặt mật khẩu mới cho học sinh sau khi xác thực Mã VIP
 * - Nếu học sinh đã có tài khoản: cập nhật mật khẩu mới.
 * - Nếu username chưa từng tồn tại: tự động tạo tài khoản học sinh mới với mật khẩu vừa đặt.
 */
export function resetStudentPasswordWithVipCode({ username, vipCode, newPassword, confirmPassword }) {
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

  const { student, codeRow, username: validUsername, fullName } = verifyVipCodeForStudent({ username, vipCode });
  const db = getDb();
  const passwordHash = hashPassword(pwd);

  if (student) {
    // Cập nhật mật khẩu cho học sinh đã tồn tại
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      passwordHash,
      student.id
    );
  } else {
    // Tự động tạo mới tài khoản học sinh bằng mã VIP
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, nickname, class_name, role_id, status)
      VALUES (?, ?, ?, ?, '12A1', 2, 'ACTIVE')
    `).run(validUsername, passwordHash, fullName, fullName);
  }

  // Cập nhật số lần dùng và ghi nhận username vừa sử dụng mã VIP
  db.prepare(
    "UPDATE vip_codes SET use_count = use_count + 1, last_used_at = datetime('now'), last_used_username = ? WHERE id = ?"
  ).run(validUsername, codeRow.id);

  return { username: validUsername, fullName, password: pwd };
}

