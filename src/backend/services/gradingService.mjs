/**
 * Chuẩn hóa chuỗi câu trả lời ngắn để so sánh chính xác toán học:
 * - Xóa khoảng trắng thừa
 * - Đưa dấu phẩy thập phân ',' về dấu chấm '.' (ví dụ: "0,5" -> "0.5")
 * - Chuẩn hóa dấu trừ unicode '−' về '-'
 * - So sánh giá trị số học tương đương (ví dụ: "24.0" == "24", "1/2" == "0.5")
 */
export function normalizeShortAnswerString(raw) {
  if (raw === null || raw === undefined) return '';
  let str = String(raw)
    .trim()
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.');
  return str.toLowerCase();
}

export function parseNumericValue(normStr) {
  if (!normStr) return null;
  // Kiểm tra dạng phân số a/b
  if (/^[+-]?\d+(\.\d+)?\/[+-]?\d+(\.\d+)?$/.test(normStr)) {
    const [num, den] = normStr.split('/').map(Number);
    if (den !== 0 && !Number.isNaN(num) && !Number.isNaN(den)) {
      return num / den;
    }
  }
  if (/^[+-]?\d+(\.\d+)?$/.test(normStr)) {
    const val = Number(normStr);
    if (!Number.isNaN(val)) return val;
  }
  return null;
}

/**
 * So khớp câu trả lời ngắn của học sinh với đáp án chuẩn và danh sách đáp án tương đương
 */
export function isShortAnswerMatch(studentRaw, standardRaw, equivalentList = []) {
  const normStudent = normalizeShortAnswerString(studentRaw);
  if (!normStudent) return false;

  const candidates = [standardRaw, ...(Array.isArray(equivalentList) ? equivalentList : [])]
    .map(normalizeShortAnswerString)
    .filter(Boolean);

  // 1. So khớp chuỗi đã chuẩn hóa trực tiếp
  if (candidates.includes(normStudent)) {
    return true;
  }

  // 2. So khớp giá trị số tương đương (ví dụ 0,5 == 0.5 == .5 == 0.50)
  const studentNum = parseNumericValue(normStudent);
  if (studentNum !== null) {
    for (const cand of candidates) {
      const candNum = parseNumericValue(cand);
      if (candNum !== null && Math.abs(studentNum - candNum) < 1e-9) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Chấm điểm xác định (Deterministic Grading) cho một câu hỏi
 * Nguyên tắc:
 * - Bỏ trống: 0 điểm
 * - Sai: 0 điểm
 * - Đúng: được điểm theo thang điểm của câu hỏi
 */
export function gradeSingleQuestion(question, correctAnswerRow, studentSubmission) {
  const qType = (question.question_type || 'MULTIPLE_CHOICE').toUpperCase();
  const maxPoints = Number(question.points || 0.25);

  if (!studentSubmission) {
    return {
      isAnswered: false,
      isCorrect: false,
      earnedPoints: 0,
      detail: null,
    };
  }

  if (qType === 'MULTIPLE_CHOICE') {
    const selected = String(studentSubmission.selectedOption || '').trim().toUpperCase();
    if (!selected) {
      return { isAnswered: false, isCorrect: false, earnedPoints: 0, detail: null };
    }
    const correctKey = String(correctAnswerRow?.answer_key || '').trim().toUpperCase();
    const isCorrect = Boolean(correctKey && selected === correctKey);
    return {
      isAnswered: true,
      isCorrect,
      earnedPoints: isCorrect ? maxPoints : 0,
      detail: { selected, correctKey },
    };
  }

  if (qType === 'TRUE_FALSE') {
    let studentTf = {};
    if (typeof studentSubmission.tfAnswers === 'string' && studentSubmission.tfAnswers.trim()) {
      try {
        studentTf = JSON.parse(studentSubmission.tfAnswers);
      } catch {
        studentTf = {};
      }
    } else if (typeof studentSubmission.tfAnswers === 'object' && studentSubmission.tfAnswers !== null) {
      studentTf = studentSubmission.tfAnswers;
    }

    const keys = ['a', 'b', 'c', 'd'];
    const hasAnySelection = keys.some(
      (k) => studentTf[k] === true || studentTf[k] === false || studentTf[k] === 'true' || studentTf[k] === 'false'
    );

    if (!hasAnySelection) {
      return { isAnswered: false, isCorrect: false, earnedPoints: 0, detail: null };
    }

    let correctTf = {};
    if (correctAnswerRow?.answer_key) {
      try {
        correctTf =
          typeof correctAnswerRow.answer_key === 'string'
            ? JSON.parse(correctAnswerRow.answer_key)
            : correctAnswerRow.answer_key;
      } catch {
        correctTf = {};
      }
    }

    let matchedSubCount = 0;
    const subResults = {};
    for (const k of keys) {
      const sVal =
        studentTf[k] === true || studentTf[k] === 'true'
          ? true
          : studentTf[k] === false || studentTf[k] === 'false'
          ? false
          : null;
      const cVal =
        correctTf[k] === true || correctTf[k] === 'true'
          ? true
          : correctTf[k] === false || correctTf[k] === 'false'
          ? false
          : null;

      const subCorrect = sVal !== null && cVal !== null && sVal === cVal;
      if (subCorrect) matchedSubCount++;
      subResults[k] = { student: sVal, correct: cVal, isCorrect: subCorrect };
    }

    // Quy tắc tính điểm chuẩn Đúng/Sai THPT:
    // Đúng 1 ý: 10% điểm câu; Đúng 2 ý: 25% điểm câu; Đúng 3 ý: 50% điểm câu; Đúng cả 4 ý: 100% điểm câu
    const ratioMap = { 0: 0, 1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0 };
    const earnedPoints = Number((maxPoints * (ratioMap[matchedSubCount] || 0)).toFixed(4));
    const isFullCorrect = matchedSubCount === 4;

    return {
      isAnswered: true,
      isCorrect: isFullCorrect,
      earnedPoints,
      detail: { matchedSubCount, subResults },
    };
  }

  if (qType === 'SHORT_ANSWER') {
    const rawStudent = String(studentSubmission.shortAnswer ?? '').trim();
    if (!rawStudent) {
      return { isAnswered: false, isCorrect: false, earnedPoints: 0, detail: null };
    }

    const standardVal = String(correctAnswerRow?.short_answer_value || correctAnswerRow?.answer_key || '').trim();
    let eqList = [];
    if (correctAnswerRow?.equivalent_answers) {
      try {
        eqList = JSON.parse(correctAnswerRow.equivalent_answers);
      } catch {
        eqList = [];
      }
    }

    const isCorrect = isShortAnswerMatch(rawStudent, standardVal, eqList);
    return {
      isAnswered: true,
      isCorrect,
      earnedPoints: isCorrect ? maxPoints : 0,
      detail: { studentValue: rawStudent, standardValue: standardVal, equivalentAnswers: eqList },
    };
  }

  return { isAnswered: false, isCorrect: false, earnedPoints: 0, detail: null };
}

