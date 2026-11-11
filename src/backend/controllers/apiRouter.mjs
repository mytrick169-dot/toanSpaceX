import { getDb } from '../db/database.mjs';
import { ENV, updateEnvVariables } from '../config/env.mjs';
import {
  loginUser,
  logoutUser,
  recordHeartbeat,
  registerStudent,
  hashPassword,
  verifyPassword,
  sanitizeUser,
} from '../services/authService.mjs';
import { requireAuth, requireAdmin, authenticateRequest } from '../middlewares/authMiddleware.mjs';
import {
  savePdfBuffer,
  replacePdfBuffer,
  readStorageFile,
  deleteStorageFile,
  saveFigureDataUrl,
} from '../services/storageService.mjs';
import {
  checkGeminiStatus,
  processPdfWithAiEngine,
  validateAndNormalizeExtractedJson,
} from '../services/geminiService.mjs';
import {
  createExamFromAiExtraction,
  insertQuestionsForExam,
  getExamFullDetailForAdmin,
  recalculateExamTotalPoints,
  startOrResumeExamAttempt,
  getActiveAttemptPayloadForStudent,
  saveStudentAnswerDraft,
  finalizeAndGradeAttempt,
  getAttemptResultDetail,
} from '../services/examService.mjs';
import {
  getStudentContributionGraph,
  getLeaderboardData,
  getVnDateString,
  rebuildLeaderboardTables,
} from '../services/activityAndLeaderboardService.mjs';
import {
  verifyVipCodeForStudent,
  resetStudentPasswordWithVipCode,
  listVipCodes,
  addVipCodes,
  regenerateVipCode,
  updateVipCode,
  deleteVipCode,
} from '../services/vipCodeService.mjs';

/**
 * Đọc JSON body từ HTTP Request (Hỗ trợ payload lớn lên tới 60MB cho upload PDF base64)
 */
