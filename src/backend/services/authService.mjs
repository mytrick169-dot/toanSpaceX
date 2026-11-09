import crypto from 'node:crypto';
import { ENV } from '../config/env.mjs';
import { getDb } from '../db/database.mjs';

/**
 * Băm mật khẩu an toàn sử dụng thuật toán Scrypt (tương đương Argon2/Bcrypt về độ an toàn chống brute-force)
 * Định dạng: $scrypt$salt_hex$hash_hex
 */
export function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(plainPassword), salt, 64).toString('hex');
  return `$scrypt$${salt}$${derivedKey}`;
}

/**
 * Kiểm tra mật khẩu chống tấn công timing-attack
 */
export function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || !storedHash.startsWith('$scrypt$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const salt = parts[2];
  const hashHex = parts[3];
  const derivedKey = crypto.scryptSync(String(plainPassword), salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derivedKey.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derivedKey, storedBuf);
}

/**
 * Tạo JWT Token chuẩn RFC 7519 (HMAC-SHA256)
 */
export function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + ENV.JWT_EXPIRES_IN_HOURS * 3600;
  const fullPayload = { ...payload, iat: nowSec, exp: expSec };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const data = `${base64Header}.${base64Payload}`;
  const signature = crypto
    .createHmac('sha256', ENV.JWT_SECRET)
    .update(data)
    .digest('base64url');

  return `${data}.${signature}`;
}

/**
 * Xác thực và giải mã JWT Token
 */
export function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [base64Header, base64Payload, signature] = parts;
  const data = `${base64Header}.${base64Payload}`;
  const expectedSig = crypto
    .createHmac('sha256', ENV.JWT_SECRET)
    .update(data)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Đăng nhập bằng username & password
 */
export function loginUser(username, password) {
  const db = getDb();
  const cleanUsername = String(username || '').trim();
  const user = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE LOWER(u.username) = LOWER(?)
  `).get(cleanUsername);

  if (!user) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
  }

  if (user.status === 'LOCKED') {
    throw new Error('Tài khoản của bạn đã bị khóa bởi Giáo viên quản trị. Vui lòng liên hệ Giáo viên.');
  }

  const valid = verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
  }

  const token = signJwt({
    userId: user.id,
    username: user.username,
    role: user.role_name,
    fullName: user.full_name,
  });

  return {
    token,
    user: sanitizeUser(user),
  };
}

/**
 * Học sinh tự đăng ký tài khoản (chỉ cần Họ tên, Username, Mật khẩu, Lớp)
 */
export function registerStudent({ fullName, username, password, className, nickname }) {
  const db = getDb();
  const cleanUsername = String(username || '').trim();
  const cleanName = String(fullName || '').trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error('Username phải có ít nhất 3 ký tự.');
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
    throw new Error('Username chỉ được chứa chữ cái không dấu, chữ số và dấu gạch dưới.');
  }
  if (!cleanName) {
    throw new Error('Vui lòng nhập họ và tên học sinh.');
  }
  if (!password || String(password).length < 6) {
    throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
  if (existing) {
    throw new Error('Username này đã được sử dụng. Vui lòng chọn username khác.');
  }

  const passwordHash = hashPassword(password);
  const studentRole = db.prepare("SELECT id FROM roles WHERE name = 'STUDENT'").get();

  const info = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, nickname, class_name, role_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run(
    cleanUsername,
    passwordHash,
    cleanName,
    nickname ? String(nickname).trim() : cleanName,
    className ? String(className).trim() : '12A1',
    studentRole.id
  );

  const newUser = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(info.lastInsertRowid);

  const token = signJwt({
    userId: newUser.id,
    username: newUser.username,
    role: newUser.role_name,
    fullName: newUser.full_name,
  });

  return {
    token,
    user: sanitizeUser(newUser),
  };
}

/**
 * Loại bỏ tuyệt đối password_hash trước khi trả về phía client
 */
export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    nickname: user.nickname || user.full_name,
    className: user.class_name,
    role: user.role_name || (user.role_id === 1 ? 'ADMIN' : 'STUDENT'),
    status: user.status,
    streakDays: user.streak_days || 0,
    bestStreakDays: user.best_streak_days || 0,
    lastActiveDate: user.last_active_date,
    createdAt: user.created_at,
  };
}

