import { verifyJwt, sanitizeUser } from '../services/authService.mjs';
import { getDb } from '../db/database.mjs';

/**
 * Trích xuất thông tin người dùng hiện tại từ Header Authorization: Bearer <token>
 */
export function authenticateRequest(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.url && req.url.includes('token=')) {
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      token = urlObj.searchParams.get('token') || '';
    } catch {
      token = '';
    }
  }

  if (!token) return null;
  const decoded = verifyJwt(token);
  if (!decoded || !decoded.userId) return null;

  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(decoded.userId);

  if (!user || user.status === 'LOCKED') return null;
  return sanitizeUser(user);
}

/**
 * Yêu cầu đăng nhập (Admin hoặc Student)
 */
export function requireAuth(req) {
  const user = authenticateRequest(req);
  if (!user) {
    const err = new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
    err.statusCode = 401;
    throw err;
  }
  return user;
}

/**
 * Yêu cầu quyền Giáo viên / Admin
 */
export function requireAdmin(req) {
  const user = requireAuth(req);
  if (user.role !== 'ADMIN') {
    const err = new Error('Bạn không có quyền truy cập chức năng Quản trị (chỉ dành cho Giáo viên/Admin).');
    err.statusCode = 403;
    throw err;
  }
  return user;
}

