import { getDb } from '../db/database.mjs';
import { gradeSingleQuestion } from './gradingService.mjs';
import { recordValidSubmissionActivity, getVnDateString } from './activityAndLeaderboardService.mjs';

/**
 * Tạo đề thi (ở trạng thái DRAFT hoặc PUBLISHED nếu tất cả câu hỏi đã verified)
 * từ dữ liệu JSON do Gemini AI chuyển đổi từ PDF
 */
export function createExamFromAiExtraction({
  title,
  description = '',
  examType = 'EXAM',
  subjectId = null,
  chapterId = null,
  lessonId = null,
  pdfDocumentId = null,
  defaultDurationMinutes = 45,
  allowUnlimitedTime = true,
  allowReview = true,
  questions = [],
  createdBy = 1,
  publishImmediately = false,
}) {
  const db = getDb();

  const needsReviewQuestions = questions.filter(
    (q) => q.needs_review || q.status === 'NEEDS_REVIEW'
  );

  // Nguyên tắc bắt buộc: Không cho phép xuất bản (PUBLISHED) nếu còn câu hỏi NEEDS_REVIEW
  let initialStatus = 'DRAFT';
  if (publishImmediately) {
    if (needsReviewQuestions.length > 0) {
      throw new Error(
        `Không thể xuất bản đề thi ngay vì còn ${needsReviewQuestions.length} câu hỏi đang ở trạng thái NEEDS_REVIEW (Câu: ${needsReviewQuestions
          .map((q) => q.question_number)
          .join(', ')}). Vui lòng kiểm tra và xác nhận đáp án trước khi xuất bản.`
      );
    }
    initialStatus = 'PUBLISHED';
  }

  const totalPoints = Number(
    questions.reduce((acc, q) => acc + Number(q.points || 0.25), 0).toFixed(2)
  );

  const examInsert = db.prepare(`
    INSERT INTO exams (
      title, description, exam_type, subject_id, chapter_id, lesson_id,
      pdf_document_id, default_duration_minutes, allow_unlimited_time,
      allow_review, total_points, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description,
    examType,
    subjectId || null,
    chapterId || null,
    lessonId || null,
    pdfDocumentId || null,
    Number(defaultDurationMinutes || 45),
    allowUnlimitedTime ? 1 : 0,
    allowReview ? 1 : 0,
    totalPoints > 0 ? totalPoints : 10,
    initialStatus,
    createdBy
  );

  const examId = Number(examInsert.lastInsertRowid);

  if (pdfDocumentId) {
    db.prepare(`
      INSERT OR IGNORE INTO exam_pdf_links (exam_id, pdf_document_id)
      VALUES (?, ?)
    `).run(examId, pdfDocumentId);
  }

  insertQuestionsForExam(examId, questions);

  return getExamFullDetailForAdmin(examId);
}

/**
 * Lưu danh sách câu hỏi, phương án lựa chọn và đáp án vào Database
 */
export function insertQuestionsForExam(examId, questions = []) {
  const db = getDb();

  const insertQ = db.prepare(`
    INSERT INTO questions (
      exam_id, question_number, question_type, content, image_url,
      images_json, svg_diagram, source_page, figure_bbox, points,
      order_index, confidence, status, needs_review, review_reason, explanation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOpt = db.prepare(`
    INSERT INTO question_options (question_id, option_key, content, image_url, order_index)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAns = db.prepare(`
    INSERT INTO correct_answers (question_id, answer_key, short_answer_value, equivalent_answers, explanation)
    VALUES (?, ?, ?, ?, ?)
  `);

  questions.forEach((q, idx) => {
    const qNumber = Number(q.question_number || idx + 1);
    const rawType = String(q.db_question_type || q.question_type || 'MULTIPLE_CHOICE').toUpperCase();
    const qType =
      rawType.includes('TRUE_FALSE') || rawType === 'TF'
        ? 'TRUE_FALSE'
        : rawType.includes('SHORT') || rawType === 'SA'
        ? 'SHORT_ANSWER'
        : 'MULTIPLE_CHOICE';

    const isNeedsReview = Boolean(q.needs_review || q.status === 'NEEDS_REVIEW');
    const qStatus = isNeedsReview ? 'NEEDS_REVIEW' : 'verified';
    const imagesArr = Array.isArray(q.images) ? q.images : [];
    const primaryImageUrl = q.image_url || (imagesArr[0]?.image_url ?? null);
    const bboxJson =
      q.figure_bbox
        ? typeof q.figure_bbox === 'string'
          ? q.figure_bbox
          : JSON.stringify(q.figure_bbox)
        : imagesArr[0]?.bbox
        ? JSON.stringify({ page: imagesArr[0].page || q.source_page || 1, bbox: imagesArr[0].bbox })
        : null;

    const qRes = insertQ.run(
      examId,
      qNumber,
      qType,
      String(q.content || '').trim(),
      primaryImageUrl,
      JSON.stringify(imagesArr),
      q.svg_diagram || null,
      Number(q.source_page || 1),
      bboxJson,
      Number(q.points || (qType === 'MULTIPLE_CHOICE' ? 0.25 : qType === 'TRUE_FALSE' ? 1.0 : 0.5)),
      Number(q.order_index || idx + 1),
      Number(q.confidence ?? 0.98),
      qStatus,
      isNeedsReview ? 1 : 0,
      q.review_reason || null,
      q.explanation || ''
    );

    const questionId = Number(qRes.lastInsertRowid);

    if (qType === 'MULTIPLE_CHOICE') {
      const opts = q.options || {};
      ['A', 'B', 'C', 'D'].forEach((key, oIdx) => {
        insertOpt.run(questionId, key, String(opts[key] || ''), null, oIdx + 1);
      });
      const ansKey = String(q.correct_answer || '').trim().toUpperCase();
      insertAns.run(questionId, ansKey, null, '[]', q.explanation || '');
    } else if (qType === 'TRUE_FALSE') {
      const stmts = q.statements || {};
      const tfAnsMap = {};
      ['a', 'b', 'c', 'd'].forEach((key, oIdx) => {
        const item = stmts[key] || {};
        const contentStr = typeof item === 'string' ? item : String(item.content || '');
        insertOpt.run(questionId, key, contentStr, null, oIdx + 1);
        if (typeof item === 'object' && typeof item.correct === 'boolean') {
          tfAnsMap[key] = item.correct;
        }
      });
      if (typeof q.correct_answer === 'object' && q.correct_answer !== null) {
        Object.assign(tfAnsMap, q.correct_answer);
      } else if (typeof q.correct_answer === 'string' && q.correct_answer.startsWith('{')) {
        try {
          Object.assign(tfAnsMap, JSON.parse(q.correct_answer));
        } catch {
          // ignore
        }
      }
      insertAns.run(questionId, JSON.stringify(tfAnsMap), null, '[]', q.explanation || '');
    } else if (qType === 'SHORT_ANSWER') {
      const shortVal = String(q.correct_answer ?? '').trim();
      const eqArr = Array.isArray(q.equivalent_answers)
        ? q.equivalent_answers
        : shortVal
        ? [shortVal]
        : [];
      insertAns.run(questionId, shortVal, shortVal, JSON.stringify(eqArr), q.explanation || '');
    }
  });

  recalculateExamTotalPoints(examId);
}

export function recalculateExamTotalPoints(examId) {
  const db = getDb();
  const sumRow = db
    .prepare('SELECT COALESCE(ROUND(SUM(points), 2), 0) as total FROM questions WHERE exam_id = ?')
    .get(examId);
  db.prepare("UPDATE exams SET total_points = ?, updated_at = datetime('now') WHERE id = ?").run(
    sumRow.total > 0 ? sumRow.total : 10,
    examId
  );
}

/**
 * Lấy chi tiết đầy đủ của Đề thi dành cho Admin (bao gồm đáp án, trạng thái NEEDS_REVIEW, PDF gốc)
 */
export function getExamFullDetailForAdmin(examId) {
  const db = getDb();
  const exam = db
    .prepare(
      `SELECT e.*,
              s.name as subject_name, s.grade as subject_grade,
              c.name as chapter_name,
              l.name as lesson_name,
              p.title as pdf_title, p.file_name as pdf_file_name, p.page_count as pdf_page_count
       FROM exams e
       LEFT JOIN subjects s ON e.subject_id = s.id
       LEFT JOIN chapters c ON e.chapter_id = c.id
       LEFT JOIN lessons l ON e.lesson_id = l.id
       LEFT JOIN pdf_documents p ON e.pdf_document_id = p.id
       WHERE e.id = ?`
    )
    .get(examId);

  if (!exam) return null;

  const qRows = db
    .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC')
    .all(examId);

  const questions = qRows.map((q) => {
    const opts = db
      .prepare('SELECT * FROM question_options WHERE question_id = ? ORDER BY order_index ASC')
      .all(q.id);
    const ans = db.prepare('SELECT * FROM correct_answers WHERE question_id = ?').get(q.id);

    let images = [];
    try {
      images = JSON.parse(q.images_json || '[]');
    } catch {
      images = [];
    }

    let optionsMap = {};
    let statementsMap = {};
    if (q.question_type === 'MULTIPLE_CHOICE') {
      for (const o of opts) optionsMap[o.option_key] = o.content;
    } else if (q.question_type === 'TRUE_FALSE') {
      let tfCorrect = {};
      try {
        tfCorrect = JSON.parse(ans?.answer_key || '{}');
      } catch {
        tfCorrect = {};
      }
      for (const o of opts) {
        statementsMap[o.option_key] = {
          content: o.content,
          correct: tfCorrect[o.option_key] ?? null,
        };
      }
    }

    let eqAnswers = [];
    try {
      eqAnswers = JSON.parse(ans?.equivalent_answers || '[]');
    } catch {
      eqAnswers = [];
    }

    return {
      id: q.id,
      examId: q.exam_id,
      questionNumber: q.question_number,
      questionType: q.question_type,
      content: q.content,
      imageUrl: q.image_url,
      images,
      svgDiagram: q.svg_diagram,
      sourcePage: q.source_page,
      figureBbox: q.figure_bbox,
      points: q.points,
      orderIndex: q.order_index,
      confidence: q.confidence,
      status: q.status,
      needsReview: Boolean(q.needs_review),
      reviewReason: q.review_reason,
      explanation: q.explanation || ans?.explanation || '',
      options: optionsMap,
      statements: statementsMap,
      correctAnswer:
        q.question_type === 'TRUE_FALSE'
          ? (() => {
              try {
                return JSON.parse(ans?.answer_key || '{}');
              } catch {
                return {};
              }
            })()
          : q.question_type === 'SHORT_ANSWER'
          ? ans?.short_answer_value || ans?.answer_key || ''
          : ans?.answer_key || '',
      equivalentAnswers: eqAnswers,
    };
  });

  const needsReviewCount = questions.filter((q) => q.needsReview).length;

  return {
    ...exam,
    allowUnlimitedTime: Boolean(exam.allow_unlimited_time),
    allowReview: Boolean(exam.allow_review),
    needsReviewCount,
    canPublish: needsReviewCount === 0 && questions.length > 0,
    questions,
  };
}

/**
 * Kiểm tra và tự động nộp bài nếu lượt làm bài đang diễn ra đã hết thời gian trên Server
 */
export function checkAndEnforceServerTimer(attemptId) {
  const db = getDb();
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId);
  if (!attempt) return null;

  if (attempt.status === 'IN_PROGRESS' && attempt.expires_at) {
    const expiresMs = new Date(attempt.expires_at).getTime();
    const nowMs = Date.now();
    if (nowMs >= expiresMs) {
      // Hết thời gian trên Server -> Tự động chấm điểm và chuyển sang AUTO_SUBMITTED
      return finalizeAndGradeAttempt(attempt.id, true);
    }
  }
  return attempt;
}

/**
 * Bắt đầu hoặc tiếp tục một lượt làm bài thi (Kiểm soát thời gian chặt chẽ ở Backend)
 */
export function startOrResumeExamAttempt({ examId, userId, selectedDurationMinutes }) {
  const db = getDb();
  const exam = db
    .prepare("SELECT * FROM exams WHERE id = ? AND status = 'PUBLISHED'")
    .get(examId);

  if (!exam) {
    throw new Error('Đề thi không tồn tại hoặc chưa được công bố.');
  }

  // Kiểm tra xem học sinh có lượt làm bài nào đang IN_PROGRESS cho đề này không
  const existingInProgress = db
    .prepare(
      `SELECT * FROM exam_attempts
       WHERE exam_id = ? AND user_id = ? AND status = 'IN_PROGRESS'
       ORDER BY id DESC LIMIT 1`
    )
    .get(examId, userId);

  if (existingInProgress) {
    const checked = checkAndEnforceServerTimer(existingInProgress.id);
    if (checked.status === 'IN_PROGRESS') {
      return getActiveAttemptPayloadForStudent(checked.id, userId);
    }
  }

  // Xác định thời gian làm bài hợp lệ
  let duration =
    selectedDurationMinutes !== undefined && selectedDurationMinutes !== null
      ? Number(selectedDurationMinutes)
      : Number(exam.default_duration_minutes || 45);

  if (duration === 0 && !exam.allow_unlimited_time) {
    duration = Number(exam.default_duration_minutes || 45);
  }

  const nowIso = new Date().toISOString();
  const expiresIso =
    duration > 0 ? new Date(Date.now() + duration * 60 * 1000).toISOString() : null;

  const ins = db
    .prepare(
      `INSERT INTO exam_attempts (
         exam_id, user_id, selected_duration_minutes, started_at, expires_at, status, max_score
       ) VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', ?)`
    )
    .run(examId, userId, duration, nowIso, expiresIso, exam.total_points || 10);

  const attemptId = Number(ins.lastInsertRowid);
  return getActiveAttemptPayloadForStudent(attemptId, userId);
}

/**
 * Trả về dữ liệu bài thi đang làm cho Học sinh (Tuyệt đối KHÔNG trả về correct_answers!)
 */
export function getActiveAttemptPayloadForStudent(attemptId, userId) {
  const db = getDb();
  const attempt = checkAndEnforceServerTimer(attemptId);
  if (!attempt || attempt.user_id !== userId) {
    throw new Error('Không tìm thấy lượt làm bài hợp lệ.');
  }

  const exam = db
    .prepare(
      `SELECT e.*, p.file_name as pdf_file_name, p.title as pdf_title
       FROM exams e
       LEFT JOIN pdf_documents p ON e.pdf_document_id = p.id
       WHERE e.id = ?`
    )
    .get(attempt.exam_id);

  const qRows = db
    .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC')
    .all(attempt.exam_id);

  const savedAnswers = db
    .prepare('SELECT * FROM student_answers WHERE attempt_id = ?')
    .all(attemptId);
  const ansByQId = {};
  for (const sa of savedAnswers) {
    ansByQId[sa.question_id] = sa;
  }

  const questionsForStudent = qRows.map((q) => {
    const opts = db
      .prepare(
        'SELECT option_key, content, image_url FROM question_options WHERE question_id = ? ORDER BY order_index ASC'
      )
      .all(q.id);
    const saved = ansByQId[q.id];
    let images = [];
    try {
      images = JSON.parse(q.images_json || '[]');
    } catch {
      images = [];
    }

    let tfSaved = {};
    if (saved?.tf_answers) {
      try {
        tfSaved = JSON.parse(saved.tf_answers);
      } catch {
        tfSaved = {};
      }
    }

    return {
      id: q.id,
      questionNumber: q.question_number,
      questionType: q.question_type,
      content: q.content,
      imageUrl: q.image_url,
      images,
      svgDiagram: q.svg_diagram,
      sourcePage: q.source_page,
      points: q.points,
      options: opts,
      studentDraft: {
        selectedOption: saved?.selected_option || '',
        tfAnswers: tfSaved,
        shortAnswer: saved?.short_answer || '',
        isFlagged: Boolean(saved?.is_flagged),
        isAnswered: Boolean(saved?.is_answered),
      },
    };
  });

  const remainingSeconds = attempt.expires_at
    ? Math.max(0, Math.floor((new Date(attempt.expires_at).getTime() - Date.now()) / 1000))
    : null;

  return {
    attempt: {
      id: attempt.id,
      examId: attempt.exam_id,
      status: attempt.status,
      selectedDurationMinutes: attempt.selected_duration_minutes,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      remainingSeconds,
      serverNow: new Date().toISOString(),
    },
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      examType: exam.exam_type,
      totalPoints: exam.total_points,
      pdfDocumentId: exam.pdf_document_id,
      pdfTitle: exam.pdf_title || exam.pdf_file_name,
    },
    questions: questionsForStudent,
  };
}

/**
 * Lưu câu trả lời nháp của học sinh trong quá trình làm bài (có kiểm tra thời gian Server)
 */
export function saveStudentAnswerDraft({ attemptId, userId, answers = [] }) {
  const db = getDb();
  const attempt = checkAndEnforceServerTimer(attemptId);
  if (!attempt || attempt.user_id !== userId) {
    throw new Error('Lượt làm bài không hợp lệ.');
  }
  if (attempt.status !== 'IN_PROGRESS') {
    return {
      expiredOrSubmitted: true,
      status: attempt.status,
      attemptId: attempt.id,
    };
  }

  const upsertDraft = db.prepare(`
    INSERT INTO student_answers (
      attempt_id, question_id, selected_option, tf_answers, short_answer, is_flagged, is_answered, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(attempt_id, question_id) DO UPDATE SET
      selected_option = excluded.selected_option,
      tf_answers = excluded.tf_answers,
      short_answer = excluded.short_answer,
      is_flagged = excluded.is_flagged,
      is_answered = excluded.is_answered,
      updated_at = datetime('now')
  `);

  for (const item of answers) {
    if (!item || !item.questionId) continue;
    const selOpt = item.selectedOption ? String(item.selectedOption).trim().toUpperCase() : null;
    const tfStr =
      item.tfAnswers && typeof item.tfAnswers === 'object'
        ? JSON.stringify(item.tfAnswers)
        : typeof item.tfAnswers === 'string'
        ? item.tfAnswers
        : null;
    const shortStr =
      item.shortAnswer !== undefined && item.shortAnswer !== null
        ? String(item.shortAnswer).trim()
        : null;

    const hasTf =
      item.tfAnswers &&
      typeof item.tfAnswers === 'object' &&
      ['a', 'b', 'c', 'd'].some((k) => item.tfAnswers[k] === true || item.tfAnswers[k] === false);

    const isAnswered = Boolean(selOpt || hasTf || (shortStr && shortStr.length > 0));

    upsertDraft.run(
      attemptId,
      Number(item.questionId),
      selOpt,
      tfStr,
      shortStr,
      item.isFlagged ? 1 : 0,
      isAnswered ? 1 : 0
    );
  }

  const remainingSeconds = attempt.expires_at
    ? Math.max(0, Math.floor((new Date(attempt.expires_at).getTime() - Date.now()) / 1000))
    : null;

  return {
    expiredOrSubmitted: false,
    status: 'IN_PROGRESS',
    remainingSeconds,
  };
}

/**
 * Hoàn tất lượt làm bài, chấm điểm tự động dựa trên quy tắc xác định và lưu vào Database
 */
export function finalizeAndGradeAttempt(attemptId, isAutoSubmitted = false, finalAnswersPayload = null, userId = null) {
  const db = getDb();
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId);
  if (!attempt) {
    throw new Error('Không tìm thấy lượt làm bài.');
  }
  if (userId && attempt.user_id !== userId) {
    throw new Error('Bạn không có quyền nộp bài của học sinh khác.');
  }

  // Nếu đã nộp rồi thì trả về kết quả luôn (Idempotent)
  if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
    return getAttemptResultDetail(attempt.id, attempt.user_id);
  }

  // Nếu có gửi kèm danh sách câu trả lời cuối cùng lúc bấm Nộp bài, lưu lại trước khi chấm
  if (Array.isArray(finalAnswersPayload) && finalAnswersPayload.length > 0) {
    const upsertFinal = db.prepare(`
      INSERT INTO student_answers (
        attempt_id, question_id, selected_option, tf_answers, short_answer, is_flagged, is_answered, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(attempt_id, question_id) DO UPDATE SET
        selected_option = excluded.selected_option,
        tf_answers = excluded.tf_answers,
        short_answer = excluded.short_answer,
        is_flagged = excluded.is_flagged,
        is_answered = excluded.is_answered,
        updated_at = datetime('now')
    `);

    for (const item of finalAnswersPayload) {
      if (!item || !item.questionId) continue;
      const selOpt = item.selectedOption ? String(item.selectedOption).trim().toUpperCase() : null;
      const tfStr =
        item.tfAnswers && typeof item.tfAnswers === 'object'
          ? JSON.stringify(item.tfAnswers)
          : typeof item.tfAnswers === 'string'
          ? item.tfAnswers
          : null;
      const shortStr =
        item.shortAnswer !== undefined && item.shortAnswer !== null
          ? String(item.shortAnswer).trim()
          : null;
      const hasTf =
        item.tfAnswers &&
        typeof item.tfAnswers === 'object' &&
        ['a', 'b', 'c', 'd'].some((k) => item.tfAnswers[k] === true || item.tfAnswers[k] === false);
      const isAnswered = Boolean(selOpt || hasTf || (shortStr && shortStr.length > 0));

      upsertFinal.run(
        attemptId,
        Number(item.questionId),
        selOpt,
        tfStr,
        shortStr,
        item.isFlagged ? 1 : 0,
        isAnswered ? 1 : 0
      );
    }
  }

  const questions = db
    .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC')
    .all(attempt.exam_id);

  const savedAnswers = db
    .prepare('SELECT * FROM student_answers WHERE attempt_id = ?')
    .all(attemptId);
  const savedMap = {};
  for (const sa of savedAnswers) savedMap[sa.question_id] = sa;

  let rawEarnedPoints = 0;
  let rawMaxPoints = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;

  const upsertGradedAnswer = db.prepare(`
    INSERT INTO student_answers (
      attempt_id, question_id, selected_option, tf_answers, short_answer,
      is_flagged, is_answered, is_correct, earned_points, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(attempt_id, question_id) DO UPDATE SET
      is_answered = excluded.is_answered,
      is_correct = excluded.is_correct,
      earned_points = excluded.earned_points,
      updated_at = datetime('now')
  `);

  for (const q of questions) {
    const qPoints = Number(q.points || 0.25);
    rawMaxPoints += qPoints;
    const correctRow = db.prepare('SELECT * FROM correct_answers WHERE question_id = ?').get(q.id);
    const saved = savedMap[q.id];

    const gradeRes = gradeSingleQuestion(q, correctRow, {
      selectedOption: saved?.selected_option,
      tfAnswers: saved?.tf_answers,
      shortAnswer: saved?.short_answer,
    });

    if (!gradeRes.isAnswered) {
      blankCount++;
    } else if (gradeRes.isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }

    rawEarnedPoints += gradeRes.earnedPoints;

    upsertGradedAnswer.run(
      attemptId,
      q.id,
      saved?.selected_option || null,
      saved?.tf_answers || null,
      saved?.short_answer || null,
      saved?.is_flagged || 0,
      gradeRes.isAnswered ? 1 : 0,
      gradeRes.isCorrect ? 1 : 0,
      gradeRes.earnedPoints
    );
  }

  // Quy đổi về thang điểm 10 chuẩn (hoặc giữ nguyên nếu tổng điểm đề là 10)
  const scaledScore =
    rawMaxPoints > 0 ? Number(((rawEarnedPoints / rawMaxPoints) * 10).toFixed(2)) : 0;

  const finalStatus = isAutoSubmitted ? 'AUTO_SUBMITTED' : 'SUBMITTED';
  const submittedAtIso = new Date().toISOString();

  db.prepare(`
    UPDATE exam_attempts
    SET submitted_at = ?,
        status = ?,
        total_score = ?,
        max_score = 10,
        correct_count = ?,
        wrong_count = ?,
        blank_count = ?
    WHERE id = ?
  `).run(
    submittedAtIso,
    finalStatus,
    scaledScore,
    correctCount,
    wrongCount,
    blankCount,
    attemptId
  );

  // Ghi nhận vào LearningActivities (GitHub Graph) và Leaderboard
  recordValidSubmissionActivity(attempt.user_id, scaledScore, getVnDateString(new Date(submittedAtIso)));

  return getAttemptResultDetail(attemptId, attempt.user_id, 'STUDENT');
}

