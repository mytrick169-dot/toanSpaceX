import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import '../server.mjs';
import { handleApiRequest } from '../src/backend/controllers/apiRouter.mjs';
import { getDb } from '../src/backend/db/database.mjs';
import { buildRealMathExamPdf } from '../src/backend/services/pdfProcessorService.mjs';

/**
 * Giả lập luồng HTTP Request / Response đi qua bộ định tuyến handleApiRequest của Server
 */
async function invokeApi(endpoint, options = {}, token = '') {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (token) headers['authorization'] = `Bearer ${token}`;

  const req = new EventEmitter();
  req.method = method;
  req.url = endpoint;
  req.headers = headers;
  req.destroy = () => {};

  let statusCode = 200;
  let resHeaders = {};
  const resChunks = [];

  const res = {
    writeHead(code, h = {}) {
      statusCode = code;
      resHeaders = h;
    },
    end(chunk) {
      if (chunk) {
        resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf-8'));
      }
    },
  };

  const urlObj = new URL(endpoint, 'http://localhost:3000');
  const handlerPromise = handleApiRequest(req, res, urlObj);

  // Phát dữ liệu body vào stream sau khi handleApiRequest đăng ký listener
  setImmediate(() => {
    if (options.body) {
      req.emit('data', Buffer.from(options.body, 'utf-8'));
    }
    req.emit('end');
  });

  await handlerPromise;
  const rawBuffer = Buffer.concat(resChunks);
  let jsonBody = {};
  try {
    jsonBody = JSON.parse(rawBuffer.toString('utf-8'));
  } catch {
    jsonBody = null;
  }

  return { status: statusCode, body: jsonBody, rawBuffer, headers: resHeaders };
}