async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    const maxBytes = 65 * 1024 * 1024; // 65MB
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error('Dung lượng dữ liệu tải lên vượt quá giới hạn cho phép (65MB).'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const str = Buffer.concat(chunks).toString('utf-8');
        resolve(str ? JSON.parse(str) : {});
      } catch {
        reject(new Error('Dữ liệu JSON gửi lên không hợp lệ.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * Lấy IP thực của client (hỗ trợ khi chạy sau proxy như Render / Cloudflare Tunnel)
 */
function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return String(cfIp).trim();
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Bộ định tuyến REST API chính của Space X Math Backend
 */
export async function handleApiRequest(req, res, urlObj) {
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();
  const db = getDb();

  try {
    // ========================================================================
    // 1. SERVE FILE PDF GỐC & HÌNH ẢNH CÂU HỎI (/api/storage/*)
    // ========================================================================
    const pdfViewMatch = pathname.match(/^\/api\/storage\/pdfs\/(\d+)\/(view|download)$/);
    if (pdfViewMatch && method === 'GET') {
      const pdfId = Number(pdfViewMatch[1]);
      const action = pdfViewMatch[2];
      const pdfDoc = db.prepare('SELECT * FROM pdf_documents WHERE id = ?').get(pdfId);
      if (!pdfDoc) {
        return sendJson(res, 404, { error: 'Không tìm thấy tài liệu PDF gốc.' });
      }
      const buf = readStorageFile(pdfDoc.file_path);
      if (!buf) {
        return sendJson(res, 404, { error: 'File PDF vật lý không tồn tại trên ổ đĩa.' });
      }
      const disposition =
        action === 'download'
          ? `attachment; filename="${encodeURIComponent(pdfDoc.file_name)}"`
          : `inline; filename="${encodeURIComponent(pdfDoc.file_name)}"`;
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': buf.length,
        'Content-Disposition': disposition,
      });
      return res.end(buf);
    }

    const figMatch = pathname.match(/^\/api\/storage\/figures\/([a-zA-Z0-9._-]+)$/);
    if (figMatch && method === 'GET') {
      const fileName = figMatch[1];
      const buf = readStorageFile(`figures/${fileName}`);
      if (!buf) {
        return sendJson(res, 404, { error: 'Không tìm thấy hình ảnh.' });
      }
      const ext = fileName.split('.').pop().toLowerCase();
      const mime =
        ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': buf.length,
        'Cache-Control': 'public, max-age=86400',
      });
      return res.end(buf);
    }

    // ========================================================================
    // 2. AUTHENTICATION & USER PROFILE (/api/auth/*)
    // ========================================================================
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await readJsonBody(req);
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const userAgent = req.headers['user-agent'] || '';
      let deviceType = 'Desktop';
      if (/android/i.test(userAgent)) deviceType = 'Android';
      else if (/iphone|ipad|ipod/i.test(userAgent)) deviceType = 'iOS';
      else if (/macintosh/i.test(userAgent)) deviceType = 'Mac';
      else if (/windows/i.test(userAgent)) deviceType = 'Windows PC';

      const result = loginUser(body.username, body.password, { ip, userAgent, deviceType });
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const auth = authenticateRequest(req);
      if (auth) {
        logoutUser(auth.id, {
          ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
        });
      }
      return sendJson(res, 200, { message: 'Đăng xuất thành công.' });
    }

    if (pathname === '/api/user/heartbeat' && method === 'POST') {
      const auth = authenticateRequest(req);
      if (auth) {
        recordHeartbeat(auth.id);
      }
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = registerStudent(body);
      return sendJson(res, 201, result);
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = requireAuth(req);
      return sendJson(res, 200, { user });
    }

    // Quên mật khẩu - Bước 1: Học sinh nhập Username + Mã VIP do Giáo viên cấp
    if (pathname === '/api/auth/forgot-password/verify' && method === 'POST') {
      const body = await readJsonBody(req);
      const resData = verifyVipCodeForStudent({
        username: body.username,
        vipCode: body.vipCode,
      });
      return sendJson(res, 200, {
        ok: true,
        username: resData.username,
        fullName: resData.fullName,
        isNewUser: resData.isNewUser,
        message: 'Mã VIP hợp lệ! Hãy tạo mật khẩu mới cho tài khoản của bạn.',
      });
    }

    // Quên mật khẩu - Bước 2: Tạo mật khẩu mới & đăng nhập luôn
    if (pathname === '/api/auth/forgot-password/reset' && method === 'POST') {
      const body = await readJsonBody(req);
      const reset = resetStudentPasswordWithVipCode({
        username: body.username,
        vipCode: body.vipCode,
        newPassword: body.newPassword,
        confirmPassword: body.confirmPassword,
      });
      const loginResult = loginUser(reset.username, reset.password);
      return sendJson(res, 200, {
        ...loginResult,
        message: `Đã tạo mật khẩu mới thành công cho tài khoản @${reset.username}!`,
      });
    }

    if (pathname === '/api/auth/password' && method === 'PUT') {
      const user = requireAuth(req);
      const body = await readJsonBody(req);
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      if (!verifyPassword(body.currentPassword, row.password_hash)) {
        return sendJson(res, 400, { error: 'Mật khẩu hiện tại không chính xác.' });
      }
      if (!body.newPassword || String(body.newPassword).length < 6) {
        return sendJson(res, 400, { error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      }
      const newHash = hashPassword(body.newPassword);
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
        newHash,
        user.id
      );
      return sendJson(res, 200, { message: 'Đổi mật khẩu thành công!' });
    }

    if (pathname === '/api/auth/profile' && method === 'PUT') {
      const user = requireAuth(req);
      const body = await readJsonBody(req);
      const fullName = body.fullName ? String(body.fullName).trim() : user.fullName;
      const nickname = body.nickname ? String(body.nickname).trim() : user.nickname;
      const className = body.className ? String(body.className).trim() : user.className;
      db.prepare(`
        UPDATE users
        SET full_name = ?, nickname = ?, class_name = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(fullName, nickname, className, user.id);
      const updated = db
        .prepare('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?')
        .get(user.id);
      return sendJson(res, 200, { user: sanitizeUser(updated), message: 'Cập nhật hồ sơ thành công!' });
    }

    // ========================================================================
    // 3. CURRICULUM HIERARCHY (/api/curriculum)
    // ========================================================================
    if (pathname === '/api/curriculum' && method === 'GET') {
      const subjects = db.prepare('SELECT * FROM subjects ORDER BY order_index ASC, id ASC').all();
      const chapters = db.prepare('SELECT * FROM chapters ORDER BY order_index ASC, id ASC').all();
      const lessons = db.prepare('SELECT * FROM lessons ORDER BY order_index ASC, id ASC').all();
      const examCounts = db
        .prepare(
          `SELECT lesson_id, chapter_id, exam_type, COUNT(*) as count
           FROM exams
           WHERE status = 'PUBLISHED'
           GROUP BY lesson_id, chapter_id, exam_type`
        )
        .all();

      const tree = subjects.map((s) => {
        const subChapters = chapters
          .filter((c) => c.subject_id === s.id)
          .map((c) => {
            const chLessons = lessons
              .filter((l) => l.chapter_id === c.id)
              .map((l) => {
                const practiceCount = examCounts
                  .filter((ec) => ec.lesson_id === l.id && ec.exam_type === 'PRACTICE')
                  .reduce((a, b) => a + b.count, 0);
                const testCount = examCounts
                  .filter((ec) => ec.lesson_id === l.id && ec.exam_type === 'EXAM')
                  .reduce((a, b) => a + b.count, 0);
                return {
                  ...l,
                  practiceCount,
                  examCount: testCount,
                  totalSets: practiceCount + testCount,
                };
              });
            return {

              ...c,
              lessons: chLessons,
            };
          });
        return {
          ...s,
          chapters: subChapters,
        };
      });

      return sendJson(res, 200, { subjects: tree, rawSubjects: subjects, rawChapters: chapters, rawLessons: lessons });
    }

    // ========================================================================
    // 4. ADMIN DASHBOARD & STATISTICS (/api/admin/dashboard & /api/admin/statistics)
    // ========================================================================
    if (pathname === '/api/admin/dashboard' && method === 'GET') {
      requireAdmin(req);
      const todayStr = getVnDateString();

      const totalStudents = db
        .prepare("SELECT COUNT(*) as c FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'STUDENT'")
        .get().c;
      const activeStudents = db
        .prepare(
          "SELECT COUNT(*) as c FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'STUDENT' AND u.status = 'ACTIVE'"
        )
        .get().c;
      const totalPracticeSets = db
        .prepare("SELECT COUNT(*) as c FROM exams WHERE exam_type = 'PRACTICE'")
        .get().c;
      const totalExams = db
        .prepare("SELECT COUNT(*) as c FROM exams WHERE exam_type = 'EXAM'")
        .get().c;
      const totalSubmissions = db
        .prepare("SELECT COUNT(*) as c FROM exam_attempts WHERE status IN ('SUBMITTED', 'AUTO_SUBMITTED')")
        .get().c;
      const todaySubmissions = db
        .prepare(
          "SELECT COUNT(*) as c FROM exam_attempts WHERE status IN ('SUBMITTED', 'AUTO_SUBMITTED') AND substr(submitted_at, 1, 10) = ?"
        )
        .get(todayStr).c;

      // Biểu đồ hoạt động 14 ngày gần nhất
      const activityByDay = [];
      const endMs = new Date(`${todayStr}T00:00:00Z`).getTime();
      for (let i = 13; i >= 0; i--) {
        const dKey = new Date(endMs - i * 86400 * 1000).toISOString().slice(0, 10);
        const row = db
          .prepare(
            `SELECT COALESCE(SUM(submission_count), 0) as submissions,
                    COUNT(DISTINCT user_id) as active_users
             FROM learning_activities
             WHERE activity_date = ?`
          )
          .get(dKey);
        activityByDay.push({
          date: dKey,
          label: `${dKey.slice(8, 10)}/${dKey.slice(5, 7)}`,
          submissions: row.submissions,
          activeUsers: row.active_users,
        });
      }

      // Danh sách học sinh có điểm cao nhất
      const topStudents = db
        .prepare(
          `SELECT u.id, u.full_name, u.username, u.class_name, u.streak_days,
                  COUNT(ea.id) as submission_count,
                  COALESCE(ROUND(AVG(ea.total_score), 2), 0) as average_score,
                  COALESCE(ROUND(MAX(ea.total_score), 2), 0) as highest_score,
                  COALESCE(ROUND(SUM(ea.total_score), 2), 0) as total_score
           FROM users u
           JOIN roles r ON u.role_id = r.id
           JOIN exam_attempts ea ON ea.user_id = u.id AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
           WHERE r.name = 'STUDENT'
           GROUP BY u.id
           ORDER BY highest_score DESC, average_score DESC, total_score DESC
           LIMIT 6`
        )
        .all();

      // Những bài tập/đề thi được học sinh làm nhiều nhất
      const mostPopularExams = db
        .prepare(
          `SELECT e.id, e.title, e.exam_type, e.status,
                  c.name as chapter_name, l.name as lesson_name,
                  COUNT(ea.id) as attempt_count,
                  COALESCE(ROUND(AVG(ea.total_score), 2), 0) as average_score
           FROM exams e
           LEFT JOIN chapters c ON e.chapter_id = c.id
           LEFT JOIN lessons l ON e.lesson_id = l.id
           LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
           GROUP BY e.id
           ORDER BY attempt_count DESC, e.id DESC
           LIMIT 6`
        )
        .all();

      const needsReviewExamsCount = db
        .prepare('SELECT COUNT(DISTINCT exam_id) as c FROM questions WHERE needs_review = 1')
        .get().c;

      return sendJson(res, 200, {
        metrics: {
          totalStudents,
          activeStudents,
          totalPracticeSets,
          totalExams,
          totalSubmissions,
          todaySubmissions,
          needsReviewExamsCount,
        },
        activityChart: activityByDay,
        topStudents,
        mostPopularExams,
      });
    }

    if (pathname === '/api/admin/statistics' && method === 'GET') {
      requireAdmin(req);
      // Phổ điểm toàn hệ thống
      const allScores = db
        .prepare("SELECT total_score FROM exam_attempts WHERE status IN ('SUBMITTED', 'AUTO_SUBMITTED')")
        .all()
        .map((r) => Number(r.total_score));

      const distribution = [
        { range: '0 - 4.0 (Yếu)', count: allScores.filter((s) => s < 4).length },
        { range: '4.0 - 6.5 (Trung bình)', count: allScores.filter((s) => s >= 4 && s < 6.5).length },
        { range: '6.5 - 8.0 (Khá)', count: allScores.filter((s) => s >= 6.5 && s < 8).length },
        { range: '8.0 - 9.0 (Giỏi)', count: allScores.filter((s) => s >= 8 && s < 9).length },
        { range: '9.0 - 10.0 (Xuất sắc)', count: allScores.filter((s) => s >= 9).length },
      ];

      // Thống kê theo từng Đề thi
      const examStats = db
        .prepare(
          `SELECT e.id, e.title, e.exam_type, e.status,
                  c.name as chapter_name,
                  (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count,
                  COUNT(ea.id) as submission_count,
                  COALESCE(ROUND(AVG(ea.total_score), 2), 0) as avg_score,
                  COALESCE(ROUND(MAX(ea.total_score), 2), 0) as max_score,
                  COALESCE(ROUND(MIN(ea.total_score), 2), 0) as min_score
           FROM exams e
           LEFT JOIN chapters c ON e.chapter_id = c.id
           LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
           GROUP BY e.id
           ORDER BY submission_count DESC`
        )
        .all();

      // Thống kê theo từng Chương
      const chapterStats = db
        .prepare(
          `SELECT c.id, c.name, s.name as subject_name,
                  COUNT(DISTINCT e.id) as exam_count,
                  COUNT(ea.id) as submission_count,
                  COALESCE(ROUND(AVG(ea.total_score), 2), 0) as avg_score
           FROM chapters c
           JOIN subjects s ON c.subject_id = s.id
           LEFT JOIN exams e ON e.chapter_id = c.id
           LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
           GROUP BY c.id
           ORDER BY c.order_index ASC`
        )
        .all();

      return sendJson(res, 200, {
        scoreDistribution: distribution,
        examStats,
        chapterStats,
      });
    }

    // ========================================================================
    // 5. QUẢN LÝ HỌC SINH (/api/admin/students/*)
    // ========================================================================
    if (pathname === '/api/admin/students' && method === 'GET') {
      requireAdmin(req);
      const search = (urlObj.searchParams.get('search') || '').trim().toLowerCase();
      const statusFilter = urlObj.searchParams.get('status') || '';

      let rows = db
        .prepare(
          `SELECT u.id, u.username, u.full_name, u.nickname, u.class_name, u.status,
                  u.plain_password, u.last_login_at, u.last_logout_at, u.last_seen_at,
                  u.total_online_seconds, u.streak_days, u.best_streak_days, u.last_active_date, u.created_at,
                  COUNT(ea.id) as submission_count,
                  COUNT(DISTINCT ea.exam_id) as completed_exams_count,
                  COALESCE(ROUND(AVG(ea.total_score), 2), 0) as average_score,
                  COALESCE(ROUND(MAX(ea.total_score), 2), 0) as highest_score
           FROM users u
           JOIN roles r ON u.role_id = r.id
           LEFT JOIN exam_attempts ea ON ea.user_id = u.id AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
           WHERE r.name = 'STUDENT'
           GROUP BY u.id
           ORDER BY u.id DESC`
        )
        .all();

      const now = Date.now();
      const today = new Date().toISOString().slice(0, 10);

      const enrichedStudents = rows.map((s) => {
        const lastSeenMs = s.last_seen_at ? new Date(s.last_seen_at).getTime() : 0;
        const isOnline = lastSeenMs > 0 && now - lastSeenMs < 4 * 60 * 1000;

        const actRow = db
          .prepare('SELECT online_seconds_today FROM learning_activities WHERE user_id = ? AND activity_date = ?')
          .get(s.id, today);
        const todayOnlineSeconds = actRow?.online_seconds_today || 0;

        return {
          ...s,
          isOnline,
          todayOnlineMinutes: Math.round(todayOnlineSeconds / 60),
          totalOnlineMinutes: Math.round((s.total_online_seconds || 0) / 60),
        };
      });

      let finalStudents = enrichedStudents;
      if (search) {
        finalStudents = finalStudents.filter(
          (r) =>
            r.full_name.toLowerCase().includes(search) ||
            r.username.toLowerCase().includes(search) ||
            (r.class_name || '').toLowerCase().includes(search)
        );
      }
      if (statusFilter) {
        finalStudents = finalStudents.filter((r) => r.status === statusFilter);
      }

      return sendJson(res, 200, { students: finalStudents });
    }

    if (pathname === '/api/admin/students' && method === 'POST') {
      requireAdmin(req);
      const body = await readJsonBody(req);
      const created = registerStudent({
        fullName: body.fullName,
        username: body.username,
        password: body.password,
        className: body.className || '12A1',
        nickname: body.nickname || body.fullName,
      });
      return sendJson(res, 201, {
        student: created.user,
        message: `Đã tạo tài khoản học sinh "${created.user.fullName}" (@${created.user.username}) thành công!`,
      });
    }

    const adminStudentDetailMatch = pathname.match(/^\/api\/admin\/students\/(\d+)$/);
    if (adminStudentDetailMatch) {
      requireAdmin(req);
      const studentId = Number(adminStudentDetailMatch[1]);

      if (method === 'GET') {
        const student = db
          .prepare(
            `SELECT u.id, u.username, u.full_name, u.nickname, u.class_name, u.status,
                    u.plain_password, u.last_login_at, u.last_logout_at, u.last_seen_at,
                    u.total_online_seconds, u.streak_days, u.best_streak_days, u.last_active_date, u.created_at
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = ? AND r.name = 'STUDENT'`
          )
          .get(studentId);
        if (!student) return sendJson(res, 404, { error: 'Không tìm thấy học sinh.' });

        const attempts = db
          .prepare(
            `SELECT ea.*, e.title as exam_title, e.exam_type, c.name as chapter_name
             FROM exam_attempts ea
             JOIN exams e ON ea.exam_id = e.id
             LEFT JOIN chapters c ON e.chapter_id = c.id
             WHERE ea.user_id = ?
             ORDER BY ea.id DESC`
          )
          .all(studentId);

        const loginLogs = db
          .prepare(`SELECT * FROM user_login_logs WHERE user_id = ? ORDER BY id DESC LIMIT 50`)
          .all(studentId);

        const activityLogs = db
          .prepare(`SELECT * FROM student_activity_logs WHERE user_id = ? ORDER BY id DESC LIMIT 50`)
          .all(studentId);

        const dailyStats = db
          .prepare(
            `SELECT activity_date, submission_count, completed_exams_count, total_score_earned,
                    ROUND(COALESCE(online_seconds_today, 0) / 60, 1) as online_minutes
             FROM learning_activities
             WHERE user_id = ?
             ORDER BY activity_date DESC LIMIT 14`
          )
          .all(studentId);

        const contributionGraph = getStudentContributionGraph(studentId);
        return sendJson(res, 200, {
          student,
          attempts,
          loginLogs,
          activityLogs,
          dailyStats,
          contributionGraph,
        });
      }

      if (method === 'PUT') {
        const body = await readJsonBody(req);
        const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(studentId);
        if (!existing) return sendJson(res, 404, { error: 'Không tìm thấy học sinh.' });

        const newFullName = body.fullName ? String(body.fullName).trim() : existing.full_name;
        const newClassName = body.className ? String(body.className).trim() : existing.class_name;
        const newStatus = body.status && ['ACTIVE', 'LOCKED'].includes(body.status) ? body.status : existing.status;

        db.prepare(`
          UPDATE users
          SET full_name = ?, class_name = ?, status = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(newFullName, newClassName, newStatus, studentId);

        rebuildLeaderboardTables();
        return sendJson(res, 200, {
          message: `Đã cập nhật tài khoản học sinh "${newFullName}" (Trạng thái: ${newStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'
            }).`,
        });
      }

      if (method === 'DELETE') {
        db.prepare('DELETE FROM users WHERE id = ? AND role_id = 2').run(studentId);
        rebuildLeaderboardTables();
        return sendJson(res, 200, { message: 'Đã xóa tài khoản học sinh thành công.' });
      }
    }

    const resetPwdMatch = pathname.match(/^\/api\/admin\/students\/(\d+)\/reset-password$/);
    if (resetPwdMatch && method === 'POST') {
      requireAdmin(req);
      const studentId = Number(resetPwdMatch[1]);
      const body = await readJsonBody(req);
      const newPassword = String(body.newPassword || '').trim();
      if (newPassword.length < 6) {
        return sendJson(res, 400, { error: 'Mật khẩu mới cấp cho học sinh phải có ít nhất 6 ký tự.' });
      }
      const hashed = hashPassword(newPassword);
      db.prepare("UPDATE users SET password_hash = ?, plain_password = ?, updated_at = datetime('now') WHERE id = ? AND role_id = 2").run(
        hashed,
        newPassword,
        studentId
      );
      return sendJson(res, 200, {
        message: 'Đã đặt lại mật khẩu tạm thời cho học sinh thành công!',
      });
    }

    // ------------------------------------------------------------------------
    // KHO MÃ VIP KHÔI PHỤC MẬT KHẨU (/api/admin/vip-codes) - chỉ Giáo viên
    // ------------------------------------------------------------------------
    if (pathname === '/api/admin/vip-codes' && method === 'GET') {
      requireAdmin(req);
      return sendJson(res, 200, { codes: listVipCodes() });
    }

    if (pathname === '/api/admin/vip-codes' && method === 'POST') {
      requireAdmin(req);
      const body = await readJsonBody(req);
      const created = addVipCodes(body.count || 1);
      return sendJson(res, 201, {
        created,
        codes: listVipCodes(),
        message: `Đã thêm ${created.length} mã VIP mới vào kho.`,
      });
    }

    const vipRegenMatch = pathname.match(/^\/api\/admin\/vip-codes\/(\d+)\/regenerate$/);
    if (vipRegenMatch && method === 'POST') {
      requireAdmin(req);
      const newCode = regenerateVipCode(Number(vipRegenMatch[1]));
      return sendJson(res, 200, {
        code: newCode,
        codes: listVipCodes(),
        message: `Đã đổi sang mã mới ${newCode}. Mã cũ đã hết hiệu lực.`,
      });
    }

    const vipIdMatch = pathname.match(/^\/api\/admin\/vip-codes\/(\d+)$/);
    if (vipIdMatch && (method === 'PUT' || method === 'DELETE')) {
      requireAdmin(req);
      const vipId = Number(vipIdMatch[1]);
      if (method === 'PUT') {
        const body = await readJsonBody(req);
        updateVipCode(vipId, { isActive: body.isActive, note: body.note });
        return sendJson(res, 200, { codes: listVipCodes(), message: 'Đã cập nhật mã VIP.' });
      }
      deleteVipCode(vipId);
      return sendJson(res, 200, { codes: listVipCodes(), message: 'Đã xóa mã VIP khỏi kho.' });
    }

    // ========================================================================
    // 6. QUẢN LÝ CHƯƠNG & BÀI HỌC (/api/admin/subjects, chapters, lessons)
    // ========================================================================
    if (pathname === '/api/admin/subjects' && method === 'POST') {
      requireAdmin(req);
      const b = await readJsonBody(req);
      const info = db
        .prepare('INSERT INTO subjects (name, grade, description, order_index) VALUES (?, ?, ?, ?)')
        .run(b.name, Number(b.grade || 12), b.description || '', Number(b.orderIndex || 1));
      return sendJson(res, 201, { id: Number(info.lastInsertRowid), message: 'Đã tạo môn học mới.' });
    }

    if (pathname === '/api/admin/chapters' && method === 'POST') {
      requireAdmin(req);
      const b = await readJsonBody(req);
      const info = db
        .prepare('INSERT INTO chapters (subject_id, name, description, order_index) VALUES (?, ?, ?, ?)')
        .run(Number(b.subjectId), b.name, b.description || '', Number(b.orderIndex || 1));
      return sendJson(res, 201, { id: Number(info.lastInsertRowid), message: 'Đã thêm chương học mới.' });
    }

    const chapterIdMatch = pathname.match(/^\/api\/admin\/chapters\/(\d+)$/);
    if (chapterIdMatch) {
      requireAdmin(req);
      const chId = Number(chapterIdMatch[1]);
      if (method === 'PUT') {
        const b = await readJsonBody(req);
        db.prepare('UPDATE chapters SET name = ?, description = ?, order_index = ? WHERE id = ?').run(
          b.name,
          b.description || '',
          Number(b.orderIndex || 1),
          chId
        );
        return sendJson(res, 200, { message: 'Đã cập nhật chương học.' });
      }
      if (method === 'DELETE') {
        db.prepare('DELETE FROM chapters WHERE id = ?').run(chId);
        return sendJson(res, 200, { message: 'Đã xóa chương học.' });
      }
    }

    if (pathname === '/api/admin/lessons' && method === 'POST') {
      requireAdmin(req);
      const b = await readJsonBody(req);
      const info = db
        .prepare('INSERT INTO lessons (chapter_id, name, description, order_index) VALUES (?, ?, ?, ?)')
        .run(Number(b.chapterId), b.name, b.description || '', Number(b.orderIndex || 1));
      return sendJson(res, 201, { id: Number(info.lastInsertRowid), message: 'Đã thêm bài học mới.' });
    }

    const lessonIdMatch = pathname.match(/^\/api\/admin\/lessons\/(\d+)$/);
    if (lessonIdMatch) {
      requireAdmin(req);
      const lId = Number(lessonIdMatch[1]);
      if (method === 'PUT') {
        const b = await readJsonBody(req);
        db.prepare('UPDATE lessons SET name = ?, description = ?, order_index = ? WHERE id = ?').run(
          b.name,
          b.description || '',
          Number(b.orderIndex || 1),
          lId
        );
        return sendJson(res, 200, { message: 'Đã cập nhật bài học.' });
      }
      if (method === 'DELETE') {
        db.prepare('DELETE FROM lessons WHERE id = ?').run(lId);
        return sendJson(res, 200, { message: 'Đã xóa bài học.' });
      }
    }

    // ========================================================================
    // 7. GEMINI AI ENGINE CONFIG & UPLOAD PDF TỰ ĐỘNG TẠO ĐỀ (/api/admin/ai/* & /api/admin/pdfs/*)
    // ========================================================================
    if (pathname === '/api/admin/ai/status' && method === 'GET') {
      requireAdmin(req);
      const status = await checkGeminiStatus();
      const recentLogs = db
        .prepare('SELECT * FROM ai_processing_logs ORDER BY id DESC LIMIT 20')
        .all();
      return sendJson(res, 200, { ...status, recentLogs });
    }

    if (pathname === '/api/admin/ai/config' && method === 'PUT') {
      requireAdmin(req);
      const body = await readJsonBody(req);
      const updates = {};
      if (body.geminiApiKey !== undefined && body.geminiApiKey !== '__KEEP__') {
        updates.GEMINI_API_KEY = String(body.geminiApiKey).trim();
      }
      if (body.geminiModel) {
        updates.GEMINI_MODEL = String(body.geminiModel).trim();
      }
      if (body.geminiFallbackModel) {
        updates.GEMINI_FALLBACK_MODEL = String(body.geminiFallbackModel).trim();
      }
      updateEnvVariables(updates);
      const status = await checkGeminiStatus();
      return sendJson(res, 200, {
        message: 'Đã lưu cấu hình Gemini AI vào biến môi trường Backend (.env) thành công!',
        status,
      });
    }

    if (pathname === '/api/admin/pdfs/upload-and-parse' && method === 'POST') {
      const admin = requireAdmin(req);
      const body = await readJsonBody(req);

      if (!body.pdfBase64) {
        return sendJson(res, 400, { error: 'Vui lòng chọn file PDF cần tải lên.' });
      }

      const rawBase64 = body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      const pdfBuffer = Buffer.from(rawBase64, 'base64');
      const fileName = body.fileName || 'De_Thi_Toan.pdf';

      // Bước 1: Lưu trữ file PDF gốc
      const savedFile = savePdfBuffer(fileName, pdfBuffer);

      const validSubjectId =
        body.subjectId && db.prepare('SELECT id FROM subjects WHERE id = ?').get(Number(body.subjectId))
          ? Number(body.subjectId)
          : null;
      const validChapterId =
        body.chapterId && db.prepare('SELECT id FROM chapters WHERE id = ?').get(Number(body.chapterId))
          ? Number(body.chapterId)
          : null;
      const validLessonId =
        body.lessonId && db.prepare('SELECT id FROM lessons WHERE id = ?').get(Number(body.lessonId))
          ? Number(body.lessonId)
          : null;

      // Tạo bản ghi PDFDocument trạng thái PROCESSING
      const pdfInsert = db
        .prepare(
          `INSERT INTO pdf_documents (
             title, file_name, file_path, file_size, page_count,
             subject_id, chapter_id, lesson_id, uploaded_by, parse_status
           ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'PROCESSING')`
        )
        .run(
          body.title || fileName.replace(/\.pdf$/i, ''),
          fileName,
          savedFile.relativePath,
          savedFile.fileSize,
          validSubjectId,
          validChapterId,
          validLessonId,
          admin.id
        );

      const pdfDocId = Number(pdfInsert.lastInsertRowid);

      // Bước 2 -> Bước 8: Gửi tới Gemini AI Engine đọc, trích xuất câu hỏi, công thức LaTeX, hình ảnh và đáp án
      const aiResult = await processPdfWithAiEngine({
        pdfBuffer,
        fileName,
        pdfDocumentId: pdfDocId,
        pageImages: Array.isArray(body.pageImages) ? body.pageImages : [],
        clientExtractedText: body.clientExtractedText || '',
      });

      // Lưu các hình ảnh cắt tự động từ trang PDF nếu phía client/server đã trích xuất
      if (Array.isArray(body.croppedFigures) && body.croppedFigures.length > 0) {
        for (const fig of body.croppedFigures) {
          if (fig.questionNumber && fig.dataUrl) {
            const storedUrl = saveFigureDataUrl(fig.dataUrl, `pdf_${pdfDocId}_q${fig.questionNumber}`);
            const targetQ = aiResult.questions.find((q) => q.question_number === Number(fig.questionNumber));
            if (targetQ) {
              targetQ.image_url = storedUrl;
              targetQ.images = [
                ...(targetQ.images || []),
                {
                  page: fig.page || targetQ.source_page || 1,
                  image_url: storedUrl,
                  caption: fig.caption || `Hình vẽ Câu ${fig.questionNumber}`,
                },
              ];
            }
          }
        }
      }

      // Cập nhật trạng thái PDFDocument
      db.prepare(`
        UPDATE pdf_documents
        SET page_count = ?,
            parse_status = ?,
            ai_model_used = ?,
            extracted_raw_json = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        aiResult.page_count || 1,
        aiResult.needs_review_count > 0 ? 'NEEDS_REVIEW' : 'COMPLETED',
        aiResult.ai_engine?.model_used || ENV.GEMINI_MODEL,
        JSON.stringify(aiResult),
        pdfDocId
      );

      // Tạo Đề thi ở chế độ Bản xem trước (DRAFT) để Admin kiểm tra trước khi nhấn Xuất bản
      const createdExam = createExamFromAiExtraction({
        title: body.title || aiResult.exam_title || fileName.replace(/\.pdf$/i, ''),
        description:
          body.description ||
          `Đề thi được chuyển đổi tự động từ file PDF "${fileName}" qua AI Engine (${aiResult.ai_engine?.model_used || ENV.GEMINI_MODEL
          }).`,
        examType: body.examType || 'EXAM',
        subjectId: validSubjectId,
        chapterId: validChapterId,
        lessonId: validLessonId,
        pdfDocumentId: pdfDocId,
        defaultDurationMinutes: Number(body.defaultDurationMinutes || 45),
        allowUnlimitedTime: body.allowUnlimitedTime !== false,
        allowReview: body.allowReview !== false,
        questions: aiResult.questions,
        createdBy: admin.id,
        publishImmediately: false,
      });

      return sendJson(res, 201, {
        message: 'Đã đọc file PDF và chuyển đổi thành đề thi thành công!',
        pdfDocumentId: pdfDocId,
        aiEngine: aiResult.ai_engine,
        exam: createdExam,
      });
    }

    // Nhập trực tiếp kết quả JSON từ Gemini Web (Dành cho tài khoản Gemini cá nhân của giáo viên)
    if (pathname === '/api/admin/exams/import-json' && method === 'POST') {
      const admin = requireAdmin(req);
      const body = await readJsonBody(req);

      if (!body.jsonContent || !String(body.jsonContent).trim()) {
        return sendJson(res, 400, { error: 'Vui lòng dán nội dung JSON trích xuất từ Gemini.' });
      }

      let parsed;
      try {
        let cleaned = String(body.jsonContent).trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        return sendJson(res, 400, {
          error: 'Nội dung JSON không đúng định dạng. Lỗi: ' + parseErr.message
        });
      }

      let pdfDocId = null;
      let fileName = body.fileName || 'De_Thi_Toan.pdf';
      if (body.pdfBase64) {
        const rawBase64 = body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
        const pdfBuffer = Buffer.from(rawBase64, 'base64');
        const savedFile = savePdfBuffer(fileName, pdfBuffer);

        const pdfInsert = db.prepare(`
          INSERT INTO pdf_documents (
            title, file_name, file_path, file_size, page_count,
            subject_id, chapter_id, lesson_id, uploaded_by, parse_status, ai_model_used
          ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'COMPLETED', 'Gemini Advanced (Web Prompt)')
        `).run(
          body.title || parsed.exam_title || fileName.replace(/\.pdf$/i, ''),
          fileName,
          savedFile.relativePath,
          savedFile.fileSize,
          body.subjectId ? Number(body.subjectId) : null,
          body.chapterId ? Number(body.chapterId) : null,
          body.lessonId ? Number(body.lessonId) : null,
          admin.id
        );
        pdfDocId = Number(pdfInsert.lastInsertRowid);
      }

      const examTitle = body.title || parsed.exam_title || fileName.replace(/\.pdf$/i, '') || 'Đề thi mới';
      const normalized = validateAndNormalizeExtractedJson(parsed, examTitle);

      const createdExam = createExamFromAiExtraction({
        title: examTitle,
        description:
          body.description ||
          `Đề thi được tạo trực tiếp từ kết quả trích xuất của Gemini Advanced (Web).`,
        examType: body.examType || 'EXAM',
        subjectId: body.subjectId ? Number(body.subjectId) : null,
        chapterId: body.chapterId ? Number(body.chapterId) : null,
        lessonId: body.lessonId ? Number(body.lessonId) : null,
        pdfDocumentId: pdfDocId,
        defaultDurationMinutes: Number(body.defaultDurationMinutes || 45),
        allowUnlimitedTime: body.allowUnlimitedTime !== false,
        allowReview: body.allowReview !== false,
        questions: normalized.questions,
        createdBy: admin.id,
        publishImmediately: false,
      });

      return sendJson(res, 201, {
        message: `Đã tạo đề thi thành công với ${normalized.questions.length} câu hỏi từ Gemini Web!`,
        pdfDocumentId: pdfDocId,
        exam: createdExam,
      });
    }

    // Quản lý danh sách file PDF gốc (/api/admin/pdfs)
    if (pathname === '/api/admin/pdfs' && method === 'GET') {
      requireAdmin(req);
      const pdfs = db
        .prepare(
          `SELECT p.*,
                  s.name as subject_name,
                  c.name as chapter_name,
                  l.name as lesson_name
           FROM pdf_documents p
           LEFT JOIN subjects s ON p.subject_id = s.id
           LEFT JOIN chapters c ON p.chapter_id = c.id
           LEFT JOIN lessons l ON p.lesson_id = l.id
           ORDER BY p.id DESC`
        )
        .all();

      const enriched = pdfs.map((p) => {
        const linkedExams = db
          .prepare(
            `SELECT DISTINCT e.id, e.title, e.exam_type, e.status
             FROM exams e
             LEFT JOIN exam_pdf_links epl ON epl.exam_id = e.id
             WHERE e.pdf_document_id = ? OR epl.pdf_document_id = ?`
          )
          .all(p.id, p.id);
        return {
          ...p,
          linkedExams,
        };
      });

      return sendJson(res, 200, { pdfs: enriched });
    }

    const pdfAdminMatch = pathname.match(/^\/api\/admin\/pdfs\/(\d+)$/);
    if (pdfAdminMatch) {
      requireAdmin(req);
      const pdfId = Number(pdfAdminMatch[1]);
      const existing = db.prepare('SELECT * FROM pdf_documents WHERE id = ?').get(pdfId);
      if (!existing) return sendJson(res, 404, { error: 'Không tìm thấy tài liệu PDF.' });

      if (method === 'PUT') {
        const body = await readJsonBody(req);
        let filePath = existing.file_path;
        let fileName = existing.file_name;
        let fileSize = existing.file_size;

        // Nếu Admin thay thế file PDF mới
        if (body.newPdfBase64) {
          const rawB64 = body.newPdfBase64.replace(/^data:application\/pdf;base64,/, '');
          const buf = Buffer.from(rawB64, 'base64');
          const replaced = replacePdfBuffer(existing.file_path, body.fileName || existing.file_name, buf);
          filePath = replaced.relativePath;
          fileName = body.fileName || existing.file_name;
          fileSize = replaced.fileSize;
        }

        db.prepare(`
          UPDATE pdf_documents
          SET title = ?, file_name = ?, file_path = ?, file_size = ?,
              chapter_id = ?, lesson_id = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          body.title || existing.title,
          fileName,
          filePath,
          fileSize,
          body.chapterId !== undefined ? (body.chapterId ? Number(body.chapterId) : null) : existing.chapter_id,
          body.lessonId !== undefined ? (body.lessonId ? Number(body.lessonId) : null) : existing.lesson_id,
          pdfId
        );

        // Nếu Admin gắn PDF này với nhiều bộ bài tập/đề thi
        if (Array.isArray(body.linkedExamIds)) {
          db.prepare('DELETE FROM exam_pdf_links WHERE pdf_document_id = ?').run(pdfId);
          const linkStmt = db.prepare(
            'INSERT OR IGNORE INTO exam_pdf_links (exam_id, pdf_document_id) VALUES (?, ?)'
          );
          for (const exId of body.linkedExamIds) {
            linkStmt.run(Number(exId), pdfId);
            db.prepare('UPDATE exams SET pdf_document_id = ? WHERE id = ? AND pdf_document_id IS NULL').run(
              pdfId,
              Number(exId)
            );
          }
        }

        return sendJson(res, 200, { message: 'Đã cập nhật thông tin tài liệu PDF gốc thành công!' });
      }

      if (method === 'DELETE') {
        deleteStorageFile(existing.file_path);
        db.prepare('DELETE FROM pdf_documents WHERE id = ?').run(pdfId);
        return sendJson(res, 200, { message: 'Đã xóa file PDF thành công.' });
      }
    }

    // Upload hình ảnh cắt từ trang PDF cho câu hỏi
    if (pathname === '/api/admin/figures/upload' && method === 'POST') {
      requireAdmin(req);
      const body = await readJsonBody(req);
      if (!body.dataUrl) {
        return sendJson(res, 400, { error: 'Thiếu dữ liệu hình ảnh.' });
      }
      const url = saveFigureDataUrl(body.dataUrl, body.prefix || 'cropped');
      return sendJson(res, 201, { imageUrl: url });
    }

    // ========================================================================
    // 8. QUẢN LÝ ĐỀ THI & CÂU HỎI (/api/admin/exams/* & /api/admin/questions/*)
    // ========================================================================
    if (pathname === '/api/admin/exams' && method === 'GET') {
      requireAdmin(req);
      const exams = db
        .prepare(
          `SELECT e.*,
                  s.name as subject_name,
                  c.name as chapter_name,
                  l.name as lesson_name,
                  p.file_name as pdf_file_name,
                  (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count,
                  (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.needs_review = 1) as needs_review_count,
                  (SELECT COUNT(*) FROM exam_attempts ea WHERE ea.exam_id = e.id AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')) as submission_count,
                  (SELECT COALESCE(ROUND(AVG(ea.total_score), 2), 0) FROM exam_attempts ea WHERE ea.exam_id = e.id AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')) as average_score
           FROM exams e
           LEFT JOIN subjects s ON e.subject_id = s.id
           LEFT JOIN chapters c ON e.chapter_id = c.id
           LEFT JOIN lessons l ON e.lesson_id = l.id
           LEFT JOIN pdf_documents p ON e.pdf_document_id = p.id
           ORDER BY e.id DESC`
        )
        .all();

      return sendJson(res, 200, { exams });
    }

    if (pathname === '/api/admin/exams' && method === 'POST') {
      const admin = requireAdmin(req);
      const b = await readJsonBody(req);
      const examIns = db.prepare(`
        INSERT INTO exams (
          title, description, exam_type, subject_id, chapter_id, lesson_id,
          default_duration_minutes, allow_unlimited_time, allow_review,
          total_points, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 10, 'PUBLISHED', ?)
      `).run(
        b.title || 'Đề thi mới',
        b.description || '',
        b.examType || 'EXAM',
        b.subjectId ? Number(b.subjectId) : null,
        b.chapterId ? Number(b.chapterId) : null,
        b.lessonId ? Number(b.lessonId) : null,
        Number(b.defaultDurationMinutes || 45),
        b.allowUnlimitedTime !== false ? 1 : 0,
        b.allowReview !== false ? 1 : 0,
        admin.id
      );
      const newExamId = Number(examIns.lastInsertRowid);
      return sendJson(res, 201, {
        message: 'Đã tạo đề thi thành công.',
        exam: getExamFullDetailForAdmin(newExamId)
      });
    }

    const adminExamMatch = pathname.match(/^\/api\/admin\/exams\/(\d+)$/);
    if (adminExamMatch) {
      requireAdmin(req);
      const examId = Number(adminExamMatch[1]);

      if (method === 'GET') {
        const detail = getExamFullDetailForAdmin(examId);
        if (!detail) return sendJson(res, 404, { error: 'Không tìm thấy đề thi.' });

        const attempts = db
          .prepare(
            `SELECT ea.*, u.full_name, u.username, u.class_name
             FROM exam_attempts ea
             JOIN users u ON ea.user_id = u.id
             WHERE ea.exam_id = ?
             ORDER BY ea.id DESC`
          )
          .all(examId);

        return sendJson(res, 200, { exam: detail, attempts });
      }

      if (method === 'PUT') {
        const body = await readJsonBody(req);
        const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
        if (!existing) return sendJson(res, 404, { error: 'Không tìm thấy đề thi.' });

        const targetStatus = body.status || existing.status;

        // Kiểm tra quy tắc bắt buộc: Không cho phép xuất bản (PUBLISHED) nếu còn câu hỏi NEEDS_REVIEW
        if (targetStatus === 'PUBLISHED') {
          const unverifiedRows = db
            .prepare('SELECT question_number FROM questions WHERE exam_id = ? AND needs_review = 1')
            .all(examId);
          if (unverifiedRows.length > 0) {
            return sendJson(res, 400, {
              error: `Không thể xuất bản đề thi! Còn ${unverifiedRows.length} câu hỏi đang ở trạng thái NEEDS_REVIEW (Câu: ${unverifiedRows
                .map((r) => r.question_number)
                .join(', ')}). Vui lòng kiểm tra và xác nhận đáp án cho các câu hỏi này trước khi xuất bản.`,
            });
          }
        }

        db.prepare(`
          UPDATE exams
          SET title = ?,
              description = ?,
              exam_type = ?,
              subject_id = ?,
              chapter_id = ?,
              lesson_id = ?,
              pdf_document_id = ?,
              default_duration_minutes = ?,
              allow_unlimited_time = ?,
              allow_review = ?,
              status = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(
          body.title ?? existing.title,
          body.description ?? existing.description,
          body.examType ?? existing.exam_type,
          body.subjectId !== undefined ? (body.subjectId ? Number(body.subjectId) : null) : existing.subject_id,
          body.chapterId !== undefined ? (body.chapterId ? Number(body.chapterId) : null) : existing.chapter_id,
          body.lessonId !== undefined ? (body.lessonId ? Number(body.lessonId) : null) : existing.lesson_id,
          body.pdfDocumentId !== undefined
            ? body.pdfDocumentId
              ? Number(body.pdfDocumentId)
              : null
            : existing.pdf_document_id,
          Number(body.defaultDurationMinutes ?? existing.default_duration_minutes),
          body.allowUnlimitedTime !== undefined
            ? body.allowUnlimitedTime
              ? 1
              : 0
            : existing.allow_unlimited_time,
          body.allowReview !== undefined ? (body.allowReview ? 1 : 0) : existing.allow_review,
          targetStatus,
          examId
        );

        return sendJson(res, 200, {
          message:
            targetStatus === 'PUBLISHED'
              ? 'Đã xuất bản công khai đề thi cho học sinh làm bài!'
              : 'Đã lưu cập nhật thông tin đề thi.',
          exam: getExamFullDetailForAdmin(examId),
        });
      }

      if (method === 'DELETE') {
        db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
        return sendJson(res, 200, { message: 'Đã xóa đề thi thành công.' });
      }
    }

    const reparseExamMatch = pathname.match(/^\/api\/admin\/exams\/(\d+)\/reparse$/);
    if (reparseExamMatch && method === 'POST') {
      requireAdmin(req);
      const examId = Number(reparseExamMatch[1]);
      const existingExam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
      if (!existingExam || !existingExam.pdf_document_id) {
        return sendJson(res, 400, { error: 'Đề thi này không có tài liệu PDF gốc liên kết để phân tích lại.' });
      }
      const pdfDoc = db.prepare('SELECT * FROM pdf_documents WHERE id = ?').get(existingExam.pdf_document_id);
      if (!pdfDoc) {
        return sendJson(res, 404, { error: 'Không tìm thấy bản ghi PDF gốc.' });
      }
      const pdfBuffer = readStorageFile(pdfDoc.file_path);
      if (!pdfBuffer) {
        return sendJson(res, 404, { error: 'Không tìm thấy file PDF vật lý trên ổ đĩa.' });
      }

      const aiResult = await processPdfWithAiEngine({
        pdfBuffer,
        fileName: pdfDoc.file_name,
        pdfDocumentId: pdfDoc.id,
      });

      db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId);
      insertQuestionsForExam(examId, aiResult.questions);

      db.prepare(`
        UPDATE pdf_documents
        SET page_count = ?,
            parse_status = ?,
            ai_model_used = ?,
            extracted_raw_json = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        aiResult.page_count || 1,
        aiResult.needs_review_count > 0 ? 'NEEDS_REVIEW' : 'COMPLETED',
        aiResult.ai_engine?.model_used || ENV.GEMINI_MODEL,
        JSON.stringify(aiResult),
        pdfDoc.id
      );

      return sendJson(res, 200, {
        message: `Đã phân tích lại file PDF gốc và trích xuất thành công ${aiResult.questions.length} câu hỏi!`,
        exam: getExamFullDetailForAdmin(examId),
      });
    }

    const reorderMatch = pathname.match(/^\/api\/admin\/exams\/(\d+)\/reorder$/);
    if (reorderMatch && method === 'PUT') {
      requireAdmin(req);
      const examId = Number(reorderMatch[1]);
      const body = await readJsonBody(req);
      if (Array.isArray(body.questionIds)) {
        const stmt = db.prepare('UPDATE questions SET order_index = ?, question_number = ? WHERE id = ? AND exam_id = ?');
        body.questionIds.forEach((qId, idx) => {
          stmt.run(idx + 1, idx + 1, Number(qId), examId);
        });
      }
      return sendJson(res, 200, {
        message: 'Đã cập nhật thứ tự câu hỏi.',
        exam: getExamFullDetailForAdmin(examId),
      });
    }

    // Quản lý câu hỏi (/api/admin/questions)
    if (pathname === '/api/admin/questions' && method === 'GET') {
      requireAdmin(req);
      const examIdFilter = urlObj.searchParams.get('examId');
      const onlyNeedsReview = urlObj.searchParams.get('needsReview') === 'true';

      let sql = `
        SELECT q.*, e.title as exam_title, c.name as chapter_name
        FROM questions q
        JOIN exams e ON q.exam_id = e.id
        LEFT JOIN chapters c ON e.chapter_id = c.id
        WHERE 1=1
      `;
      const params = [];
      if (examIdFilter) {
        sql += ' AND q.exam_id = ?';
        params.push(Number(examIdFilter));
      }
      if (onlyNeedsReview) {
        sql += ' AND q.needs_review = 1';
      }
      sql += ' ORDER BY q.needs_review DESC, q.exam_id DESC, q.order_index ASC';

      const rows = db.prepare(sql).all(...params);
      const fullList = rows.map((q) => {
        const opts = db
          .prepare('SELECT option_key, content FROM question_options WHERE question_id = ? ORDER BY order_index ASC')
          .all(q.id);
        const ans = db.prepare('SELECT * FROM correct_answers WHERE question_id = ?').get(q.id);
        return {
          ...q,
          needsReview: Boolean(q.needs_review),
          options: opts,
          correctAnswer: ans,
        };
      });

      return sendJson(res, 200, { questions: fullList });
    }

    if (pathname === '/api/admin/questions' && method === 'POST') {
      requireAdmin(req);
      const b = await readJsonBody(req);
      const examId = Number(b.examId);
      const countRow = db.prepare('SELECT COUNT(*) as c FROM questions WHERE exam_id = ?').get(examId);
      const nextNum = countRow.c + 1;

      const qType = String(b.questionType || 'MULTIPLE_CHOICE').toUpperCase();
      const qIns = db
        .prepare(
          `INSERT INTO questions (
             exam_id, question_number, question_type, content, image_url, svg_diagram,
             source_page, points, order_index, confidence, status, needs_review, explanation
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, 'verified', 0, ?)`
        )
        .run(
          examId,
          Number(b.questionNumber || nextNum),
          qType,
          b.content || '',
          b.imageUrl || null,
          b.svgDiagram || null,
          Number(b.sourcePage || 1),
          Number(b.points || 1.0),
          nextNum,
          b.explanation || ''
        );

      const qId = Number(qIns.lastInsertRowid);
      saveQuestionOptionsAndAnswers(db, qId, qType, b);
      recalculateExamTotalPoints(examId);

      return sendJson(res, 201, {
        message: 'Đã thêm câu hỏi mới vào đề thi.',
        exam: getExamFullDetailForAdmin(examId),
      });
    }

    const adminQuestionMatch = pathname.match(/^\/api\/admin\/questions\/(\d+)$/);
    if (adminQuestionMatch) {
      requireAdmin(req);
      const qId = Number(adminQuestionMatch[1]);
      const existingQ = db.prepare('SELECT * FROM questions WHERE id = ?').get(qId);
      if (!existingQ) return sendJson(res, 404, { error: 'Không tìm thấy câu hỏi.' });

      if (method === 'PUT') {
        const b = await readJsonBody(req);
        const qType = String(b.questionType || existingQ.question_type).toUpperCase();
        const markVerified = b.markVerified !== false; // Khi Admin lưu/xác nhận câu hỏi

        db.prepare(`
          UPDATE questions
          SET question_number = ?,
              question_type = ?,
              content = ?,
              image_url = ?,
              svg_diagram = ?,
              source_page = ?,
              points = ?,
              status = ?,
              needs_review = ?,
              review_reason = ?,
              explanation = ?
          WHERE id = ?
        `).run(
          Number(b.questionNumber ?? existingQ.question_number),
          qType,
          b.content ?? existingQ.content,
          b.imageUrl !== undefined ? b.imageUrl : existingQ.image_url,
          b.svgDiagram !== undefined ? b.svgDiagram : existingQ.svg_diagram,
          Number(b.sourcePage ?? existingQ.source_page),
          Number(b.points ?? existingQ.points),
          markVerified ? 'verified' : 'NEEDS_REVIEW',
          markVerified ? 0 : 1,
          markVerified ? null : b.reviewReason || existingQ.review_reason,
          b.explanation ?? existingQ.explanation,
          qId
        );

        saveQuestionOptionsAndAnswers(db, qId, qType, b);
        recalculateExamTotalPoints(existingQ.exam_id);

        // Kiểm tra xem đề thi còn câu nào NEEDS_REVIEW không để cập nhật pdf_documents
        const remainingReview = db
          .prepare('SELECT COUNT(*) as c FROM questions WHERE exam_id = ? AND needs_review = 1')
          .get(existingQ.exam_id).c;
        if (remainingReview === 0) {
          const ex = db.prepare('SELECT pdf_document_id FROM exams WHERE id = ?').get(existingQ.exam_id);
          if (ex?.pdf_document_id) {
            db.prepare("UPDATE pdf_documents SET parse_status = 'COMPLETED' WHERE id = ?").run(ex.pdf_document_id);
          }
        }

        return sendJson(res, 200, {
          message: 'Đã lưu cập nhật và xác nhận câu hỏi thành công!',
          exam: getExamFullDetailForAdmin(existingQ.exam_id),
        });
      }

      if (method === 'DELETE') {
        db.prepare('DELETE FROM questions WHERE id = ?').run(qId);
        recalculateExamTotalPoints(existingQ.exam_id);
        return sendJson(res, 200, {
          message: 'Đã xóa câu hỏi.',
          exam: getExamFullDetailForAdmin(existingQ.exam_id),
        });
      }
    }

    // ========================================================================
    // 9. GIAO DIỆN HỌC SINH: DASHBOARD, DANH SÁCH ĐỀ, LÀM BÀI & CHẤM ĐIỂM (/api/student/*)
    // ========================================================================
    if (pathname === '/api/student/dashboard' && method === 'GET') {
      const user = requireAuth(req);
      const statsRow = db
        .prepare(
          `SELECT COUNT(id) as total_submissions,
                  COUNT(DISTINCT exam_id) as completed_exams,
                  COALESCE(ROUND(AVG(total_score), 2), 0) as average_score,
                  COALESCE(ROUND(MAX(total_score), 2), 0) as highest_score
           FROM exam_attempts
           WHERE user_id = ? AND status IN ('SUBMITTED', 'AUTO_SUBMITTED')`
        )
        .get(user.id);

      const contributionGraph = getStudentContributionGraph(user.id);
      const leaderboard = getLeaderboardData({ periodType: 'ALL_TIME', viewerRole: user.role });

      // Những bài tập mới nhất
      const allPublishedExams = db
        .prepare(
          `SELECT e.*,
                  s.name as subject_name,
                  c.name as chapter_name,
                  l.name as lesson_name,
                  p.file_name as pdf_file_name,
                  (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count
           FROM exams e
           LEFT JOIN subjects s ON e.subject_id = s.id
           LEFT JOIN chapters c ON e.chapter_id = c.id
           LEFT JOIN lessons l ON e.lesson_id = l.id
           LEFT JOIN pdf_documents p ON e.pdf_document_id = p.id
           WHERE e.status = 'PUBLISHED'
           ORDER BY e.id DESC`
        )
        .all();

      const studentAttempts = db
        .prepare('SELECT exam_id, status, total_score FROM exam_attempts WHERE user_id = ?')
        .all(user.id);

      const enrichedExams = allPublishedExams.map((e) => {
        const myAtts = studentAttempts.filter((a) => a.exam_id === e.id);
        const completedAtts = myAtts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED');
        const inProgressAtt = myAtts.find((a) => a.status === 'IN_PROGRESS');
        return {
          ...e,
          myAttemptCount: completedAtts.length,
          myBestScore:
            completedAtts.length > 0 ? Math.max(...completedAtts.map((a) => Number(a.total_score))) : null,
          completionStatus: inProgressAtt
            ? 'IN_PROGRESS'
            : completedAtts.length > 0
              ? 'COMPLETED'
              : 'NOT_STARTED',
        };
      });

      const latestExams = enrichedExams.slice(0, 6);
      const unfinishedExams = enrichedExams.filter((e) => e.completionStatus !== 'COMPLETED').slice(0, 6);

      return sendJson(res, 200, {
        user,
        stats: {
          completedExamsCount: statsRow.completed_exams,
          totalSubmissions: statsRow.total_submissions,
          averageScore: statsRow.average_score,
          highestScore: statsRow.highest_score,
          streakDays: contributionGraph.summary.currentStreak,
          bestStreakDays: contributionGraph.summary.bestStreak,
        },
        contributionGraph,
        latestExams,
        unfinishedExams,
        leaderboard: leaderboard.entries.slice(0, 5),
      });
    }

    if (pathname === '/api/student/exams' && method === 'GET') {
      const user = requireAuth(req);
      const chapterId = urlObj.searchParams.get('chapterId');
      const lessonId = urlObj.searchParams.get('lessonId');
      const examType = urlObj.searchParams.get('examType');

      let sql = `
        SELECT e.*,
               s.name as subject_name, s.grade as subject_grade,
               c.name as chapter_name,
               l.name as lesson_name,
               p.file_name as pdf_file_name, p.title as pdf_title,
               (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count
        FROM exams e
        LEFT JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN chapters c ON e.chapter_id = c.id
        LEFT JOIN lessons l ON e.lesson_id = l.id
        LEFT JOIN pdf_documents p ON e.pdf_document_id = p.id
        WHERE e.status = 'PUBLISHED'
      `;
      const params = [];
      if (chapterId) {
        sql += ' AND e.chapter_id = ?';
        params.push(Number(chapterId));
      }
      if (lessonId) {
        sql += ' AND e.lesson_id = ?';
        params.push(Number(lessonId));
      }
      if (examType) {
        sql += ' AND e.exam_type = ?';
        params.push(examType);
      }
      sql += ' ORDER BY e.id DESC';

      const exams = db.prepare(sql).all(...params);
      const myAttempts = db
        .prepare('SELECT id, exam_id, status, total_score FROM exam_attempts WHERE user_id = ?')
        .all(user.id);

      const list = exams.map((e) => {
        const atts = myAttempts.filter((a) => a.exam_id === e.id);
        const done = atts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED');
        const active = atts.find((a) => a.status === 'IN_PROGRESS');
        return {
          ...e,
          allowUnlimitedTime: Boolean(e.allow_unlimited_time),
          allowReview: Boolean(e.allow_review),
          myAttemptCount: done.length,
          myBestScore: done.length > 0 ? Math.max(...done.map((a) => Number(a.total_score))) : null,
          activeAttemptId: active ? active.id : null,
          completionStatus: active ? 'IN_PROGRESS' : done.length > 0 ? 'COMPLETED' : 'NOT_STARTED',
        };
      });

      return sendJson(res, 200, { exams: list });
    }

    const startExamMatch = pathname.match(/^\/api\/student\/exams\/(\d+)\/start$/);
    if (startExamMatch && method === 'POST') {
      const user = requireAuth(req);
      const examId = Number(startExamMatch[1]);
      const body = await readJsonBody(req);
      const payload = startOrResumeExamAttempt({
        examId,
        userId: user.id,
        selectedDurationMinutes: body.selectedDurationMinutes,
      });
      return sendJson(res, 200, payload);
    }

    const takeAttemptMatch = pathname.match(/^\/api\/student\/attempts\/(\d+)\/take$/);
    if (takeAttemptMatch && method === 'GET') {
      const user = requireAuth(req);
      const attemptId = Number(takeAttemptMatch[1]);
      const payload = getActiveAttemptPayloadForStudent(attemptId, user.id);
      return sendJson(res, 200, payload);
    }

    const saveDraftMatch = pathname.match(/^\/api\/student\/attempts\/(\d+)\/save$/);
    if (saveDraftMatch && method === 'PUT') {
      const user = requireAuth(req);
      const attemptId = Number(saveDraftMatch[1]);
      const body = await readJsonBody(req);
      const resData = saveStudentAnswerDraft({
        attemptId,
        userId: user.id,
        answers: body.answers,
      });
      return sendJson(res, 200, resData);
    }

    const submitAttemptMatch = pathname.match(/^\/api\/student\/attempts\/(\d+)\/submit$/);
    if (submitAttemptMatch && method === 'POST') {
      const user = requireAuth(req);
      const attemptId = Number(submitAttemptMatch[1]);
      const body = await readJsonBody(req);
      const result = finalizeAndGradeAttempt(
        attemptId,
        Boolean(body.isAutoSubmitted),
        body.answers || null,
        user.id
      );
      return sendJson(res, 200, result);
    }

    const resultAttemptMatch = pathname.match(/^\/api\/student\/attempts\/(\d+)\/result$/);
    if (resultAttemptMatch && method === 'GET') {
      const user = requireAuth(req);
      const attemptId = Number(resultAttemptMatch[1]);
      const result = getAttemptResultDetail(attemptId, user.id, user.role);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/student/history' && method === 'GET') {
      const user = requireAuth(req);
      const history = db
        .prepare(
          `SELECT ea.*,
                  e.title as exam_title, e.exam_type, e.pdf_document_id, e.allow_review,
                  c.name as chapter_name, l.name as lesson_name
           FROM exam_attempts ea
           JOIN exams e ON ea.exam_id = e.id
           LEFT JOIN chapters c ON e.chapter_id = c.id
           LEFT JOIN lessons l ON e.lesson_id = l.id
           WHERE ea.user_id = ? AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
           ORDER BY ea.submitted_at DESC, ea.id DESC`
        )
        .all(user.id);

      return sendJson(res, 200, { history });
    }

    // ========================================================================
    // 10. LEADERBOARD & SETTINGS (/api/leaderboard & /api/admin/leaderboard/settings)
    // ========================================================================
    if (pathname === '/api/leaderboard' && method === 'GET') {
      const user = authenticateRequest(req);
      const periodType = urlObj.searchParams.get('periodType') || 'ALL_TIME';
      const dateKey = urlObj.searchParams.get('date') || getVnDateString();
      const data = getLeaderboardData({
        periodType,
        dateKey,
        viewerRole: user ? user.role : 'STUDENT',
      });
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/admin/leaderboard/settings' && method === 'PUT') {
      requireAdmin(req);
      const body = await readJsonBody(req);
      const upsert = db.prepare(`
        INSERT INTO system_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value = excluded.setting_value,
          updated_at = datetime('now')
      `);
      if (body.enabled !== undefined) upsert.run('leaderboard_enabled', String(Boolean(body.enabled)));
      if (body.isPublic !== undefined) upsert.run('leaderboard_public', String(Boolean(body.isPublic)));
      if (body.allowNickname !== undefined)
        upsert.run('leaderboard_allow_nickname', String(Boolean(body.allowNickname)));

      return sendJson(res, 200, {
        message: 'Đã cập nhật cấu hình Bảng xếp hạng thành công!',
        leaderboard: getLeaderboardData({ periodType: 'ALL_TIME', viewerRole: 'ADMIN' }),
      });
    }

    return sendJson(res, 404, { error: `Endpoint không tồn tại: ${method} ${pathname}` });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return sendJson(res, statusCode, { error: err.message || 'Lỗi máy chủ nội bộ.' });
  }
}