/**
 * Xem chi tiết kết quả lượt làm bài (Hỗ trợ cấu hình cho phép xem đáp án của Admin)
 */
export function getAttemptResultDetail(attemptId, viewerUserId, viewerRole = 'STUDENT') {
  const db = getDb();
  const attempt = checkAndEnforceServerTimer(attemptId);
  if (!attempt) {
    throw new Error('Không tìm thấy kết quả bài thi.');
  }
  if (viewerRole !== 'ADMIN' && attempt.user_id !== viewerUserId) {
    throw new Error('Bạn không có quyền xem kết quả bài thi của người khác.');
  }

  const exam = db
    .prepare(
      `SELECT e.*,
              s.name as subject_name,
              c.name as chapter_name,
              l.name as lesson_name,
              p.file_name as pdf_file_name,
              p.title as pdf_title
       FROM exams e
       LEFT JOIN subjects s ON e.subject_id = s.id
       LEFT JOIN chapters c ON e.chapter_id = c.id
       LEFT JOIN lessons l ON e.lesson_id = l.id
       LEFT JOIN pdf_documents p ON e.pdf_document_id = p.id
       WHERE e.id = ?`
    )
    .get(attempt.exam_id);

  const student = db
    .prepare('SELECT id, username, full_name, class_name FROM users WHERE id = ?')
    .get(attempt.user_id);

  const canSeeAnswers = viewerRole === 'ADMIN' || Boolean(exam?.allow_review);

  const qRows = db
    .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC')
    .all(attempt.exam_id);

  const saRows = db
    .prepare('SELECT * FROM student_answers WHERE attempt_id = ?')
    .all(attemptId);
  const saMap = {};
  for (const sa of saRows) saMap[sa.question_id] = sa;

  const questionReviews = qRows.map((q) => {
    const opts = db
      .prepare('SELECT option_key, content, image_url FROM question_options WHERE question_id = ? ORDER BY order_index ASC')
      .all(q.id);
    const ans = db.prepare('SELECT * FROM correct_answers WHERE question_id = ?').get(q.id);
    const sa = saMap[q.id];

    let images = [];
    try {
      images = JSON.parse(q.images_json || '[]');
    } catch {
      images = [];
    }

    let studentTf = {};
    if (sa?.tf_answers) {
      try {
        studentTf = JSON.parse(sa.tf_answers);
      } catch {
        studentTf = {};
      }
    }

    let correctTf = {};
    if (q.question_type === 'TRUE_FALSE' && ans?.answer_key) {
      try {
        correctTf = JSON.parse(ans.answer_key);
      } catch {
        correctTf = {};
      }
    }

    let eqAnswers = [];
    if (ans?.equivalent_answers) {
      try {
        eqAnswers = JSON.parse(ans.equivalent_answers);
      } catch {
        eqAnswers = [];
      }
    }

    return {
      questionId: q.id,
      questionNumber: q.question_number,
      questionType: q.question_type,
      content: q.content,
      imageUrl: q.image_url,
      images,
      svgDiagram: q.svg_diagram,
      sourcePage: q.source_page,
      points: q.points,
      options: opts,
      isAnswered: Boolean(sa?.is_answered),
      isCorrect: Boolean(sa?.is_correct),
      earnedPoints: Number(sa?.earned_points || 0),
      studentAnswer: {
        selectedOption: sa?.selected_option || null,
        tfAnswers: studentTf,
        shortAnswer: sa?.short_answer || null,
      },
      correctAnswer: canSeeAnswers
        ? {
            answerKey: q.question_type === 'TRUE_FALSE' ? correctTf : ans?.answer_key || null,
            shortAnswerValue: ans?.short_answer_value || ans?.answer_key || null,
            equivalentAnswers: eqAnswers,
            explanation: q.explanation || ans?.explanation || '',
          }
        : null,
    };
  });

  const durationSpentSeconds =
    attempt.submitted_at && attempt.started_at
      ? Math.max(
          1,
          Math.floor(
            (new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000
          )
        )
      : 0;

  return {
    attempt: {
      id: attempt.id,
      examId: attempt.exam_id,
      userId: attempt.user_id,
      studentName: student?.full_name,
      className: student?.class_name,
      selectedDurationMinutes: attempt.selected_duration_minutes,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      durationSpentSeconds,
      status: attempt.status,
      totalScore: attempt.total_score,
      maxScore: attempt.max_score,
      correctCount: attempt.correct_count,
      wrongCount: attempt.wrong_count,
      blankCount: attempt.blank_count,
    },
    exam: {
      id: exam?.id,
      title: exam?.title,
      examType: exam?.exam_type,
      subjectName: exam?.subject_name,
      chapterName: exam?.chapter_name,
      lessonName: exam?.lesson_name,
      pdfDocumentId: exam?.pdf_document_id,
      pdfTitle: exam?.pdf_title || exam?.pdf_file_name,
      allowReview: canSeeAnswers,
    },
    questions: questionReviews,
  };
}