async function runVerificationSuite() {
  console.log('====================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG SPACE X MATH (E2E TEST SUITE)');
  console.log('====================================================================');

  // 1. KIỂM TRA CƠ SỞ DỮ LIỆU (14 BẢNG CỐT LÕI)
  const db = getDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((t) => t.name);
  const requiredTables = [
    'roles',
    'users',
    'subjects',
    'chapters',
    'lessons',
    'pdf_documents',
    'exams',
    'questions',
    'question_options',
    'correct_answers',
    'exam_attempts',
    'student_answers',
    'leaderboard',
    'learning_activities',
  ];
  for (const tbl of requiredTables) {
    assert.ok(tables.includes(tbl), `Thiếu bảng bắt buộc: ${tbl}`);
  }
  console.log('✓ [1/7] Kiểm tra Schema Database: Đầy đủ 14 bảng chuẩn hóa cốt lõi.');

  // 2. KIỂM TRA ĐĂNG NHẬP, ĐĂNG KÝ, BẢO MẬT MẬT KHẨU & PHÂN QUYỀN RBAC
  const adminLogin = await invokeApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.user.role, 'ADMIN');
  const adminToken = adminLogin.body.token;

  const studentReg = await invokeApi('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Học sinh Kiểm thử Tự động',
      username: 'test_e2e_student',
      className: '12A1',
      nickname: 'TestRunner',
      password: 'password123',
    }),
  });
  assert.equal(studentReg.status, 201);
  assert.equal(studentReg.body.user.role, 'STUDENT');
  const studentToken = studentReg.body.token;
  const tempStudentId = studentReg.body.user.id;

  // Kiểm tra mật khẩu trong DB được băm bằng $scrypt$, không lưu plain text
  const adminDbRow = db.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get();
  assert.ok(adminDbRow.password_hash.startsWith('$scrypt$'), 'Mật khẩu phải được băm bảo mật');
  assert.ok(!adminDbRow.password_hash.includes('admin123'), 'Không được lưu mật khẩu gốc');

  // Học sinh không được phép truy cập API của Admin (403 Forbidden)
  const forbiddenCheck = await invokeApi('/api/admin/dashboard', { method: 'GET' }, studentToken);
  assert.equal(forbiddenCheck.status, 403);
  console.log('✓ [2/7] Kiểm tra Auth, JWT, Hash mật khẩu & Phân quyền Admin/Student: Thành công.');

  // 3. KIỂM TRA QUY TRÌNH UPLOAD PDF & AI TỰ ĐỘNG TẠO ĐỀ + QUY TẮC NEEDS_REVIEW
  const customPdfSpec = {
    structuredPayload: {
      exam_title: 'Đề kiểm tra Thực nghiệm AI PDF Toán 12',
      detected_grade: 12,
      has_answer_key_in_pdf: true,
      questions: [
        {
          question_number: 1,
          question_type: 'multiple_choice',
          content: 'Đạo hàm của hàm số $y = x^3 - 3x$ là:',
          images: [],
          options: { A: '$3x^2 - 3$', B: '$x^2 - 3$', C: '$3x^2$', D: '$3x - 3$' },
          correct_answer: 'A',
          source_page: 1,
          points: 2.0,
          confidence: 0.99,
          status: 'verified',
        },
        {
          question_number: 2,
          question_type: 'true_false',
          content: 'Cho hàm số $f(x) = x^2$. Xét các mệnh đề:',
          images: [],
          statements: {
            a: { content: '$f(0) = 0$', correct: true },
            b: { content: '$f(2) = 4$', correct: true },
            c: { content: 'Hàm số nghịch biến trên $(0; +\\infty)$', correct: false },
            d: { content: '$f\'(x) = 2x$', correct: true },
          },
          correct_answer: { a: true, b: true, c: false, d: true },
          source_page: 1,
          points: 4.0,
          confidence: 0.98,
          status: 'verified',
        },
        {
          question_number: 3,
          question_type: 'short_answer',
          content: 'Tính giá trị của biểu thức $P = \\frac{1}{2}$ dưới dạng số thập phân.',
          images: [],
          correct_answer: '', // Cố tình để trống để kiểm tra cổng chặn NEEDS_REVIEW
          source_page: 1,
          points: 4.0,
          confidence: 0.6,
          status: 'NEEDS_REVIEW',
        },
      ],
    },
    pages: [
      {
        lines: [
          'DE KIEM TRA THUC NGHIEM AI PDF TOAN 12',
          'Cau 1. Dao ham cua ham so y = x^3 - 3x la: A. 3x^2 - 3',
          'Cau 2. Cho ham so f(x) = x^2.',
          'Cau 3. Tinh gia tri cua bieu thuc P = 1/2.',
        ],
      },
    ],
  };

  const customPdfBuffer = buildRealMathExamPdf(customPdfSpec);
  const uploadRes = await invokeApi(
    '/api/admin/pdfs/upload-and-parse',
    {
      method: 'POST',
      body: JSON.stringify({
        pdfBase64: customPdfBuffer.toString('base64'),
        fileName: 'De_Thuc_Nghiem_AI_Toan_12.pdf',
        title: 'Đề kiểm tra Thực nghiệm AI PDF Toán 12',
        subjectId: 1,
        chapterId: 1,
        lessonId: 1,
        examType: 'EXAM',
      }),
    },
    adminToken
  );

  assert.equal(uploadRes.status, 201);
  const createdExam = uploadRes.body.exam;
  assert.equal(createdExam.questions.length, 3);
  assert.equal(createdExam.needsReviewCount, 1);
  assert.equal(createdExam.canPublish, false);

  // Thử xuất bản khi còn câu NEEDS_REVIEW -> Phải bị chặn (HTTP 400)
  const blockedPublish = await invokeApi(
    `/api/admin/exams/${createdExam.id}`,
    {
      method: 'PUT',
      body: JSON.stringify({ status: 'PUBLISHED' }),
    },
    adminToken
  );
  assert.equal(blockedPublish.status, 400, 'Phải chặn xuất bản khi còn câu NEEDS_REVIEW');

  // Admin xác nhận đáp án cho Câu 3 ("0.5")
  const q3 = createdExam.questions.find((q) => q.questionNumber === 3);
  const verifyQ3 = await invokeApi(
    `/api/admin/questions/${q3.id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        questionType: 'SHORT_ANSWER',
        correctAnswer: '0.5',
        equivalentAnswers: '0.5, 0,5, 1/2',
        markVerified: true,
      }),
    },
    adminToken
  );
  assert.equal(verifyQ3.status, 200);
  assert.equal(verifyQ3.body.exam.needsReviewCount, 0);

  // Xuất bản đề thi sau khi đã xác nhận 100% câu hỏi
  const okPublish = await invokeApi(
    `/api/admin/exams/${createdExam.id}`,
    {
      method: 'PUT',
      body: JSON.stringify({ status: 'PUBLISHED' }),
    },
    adminToken
  );
  assert.equal(okPublish.status, 200);
  assert.equal(okPublish.body.exam.status, 'PUBLISHED');
  console.log('✓ [3/7] Kiểm tra Upload PDF, AI Chuyển đổi & Cổng kiểm duyệt NEEDS_REVIEW: Thành công.');

  // 4. KIỂM TRA TẢI FILE PDF GỐC CHO HỌC SINH
  const pdfDownloadRes = await invokeApi(
    `/api/storage/pdfs/${uploadRes.body.pdfDocumentId}/download`,
    { method: 'GET' },
    studentToken
  );
  assert.equal(pdfDownloadRes.status, 200);
  assert.equal(pdfDownloadRes.headers['Content-Type'], 'application/pdf');
  assert.ok(pdfDownloadRes.rawBuffer.subarray(0, 8).toString('latin1').startsWith('%PDF-1.4'));
  console.log('✓ [4/7] Kiểm tra Xem & Tải File PDF gốc: Đúng định dạng PDF chuẩn.');

  // 5. KIỂM TRA HỌC SINH CHỌN THỜI GIAN, LÀM BÀI, BỘ ĐẾM GIỜ BACKEND & CHẤM ĐIỂM TỰ ĐỘNG
  const startRes = await invokeApi(
    `/api/student/exams/${createdExam.id}/start`,
    {
      method: 'POST',
      body: JSON.stringify({ selectedDurationMinutes: 30 }),
    },
    studentToken
  );
  assert.equal(startRes.status, 200);
  const attemptId = startRes.body.attempt.id;
  assert.ok(startRes.body.attempt.remainingSeconds > 1700 && startRes.body.attempt.remainingSeconds <= 1800);

  // Đảm bảo dữ liệu câu hỏi khi đang thi tuyệt đối không lộ đáp án đúng
  for (const sq of startRes.body.questions) {
    assert.equal(sq.correctAnswer, undefined);
  }

  // Học sinh nộp bài với:
  // - Câu 1 (Trắc nghiệm): chọn 'A' (Đúng)
  // - Câu 2 (Đúng/Sai): chọn a:true, b:true, c:false, d:true (Đúng cả 4 ý)
  // - Câu 3 (Trả lời ngắn): nhập '0,5' (Dấu phẩy thập phân tương đương '0.5' -> Đúng!)
  const [sq1, sq2, sq3] = startRes.body.questions;
  const submitRes = await invokeApi(
    `/api/student/attempts/${attemptId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        isAutoSubmitted: false,
        answers: [
          { questionId: sq1.id, selectedOption: 'A' },
          { questionId: sq2.id, tfAnswers: { a: true, b: true, c: false, d: true } },
          { questionId: sq3.id, shortAnswer: '0,5' },
        ],
      }),
    },
    studentToken
  );
  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.body.attempt.totalScore, 10);
  assert.equal(submitRes.body.attempt.correctCount, 3);
  assert.equal(submitRes.body.attempt.wrongCount, 0);
  assert.equal(submitRes.body.attempt.blankCount, 0);
  console.log('✓ [5/7] Kiểm tra Hệ thống Làm bài, Timer Backend & Chấm điểm Tự động 3 dạng thức (gồm chuẩn hóa 0,5 = 0.5): Đạt 10/10.');

  // 6. KIỂM TRA GITHUB-STYLE LEARNING ACTIVITY & BẢNG XẾP HẠNG (LEADERBOARD)
  const studentDash = await invokeApi('/api/student/dashboard', { method: 'GET' }, studentToken);
  assert.equal(studentDash.status, 200);
  assert.equal(studentDash.body.contributionGraph.days.length, 365);
  const todayCell = studentDash.body.contributionGraph.days[364];
  assert.ok(todayCell.submissionCount >= 1);
  assert.ok(todayCell.tooltip.includes('Đã nộp'));

  const lbRes = await invokeApi('/api/leaderboard?periodType=ALL_TIME', { method: 'GET' }, studentToken);
  assert.equal(lbRes.status, 200);
  assert.ok(lbRes.body.entries.length >= 1);
  assert.equal(lbRes.body.entries[0].rank, 1);
  console.log('✓ [6/7] Kiểm tra GitHub-Style Activity Graph (365 ngày) & Bảng xếp hạng: Chính xác.');

  // 7. KIỂM TRA ADMIN DASHBOARD, QUẢN LÝ HỌC SINH & GEMINI AI STATUS
  const adminDash = await invokeApi('/api/admin/dashboard', { method: 'GET' }, adminToken);
  assert.equal(adminDash.status, 200);
  assert.ok(adminDash.body.metrics.totalStudents >= 1);
  assert.ok(adminDash.body.metrics.totalSubmissions >= 1);

  const aiStatus = await invokeApi('/api/admin/ai/status', { method: 'GET' }, adminToken);
  assert.equal(aiStatus.status, 200);
  assert.ok(Array.isArray(aiStatus.body.availableOfficialModels));

  console.log('✓ [7/7] Kiểm tra Admin Dashboard, Thống kê & Cấu hình Gemini AI Engine: Thành công.');

  // Xóa dữ liệu thực nghiệm tạm thời sau khi test xong để giữ DB sạch sẽ 100%
  await invokeApi(`/api/admin/students/${tempStudentId}`, { method: 'DELETE' }, adminToken);
  await invokeApi(`/api/admin/exams/${createdExam.id}`, { method: 'DELETE' }, adminToken);
  await invokeApi(`/api/admin/pdfs/${uploadRes.body.pdfDocumentId}`, { method: 'DELETE' }, adminToken);
  db.prepare('DELETE FROM ai_processing_logs WHERE pdf_document_id = ?').run(uploadRes.body.pdfDocumentId);

  console.log('====================================================================');
  console.log('✅ TẤT CẢ 7 HẠNG MỤC KIỂM THỬ E2E ĐỀU VƯỢT QUA 100%!');
  console.log('====================================================================');
}

runVerificationSuite().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