function saveQuestionOptionsAndAnswers(db, questionId, qType, b) {
  db.prepare('DELETE FROM question_options WHERE question_id = ?').run(questionId);
  db.prepare('DELETE FROM correct_answers WHERE question_id = ?').run(questionId);

  const insertOpt = db.prepare(
    'INSERT INTO question_options (question_id, option_key, content, order_index) VALUES (?, ?, ?, ?)'
  );

  if (qType === 'MULTIPLE_CHOICE') {
    const opts = b.options || {};
    ['A', 'B', 'C', 'D'].forEach((k, idx) => {
      insertOpt.run(questionId, k, String(opts[k] || ''), idx + 1);
    });
    const ansKey = String(b.correctAnswer || '').trim().toUpperCase();
    db.prepare(
      'INSERT INTO correct_answers (question_id, answer_key, short_answer_value, equivalent_answers, explanation) VALUES (?, ?, NULL, ?, ?)'
    ).run(questionId, ansKey, '[]', b.explanation || '');
  } else if (qType === 'TRUE_FALSE') {
    const stmts = b.statements || {};
    const tfMap = {};
    ['a', 'b', 'c', 'd'].forEach((k, idx) => {
      const item = stmts[k] || {};
      const cText = typeof item === 'string' ? item : String(item.content || '');
      insertOpt.run(questionId, k, cText, idx + 1);
      if (typeof item === 'object' && typeof item.correct === 'boolean') {
        tfMap[k] = item.correct;
      }
    });
    if (b.correctAnswer && typeof b.correctAnswer === 'object') {
      Object.assign(tfMap, b.correctAnswer);
    }
    db.prepare(
      'INSERT INTO correct_answers (question_id, answer_key, short_answer_value, equivalent_answers, explanation) VALUES (?, ?, NULL, ?, ?)'
    ).run(questionId, JSON.stringify(tfMap), '[]', b.explanation || '');
  } else {
    const shortVal = String(b.correctAnswer ?? '').trim();
    let eqArr = Array.isArray(b.equivalentAnswers) ? b.equivalentAnswers : [];
    if (typeof b.equivalentAnswers === 'string' && b.equivalentAnswers.trim()) {
      eqArr = b.equivalentAnswers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const eqSet = new Set([shortVal, ...eqArr]);
    if (shortVal.includes('.')) eqSet.add(shortVal.replace('.', ','));
    if (shortVal.includes(',')) eqSet.add(shortVal.replace(',', '.'));
    db.prepare(
      'INSERT INTO correct_answers (question_id, answer_key, short_answer_value, equivalent_answers, explanation) VALUES (?, ?, ?, ?, ?)'
    ).run(questionId, shortVal, shortVal, JSON.stringify(Array.from(eqSet).filter(Boolean)), b.explanation || '');
  }
}

