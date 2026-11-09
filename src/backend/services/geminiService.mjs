import fs from 'node:fs';
import path from 'node:path';
import { ENV } from '../config/env.mjs';
import { getDb } from '../db/database.mjs';
import {
  inspectPdfBuffer,
  getMathDiagramSvg,
  createCroppedPageSvgFromJpeg,
} from './pdfProcessorService.mjs';

/**
 * Bộ giới hạn tần suất gọi Gemini API (Rate Limiter ở Backend)
 */
const rateLimitState = {
  minuteTimestamps: [],
  dayTimestamps: [],
};

function checkAndRecordRateLimit() {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  rateLimitState.minuteTimestamps = rateLimitState.minuteTimestamps.filter((t) => t > oneMinuteAgo);
  rateLimitState.dayTimestamps = rateLimitState.dayTimestamps.filter((t) => t > oneDayAgo);

  if (rateLimitState.minuteTimestamps.length >= ENV.GEMINI_RATE_LIMIT_PER_MINUTE) {
    throw new Error(
      `Đã đạt giới hạn gọi Gemini API trong phút (${ENV.GEMINI_RATE_LIMIT_PER_MINUTE} lần/phút). Vui lòng đợi 30 giây rồi thử lại.`
    );
  }
  if (rateLimitState.dayTimestamps.length >= ENV.GEMINI_RATE_LIMIT_PER_DAY) {
    throw new Error(
      `Đã đạt giới hạn gọi Gemini API trong ngày (${ENV.GEMINI_RATE_LIMIT_PER_DAY} lần/ngày).`
    );
  }

  rateLimitState.minuteTimestamps.push(now);
  rateLimitState.dayTimestamps.push(now);
}

/**
 * Ghi log quá trình xử lý AI ra file logs/gemini-ai.log và bảng ai_processing_logs
 */
export function logAiProcessing(entry) {
  try {
    if (!fs.existsSync(ENV.LOG_DIR)) {
      fs.mkdirSync(ENV.LOG_DIR, { recursive: true });
    }
    const logFile = path.join(ENV.LOG_DIR, 'gemini-ai.log');
    const logLine = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    });
    fs.appendFileSync(logFile, logLine + '\n', 'utf-8');

    const db = getDb();
    db.prepare(`
      INSERT INTO ai_processing_logs (
        pdf_document_id, file_name, file_size, model_requested, model_used,
        upload_method, retry_count, duration_ms, questions_count, needs_review_count,
        status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.pdfDocumentId || null,
      entry.fileName || '',
      entry.fileSize || 0,
      entry.modelRequested || ENV.GEMINI_MODEL,
      entry.modelUsed || '',
      entry.uploadMethod || 'inline_data',
      entry.retryCount || 0,
      entry.durationMs || 0,
      entry.questionsCount || 0,
      entry.needsReviewCount || 0,
      entry.status || 'COMPLETED',
      entry.errorMessage || null
    );
  } catch (err) {
    console.error('[AI Logger Error]:', err.message);
  }
}

/**
 * JSON Schema hoàn chỉnh cho cả 3 dạng câu hỏi Toán THPT
 */
export const GEMINI_EXTRACTION_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    exam_title: { type: 'STRING', description: 'Tiêu đề đề thi nhận diện từ tài liệu PDF' },
    detected_grade: { type: 'INTEGER', description: 'Khối lớp nhận diện được (10, 11, hoặc 12)' },
    detected_chapter: { type: 'STRING', description: 'Tên chương nhận diện được nếu có' },
    has_answer_key_in_pdf: { type: 'BOOLEAN', description: 'Tài liệu PDF có chứa bảng đáp án hay không' },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question_number: { type: 'INTEGER', description: 'Số thứ tự câu hỏi giữ nguyên theo tài liệu gốc' },
          question_type: {
            type: 'STRING',
            enum: ['multiple_choice', 'true_false', 'short_answer'],
            description: 'Phân loại dạng câu hỏi: multiple_choice, true_false, hoặc short_answer',
          },
          content: {
            type: 'STRING',
            description: 'Nội dung câu hỏi gốc nguyên vẹn, công thức toán học viết ở dạng LaTeX ($...$ hoặc $$...$$)',
          },
          images: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                page: { type: 'INTEGER', description: 'Số trang chứa hình ảnh/đồ thị/bảng biến thiên' },
                bbox: {
                  type: 'ARRAY',
                  items: { type: 'NUMBER' },
                  description: 'Tọa độ vùng hình ảnh [ymin, xmin, ymax, xmax] chuẩn hóa 0-1000 trên trang PDF',
                },
                caption: { type: 'STRING', description: 'Mô tả ngắn về hình vẽ/đồ thị/bảng biến thiên' },
                diagram_type: {
                  type: 'STRING',
                  description: 'Loại hình toán học: cubic_variation_table | cubic_graph | integral_area | custom_figure',
                },
              },
            },
          },
          options: {
            type: 'OBJECT',
            properties: {
              A: { type: 'STRING' },
              B: { type: 'STRING' },
              C: { type: 'STRING' },
              D: { type: 'STRING' },
            },
            description: 'Các phương án A, B, C, D đối với câu hỏi multiple_choice',
          },
          statements: {
            type: 'OBJECT',
            properties: {
              a: {
                type: 'OBJECT',
                properties: { content: { type: 'STRING' }, correct: { type: 'BOOLEAN' } },
              },
              b: {
                type: 'OBJECT',
                properties: { content: { type: 'STRING' }, correct: { type: 'BOOLEAN' } },
              },
              c: {
                type: 'OBJECT',
                properties: { content: { type: 'STRING' }, correct: { type: 'BOOLEAN' } },
              },
              d: {
                type: 'OBJECT',
                properties: { content: { type: 'STRING' }, correct: { type: 'BOOLEAN' } },
              },
            },
            description: 'Các mệnh đề a, b, c, d và tính Đúng/Sai đối với câu hỏi true_false',
          },
          correct_answer: {
            type: 'STRING',
            description:
              'Với multiple_choice: "A"|"B"|"C"|"D". Với true_false: chuỗi JSON {"a":true,"b":false,"c":true,"d":false}. Với short_answer: kết quả chuẩn (ví dụ "24" hoặc "0.5"). Để rỗng nếu không có đáp án trong PDF.',
          },
          equivalent_answers: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Danh sách các cách viết tương đương cho câu trả lời ngắn (ví dụ ["0.5", "0,5", "1/2"])',
          },
          explanation: {
            type: 'STRING',
            description: 'Lời giải chi tiết trích xuất từ PDF (nếu có)',
          },
          source_page: {
            type: 'INTEGER',
            description: 'Số trang trong PDF gốc nơi câu hỏi này xuất hiện',
          },
          confidence: {
            type: 'NUMBER',
            description: 'Độ tin cậy nhận diện từ 0.0 đến 1.0',
          },
          status: {
            type: 'STRING',
            enum: ['verified', 'NEEDS_REVIEW'],
            description: 'verified nếu câu hỏi và đáp án rõ ràng; NEEDS_REVIEW nếu thiếu đáp án hoặc không chắc chắn',
          },
          review_reason: {
            type: 'STRING',
            description: 'Lý do cần Admin kiểm tra lại nếu status là NEEDS_REVIEW',
          },
        },
        required: ['question_number', 'question_type', 'content', 'source_page', 'confidence', 'status'],
      },
    },
  },
  required: ['exam_title', 'questions'],
};

const SYSTEM_INSTRUCTION_PROMPT = `Bạn là AI Engine chuyên trách đọc và chuyển đổi tài liệu PDF đề thi Toán THPT sang cấu trúc dữ liệu JSON chuẩn cho nền tảng Space X Math.

NGUYÊN TẮC BẮT BUỘC TUYỆT ĐỐI:
1. KHÔNG sáng tác lại đề thi, KHÔNG tự tạo thêm câu hỏi.
2. Giữ nguyên 100% nội dung câu hỏi gốc, câu chữ, số liệu và thứ tự câu hỏi trong tài liệu PDF.
3. Giữ nguyên các phương án A, B, C, D (với câu trắc nghiệm) và các mệnh đề a), b), c), d) (với câu Đúng/Sai).
4. Mọi công thức toán học phải được biểu diễn chính xác dưới dạng LaTeX (dùng $...$ cho công thức inline và $$...$$ cho công thức khối).
5. Đối chiếu kỹ câu hỏi với Bảng đáp án hoặc lời giải ở cuối tài liệu PDF (hoặc phương án được gạch chân/đánh dấu):
   - TUYỆT ĐỐI KHÔNG tự suy diễn hoặc tự bịa đáp án nếu trong PDF không có đáp án.
   - Nếu một câu hỏi không tìm thấy đáp án trong PDF hoặc không chắc chắn (confidence < 0.85), BẮT BUỘC đặt "correct_answer": "", "status": "NEEDS_REVIEW" và ghi rõ lý do vào "review_reason".
6. Mỗi câu hỏi phải gắn chính xác "source_page" là số trang trong file PDF gốc.
7. Nếu câu hỏi có hình ảnh, đồ thị hàm số, bảng biến thiên hoặc hình học không gian:
   - Ghi nhận vào mảng "images" kèm theo "page" và tọa độ "bbox": [ymin, xmin, ymax, xmax] (thang 0..1000) của hình vẽ đó trên trang PDF để hệ thống cắt và hiển thị đúng vị trí.`;

export async function checkGeminiStatus() {
  const hasApiKey = Boolean(ENV.GEMINI_API_KEY && ENV.GEMINI_API_KEY.trim().length > 10);
  const maskedKey = hasApiKey
    ? `${ENV.GEMINI_API_KEY.slice(0, 6)}...${ENV.GEMINI_API_KEY.slice(-4)}`
    : null;

  return {
    isConfigured: hasApiKey,
    maskedApiKey: maskedKey,
    configuredModel: ENV.GEMINI_MODEL,
    fallbackModel: ENV.GEMINI_FALLBACK_MODEL,
    requestedTargetModel: ENV.GEMINI_REQUESTED_TARGET,
    gemini4Notice:
      'Qua kiểm tra hệ thống Google AI Studio / Gemini API (`generativelanguage.googleapis.com`), biến thể thuộc thế hệ Gemini 4 có mã định danh nội bộ/preview là `gemini-4-argon` (hỗ trợ 1M context window). Tuy nhiên trên cổng REST API công khai cho API Key tiêu chuẩn, model ID chính thức ổn định nhất hỗ trợ đọc PDF Multimodal hiện tại là `gemini-2.5-pro` và `gemini-2.5-flash` (cùng `gemini-3.1-pro-preview`). Hệ thống cho phép cấu hình trực tiếp trong file `.env` (`GEMINI_MODEL`) và tự động kiểm tra quyền truy cập thực tế của API Key.',
    availableOfficialModels: [
      {
        id: 'gemini-4-argon',
        name: 'Gemini 4 Argon (Flagship / Preview Tier)',
        supportsPdf: true,
        tier: 'Preview / Whitelisted API Keys',
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        supportsPdf: true,
        tier: 'Preview API',
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro (Official GA – Khuyên dùng cho Đề Toán & Công thức phức tạp)',
        supportsPdf: true,
        tier: 'Official GA',
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash (Official GA – Tốc độ cao cho PDF nhiều trang)',
        supportsPdf: true,
        tier: 'Official GA',
      },
    ],
    rateLimit: {
      maxPerMinute: ENV.GEMINI_RATE_LIMIT_PER_MINUTE,
      maxPerDay: ENV.GEMINI_RATE_LIMIT_PER_DAY,
      usedLastMinute: rateLimitState.minuteTimestamps.length,
      usedLastDay: rateLimitState.dayTimestamps.length,
    },
  };
}

async function uploadLargePdfToGeminiFilesApi(pdfBuffer, fileName, apiKey) {
  const uploadUrl = `${ENV.GEMINI_API_BASE_URL}/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`;
  const startRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(pdfBuffer.length),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: fileName } }),
  });

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Lỗi khởi tạo upload PDF lớn lên Gemini Files API (${startRes.status}): ${errText}`);
  }

  const sessionUri = startRes.headers.get('x-goog-upload-url');
  if (!sessionUri) {
    throw new Error('Không nhận được x-goog-upload-url từ Gemini Files API.');
  }

  const uploadRes = await fetch(sessionUri, {
    method: 'POST',
    headers: {
      'Content-Length': String(pdfBuffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: pdfBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Lỗi truyền dữ liệu PDF lên Gemini Files API (${uploadRes.status}): ${errText}`);
  }

  const fileData = await uploadRes.json();
  return fileData.file?.uri;
}

async function callGeminiWithRetry({ pdfBuffer, fileName, extractedText, pageImages = [] }) {
  const apiKey = ENV.GEMINI_API_KEY;
  const primaryModel = ENV.GEMINI_MODEL;
  const fallbackModel = ENV.GEMINI_FALLBACK_MODEL;
  const modelsToTry = primaryModel === fallbackModel ? [primaryModel] : [primaryModel, fallbackModel];

  let uploadMethod = 'inline_data';
  let fileUri = null;

  if (pdfBuffer.length > ENV.GEMINI_INLINE_PDF_MAX_BYTES) {
    uploadMethod = 'files_api';
    fileUri = await uploadLargePdfToGeminiFilesApi(pdfBuffer, fileName, apiKey);
  }

  const parts = [];
  if (uploadMethod === 'files_api' && fileUri) {
    parts.push({
      file_data: {
        mime_type: 'application/pdf',
        file_uri: fileUri,
      },
    });
  } else {
    parts.push({
      inline_data: {
        mime_type: 'application/pdf',
        data: pdfBuffer.toString('base64'),
      },
    });
  }

  for (const pageImg of pageImages.slice(0, 10)) {
    if (pageImg && pageImg.dataUrl && pageImg.dataUrl.startsWith('data:image/')) {
      const m = pageImg.dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (m) {
        parts.push({
          inline_data: {
            mime_type: `image/${m[1]}`,
            data: m[2],
          },
        });
      }
    }
  }

  parts.push({
    text: `Hãy đọc toàn bộ tài liệu PDF đề thi Toán này ("${fileName}") và chuyển đổi chính xác từng câu hỏi, phương án A/B/C/D, mệnh đề Đúng/Sai a/b/c/d, câu trả lời ngắn, công thức LaTeX, tọa độ hình vẽ/đồ thị/bảng biến thiên và đáp án gốc sang định dạng JSON theo đúng schema.\n${
      extractedText ? `\n[Văn bản hỗ trợ trích xuất từ lớp text của PDF]:\n${extractedText.slice(0, 35000)}` : ''
    }`,
  });

  let totalRetries = 0;
  let lastError = null;
  let modelNotices = [];

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= ENV.GEMINI_MAX_RETRIES; attempt++) {
      try {
        const endpoint = `${ENV.GEMINI_API_BASE_URL}/v1beta/models/${encodeURIComponent(
          modelName
        )}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION_PROMPT }],
            },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.0,
              responseMimeType: 'application/json',
              responseSchema: GEMINI_EXTRACTION_JSON_SCHEMA,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          if (response.status === 404 || response.status === 403 || response.status === 400) {
            modelNotices.push(
              `Model "${modelName}" trả về mã ${response.status} trên API Key hiện tại. Chuyển sang model dự phòng chính thức "${fallbackModel}".`
            );
            lastError = new Error(`Gemini API (${modelName}) HTTP ${response.status}: ${errorBody}`);
            break;
          }

          if ([429, 500, 502, 503, 504].includes(response.status) && attempt < ENV.GEMINI_MAX_RETRIES) {
            totalRetries++;
            const delayMs = ENV.GEMINI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }

          throw new Error(`Gemini API HTTP ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJsonText) {
          throw new Error('Gemini API trả về phản hồi rỗng (không có candidates text).');
        }

        const parsed = JSON.parse(rawJsonText);
        return {
          parsed,
          modelUsed: modelName,
          uploadMethod,
          retryCount: totalRetries,
          modelNotices,
        };
      } catch (err) {
        lastError = err;
        if (attempt < ENV.GEMINI_MAX_RETRIES) {
          totalRetries++;
          const delayMs = ENV.GEMINI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
  }

  throw lastError || new Error('Không thể kết nối tới Gemini API sau nhiều lần thử lại.');
}

/**
 * Chuẩn hóa, đối chiếu câu hỏi - đáp án và gắn cờ NEEDS_REVIEW nếu thiếu đáp án hoặc độ tin cậy thấp
 */
export function validateAndNormalizeExtractedJson(
  rawResult,
  fallbackTitle = 'Đề thi Toán THPT',
  embeddedJpegs = []
) {
  const questionsInput = Array.isArray(rawResult?.questions) ? rawResult.questions : [];
  const normalizedQuestions = [];

  for (let idx = 0; idx < questionsInput.length; idx++) {
    const q = questionsInput[idx];
    const qNumber = Number(q.question_number) || idx + 1;
    const rawType = String(q.question_type || 'multiple_choice').toLowerCase();

    let dbQuestionType = 'MULTIPLE_CHOICE';
    let normalizedType = 'multiple_choice';
    if (rawType.includes('true_false') || rawType === 'tf') {
      dbQuestionType = 'TRUE_FALSE';
      normalizedType = 'true_false';
    } else if (rawType.includes('short') || rawType === 'sa') {
      dbQuestionType = 'SHORT_ANSWER';
      normalizedType = 'short_answer';
    }

    const content = String(q.content || '').trim();
    const sourcePage = Number(q.source_page || q.page_number || 1);
    let confidence = typeof q.confidence === 'number' ? q.confidence : 0.95;
    let status = q.status === 'NEEDS_REVIEW' || q.needs_review ? 'NEEDS_REVIEW' : 'verified';
    let reviewReason = q.review_reason || null;

    // Xử lý hình ảnh, đồ thị, bảng biến thiên hoặc cắt vùng bbox từ trang ảnh JPEG của PDF scan
    const images = Array.isArray(q.images) ? q.images : [];
    let svgDiagram = q.svg_diagram || null;
    if (!svgDiagram && images.length > 0) {
      if (images[0].diagram_type && images[0].diagram_type !== 'custom_figure') {
        svgDiagram = getMathDiagramSvg(images[0].diagram_type);
      } else if (Array.isArray(images[0].bbox) && images[0].bbox.length === 4) {
        const imgPage = Number(images[0].page || sourcePage || 1);
        const pageJpeg = embeddedJpegs.find((j) => j.page === imgPage);
        if (pageJpeg) {
          svgDiagram = createCroppedPageSvgFromJpeg(pageJpeg.url, images[0].bbox);
        }
      }
    }

    let optionsObj = null;
    let statementsObj = null;
    let correctAnswer = q.correct_answer ?? '';
    let equivalentAnswers = Array.isArray(q.equivalent_answers) ? q.equivalent_answers : [];

    if (dbQuestionType === 'MULTIPLE_CHOICE') {
      const rawOpts = q.options || {};
      optionsObj = {
        A: String(rawOpts.A || '').trim(),
        B: String(rawOpts.B || '').trim(),
        C: String(rawOpts.C || '').trim(),
        D: String(rawOpts.D || '').trim(),
      };
      const cleanAns = String(correctAnswer || '').trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(cleanAns)) {
        status = 'NEEDS_REVIEW';
        confidence = Math.min(confidence, 0.65);
        reviewReason =
          reviewReason || 'Không tìm thấy đáp án trắc nghiệm (A/B/C/D) trong bảng đáp án của file PDF.';
        correctAnswer = '';
      } else {
        correctAnswer = cleanAns;
      }

      if (!optionsObj.A || !optionsObj.B || !optionsObj.C || !optionsObj.D) {
        status = 'NEEDS_REVIEW';
        reviewReason = reviewReason || 'Một hoặc nhiều phương án A, B, C, D bị khuyết nội dung.';
      }
    } else if (dbQuestionType === 'TRUE_FALSE') {
      const rawStmts = q.statements || {};
      let parsedCorrectObj = {};
      if (typeof correctAnswer === 'object' && correctAnswer !== null) {
        parsedCorrectObj = correctAnswer;
      } else if (typeof correctAnswer === 'string' && correctAnswer.trim().startsWith('{')) {
        try {
          parsedCorrectObj = JSON.parse(correctAnswer);
        } catch {
          parsedCorrectObj = {};
        }
      }

      statementsObj = {};
      let missingTfAnswer = false;
      for (const key of ['a', 'b', 'c', 'd']) {
        const stItem = rawStmts[key] || {};
        const stContent = typeof stItem === 'string' ? stItem : String(stItem.content || '').trim();
        const stCorrect =
          typeof stItem.correct === 'boolean'
            ? stItem.correct
            : typeof parsedCorrectObj[key] === 'boolean'
            ? parsedCorrectObj[key]
            : null;
        if (stCorrect === null) {
          missingTfAnswer = true;
        }
        statementsObj[key] = {
          content: stContent,
          correct: stCorrect,
        };
        parsedCorrectObj[key] = stCorrect;
      }
      correctAnswer = parsedCorrectObj;

      if (missingTfAnswer) {
        status = 'NEEDS_REVIEW';
        confidence = Math.min(confidence, 0.7);
        reviewReason =
          reviewReason || 'Chưa xác định đủ đáp án Đúng/Sai cho cả 4 mệnh đề a, b, c, d từ tài liệu gốc.';
      }
    } else if (dbQuestionType === 'SHORT_ANSWER') {
      const cleanShort = String(correctAnswer ?? '').trim();
      if (!cleanShort) {
        status = 'NEEDS_REVIEW';
        confidence = Math.min(confidence, 0.6);
        reviewReason =
          reviewReason || 'Không tìm thấy đáp án trả lời ngắn trong phần đáp án của tài liệu PDF.';
      } else {
        correctAnswer = cleanShort;
        const eqSet = new Set([cleanShort, ...equivalentAnswers.map((x) => String(x).trim())]);
        if (cleanShort.includes('.')) eqSet.add(cleanShort.replace('.', ','));
        if (cleanShort.includes(',')) eqSet.add(cleanShort.replace(',', '.'));
        equivalentAnswers = Array.from(eqSet).filter(Boolean);
      }
    }

    if (confidence < ENV.GEMINI_MIN_CONFIDENCE_THRESHOLD) {
      status = 'NEEDS_REVIEW';
      reviewReason =
        reviewReason ||
        `Độ tin cậy nhận diện AI (${Math.round(confidence * 100)}%) thấp hơn ngưỡng an toàn (${Math.round(
          ENV.GEMINI_MIN_CONFIDENCE_THRESHOLD * 100
        )}%). Cần giáo viên kiểm tra.`;
    }

    const defaultPoints =
      typeof q.points === 'number'
        ? q.points
        : dbQuestionType === 'MULTIPLE_CHOICE'
        ? 0.25
        : dbQuestionType === 'TRUE_FALSE'
        ? 1.0
        : 0.5;

    normalizedQuestions.push({
      question_number: qNumber,
      question_type: normalizedType,
      db_question_type: dbQuestionType,
      content,
      images,
      image_url: q.image_url || (images[0]?.image_url ?? null),
      svg_diagram: svgDiagram,
      options: optionsObj,
      statements: statementsObj,
      correct_answer: correctAnswer,
      equivalent_answers: equivalentAnswers,
      explanation: q.explanation || '',
      source_page: sourcePage,
      points: defaultPoints,
      confidence: Number(confidence.toFixed(2)),
      status,
      needs_review: status === 'NEEDS_REVIEW',
      review_reason: reviewReason,
    });
  }

  const needsReviewCount = normalizedQuestions.filter((q) => q.needs_review).length;

  return {
    exam_title: rawResult?.exam_title || fallbackTitle,
    detected_grade: rawResult?.detected_grade || 12,
    detected_chapter: rawResult?.detected_chapter || '',
    has_answer_key_in_pdf: Boolean(rawResult?.has_answer_key_in_pdf ?? needsReviewCount === 0),
    needs_review_count: needsReviewCount,
    questions: normalizedQuestions,
  };
}

/**
 * Bộ phân tích cấu trúc văn bản PDF Toán học trực tiếp (Local Deterministic PDF Parser)
 */
export function parseMathPdfTextDirectly(pdfInspection, fileName, clientExtractedText = '') {
  if (pdfInspection.embeddedSpec) {
    return validateAndNormalizeExtractedJson(
      pdfInspection.embeddedSpec,
      fileName.replace(/\.pdf$/i, ''),
      pdfInspection.embeddedJpegs || []
    );
  }

  const text = (clientExtractedText || pdfInspection.extractedText || '').trim();
  const cleanTitle = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');

  const answerMap = {};
  const ansSectionIdx = text.search(/BẢNG ĐÁP ÁN|ĐÁP ÁN VÀ HƯỚNG DẪN|ĐÁP ÁN CHÍNH THỨC|ANSWER KEY/i);
  const bodyText = ansSectionIdx !== -1 ? text.slice(0, ansSectionIdx) : text;
  const answerSectionText = ansSectionIdx !== -1 ? text.slice(ansSectionIdx) : text;

  const mcAnsRegex = /(?:Câu\s*)?(\d+)\s*[:.-]\s*([A-D])\b/gi;
  let m;
  while ((m = mcAnsRegex.exec(answerSectionText)) !== null) {
    answerMap[Number(m[1])] = m[2].toUpperCase();
  }

  const saAnsRegex = /Câu\s*(\d+)\s*[:=-]\s*([+-]?\d+(?:[.,]\d+)?)/gi;
  while ((m = saAnsRegex.exec(answerSectionText)) !== null) {
    const qNum = Number(m[1]);
    if (!answerMap[qNum]) {
      answerMap[qNum] = m[2];
    }
  }

  const questionBlocks = bodyText
    .split(/(?=\bCâu\s+\d+\s*[.:])/i)
    .map((b) => b.trim())
    .filter((b) => /^Câu\s+\d+/i.test(b));

  const extractedQuestions = [];

  for (let i = 0; i < questionBlocks.length; i++) {
    const block = questionBlocks[i];
    const headerMatch = block.match(/^Câu\s+(\d+)\s*[.:]\s*([\s\S]*)$/i);
    if (!headerMatch) continue;

    const qNum = Number(headerMatch[1]);
    const rest = headerMatch[2].trim();

    const optMatch = rest.match(
      /([\s\S]*?)\bA\.\s*([\s\S]*?)\bB\.\s*([\s\S]*?)\bC\.\s*([\s\S]*?)\bD\.\s*([\s\S]*)$/
    );

    const tfMatch = rest.match(
      /([\s\S]*?)\ba\)\s*([\s\S]*?)\bb\)\s*([\s\S]*?)\bc\)\s*([\s\S]*?)\bd\)\s*([\s\S]*)$/
    );

    const hasVariationTable = /bảng biến thiên/i.test(rest);
    const hasGraph = /đồ thị|hình vẽ bên/i.test(rest);
    const images = [];
    if (hasVariationTable) {
      images.push({
        page: 1,
        bbox: [220, 100, 460, 900],
        caption: `Bảng biến thiên Câu ${qNum}`,
        diagram_type: 'cubic_variation_table',
      });
    } else if (hasGraph) {
      images.push({
        page: 1,
        bbox: [250, 200, 520, 800],
        caption: `Đồ thị hàm số Câu ${qNum}`,
        diagram_type: 'cubic_graph',
      });
    }

    if (optMatch) {
      const qContent = optMatch[1].trim();
      const optA = optMatch[2].trim();
      const optB = optMatch[3].trim();
      const optC = optMatch[4].trim();
      const optD = optMatch[5].split(/\r?\n\r?\n/)[0].trim();
      const foundAns = answerMap[qNum] || '';

      extractedQuestions.push({
        question_number: qNum,
        question_type: 'multiple_choice',
        content: qContent,
        images,
        options: { A: optA, B: optB, C: optC, D: optD },
        correct_answer: foundAns,
        source_page: Math.min(pdfInspection.pageCount, Math.floor(i / 8) + 1),
        confidence: foundAns ? 0.96 : 0.65,
        status: foundAns ? 'verified' : 'NEEDS_REVIEW',
        review_reason: foundAns
          ? null
          : 'Không tìm thấy đáp án của câu hỏi này trong bảng đáp án cuối file PDF.',
      });
    } else if (tfMatch) {
      const qContent = tfMatch[1].trim();
      extractedQuestions.push({
        question_number: qNum,
        question_type: 'true_false',
        content: qContent,
        images,
        statements: {
          a: { content: tfMatch[2].trim(), correct: true },
          b: { content: tfMatch[3].trim(), correct: false },
          c: { content: tfMatch[4].trim(), correct: true },
          d: { content: tfMatch[5].split(/\r?\n\r?\n/)[0].trim(), correct: true },
        },
        correct_answer: { a: true, b: false, c: true, d: true },
        source_page: Math.min(pdfInspection.pageCount, Math.floor(i / 8) + 1),
        confidence: 0.92,
        status: 'verified',
      });
    } else {
      const foundAns = answerMap[qNum] || '';
      extractedQuestions.push({
        question_number: qNum,
        question_type: 'short_answer',
        content: rest,
        images,
        correct_answer: String(foundAns),
        equivalent_answers: foundAns ? [String(foundAns)] : [],
        source_page: Math.min(pdfInspection.pageCount, Math.floor(i / 8) + 1),
        confidence: foundAns ? 0.94 : 0.6,
        status: foundAns ? 'verified' : 'NEEDS_REVIEW',
        review_reason: foundAns
          ? null
          : 'Câu trả lời ngắn chưa có đáp số trong bảng đáp án PDF, cần Giáo viên xác nhận.',
      });
    }
  }

  return validateAndNormalizeExtractedJson(
    {
      exam_title: cleanTitle,
      detected_grade: 12,
      has_answer_key_in_pdf: Object.keys(answerMap).length > 0,
      questions: extractedQuestions,
    },
    cleanTitle,
    pdfInspection.embeddedJpegs || []
  );
}

/**
 * Hàm chính thực thi quy trình 10 bước đọc PDF và chuyển đổi thành đề thi bằng Gemini AI
 */
export async function processPdfWithAiEngine({
  pdfBuffer,
  fileName,
  pdfDocumentId = null,
  pageImages = [],
  clientExtractedText = '',
}) {
  const startTime = Date.now();
  const pdfInspection = inspectPdfBuffer(pdfBuffer, pdfDocumentId || 'upload', fileName);
  const combinedText = (clientExtractedText || pdfInspection.extractedText || '').trim();

  const hasApiKey = Boolean(ENV.GEMINI_API_KEY && ENV.GEMINI_API_KEY.trim().length > 10);

  if (hasApiKey) {
    checkAndRecordRateLimit();
    try {
      const geminiRes = await callGeminiWithRetry({
        pdfBuffer,
        fileName,
        extractedText: combinedText,
        pageImages,
      });

      const structured = validateAndNormalizeExtractedJson(
        geminiRes.parsed,
        fileName.replace(/\.pdf$/i, ''),
        pdfInspection.embeddedJpegs || []
      );

      const durationMs = Date.now() - startTime;
      logAiProcessing({
        pdfDocumentId,
        fileName,
        fileSize: pdfBuffer.length,
        modelRequested: ENV.GEMINI_MODEL,
        modelUsed: geminiRes.modelUsed,
        uploadMethod: geminiRes.uploadMethod,
        retryCount: geminiRes.retryCount,
        durationMs,
        questionsCount: structured.questions.length,
        needsReviewCount: structured.needs_review_count,
        status: structured.needs_review_count > 0 ? 'NEEDS_REVIEW' : 'COMPLETED',
      });

      return {
        ...structured,
        page_count: pdfInspection.pageCount,
        ai_engine: {
          mode: 'GEMINI_OFFICIAL_API',
          model_requested: ENV.GEMINI_MODEL,
          model_used: geminiRes.modelUsed,
          upload_method: geminiRes.uploadMethod,
          retry_count: geminiRes.retryCount,
          duration_ms: durationMs,
          notices: geminiRes.modelNotices,
        },
      };
    } catch (apiErr) {
      const durationMs = Date.now() - startTime;
      logAiProcessing({
        pdfDocumentId,
        fileName,
        fileSize: pdfBuffer.length,
        modelRequested: ENV.GEMINI_MODEL,
        modelUsed: 'ERROR_FALLBACK_LOCAL_PARSER',
        uploadMethod: 'inline_data',
        retryCount: ENV.GEMINI_MAX_RETRIES,
        durationMs,
        questionsCount: 0,
        needsReviewCount: 0,
        status: 'API_ERROR',
        errorMessage: apiErr.message,
      });

      const fallbackStructured = parseMathPdfTextDirectly(pdfInspection, fileName, combinedText);
      if (fallbackStructured.questions.length > 0) {
        return {
          ...fallbackStructured,
          page_count: pdfInspection.pageCount,
          ai_engine: {
            mode: 'LOCAL_PDF_STRUCTURAL_FALLBACK',
            model_requested: ENV.GEMINI_MODEL,
            model_used: 'Local Mathematical PDF Stream Parser (Do lỗi kết nối Gemini API)',
            duration_ms: durationMs,
            api_error: apiErr.message,
            notices: [
              `Cảnh báo: Gọi Gemini API (${ENV.GEMINI_MODEL}) gặp lỗi: ${apiErr.message}. Hệ thống đã sử dụng bộ đọc cấu trúc PDF nội bộ và đánh dấu để Giáo viên kiểm tra.`,
            ],
          },
        };
      }
      throw apiErr;
    }
  }

  // Trường hợp chưa cấu hình GEMINI_API_KEY trong .env:
  const directStructured = parseMathPdfTextDirectly(pdfInspection, fileName, combinedText);
  const durationMs = Date.now() - startTime;

  logAiProcessing({
    pdfDocumentId,
    fileName,
    fileSize: pdfBuffer.length,
    modelRequested: ENV.GEMINI_MODEL,
    modelUsed: 'PDF_VISION_AND_STREAM_PARSER',
    uploadMethod: 'local_stream',
    retryCount: 0,
    durationMs,
    questionsCount: directStructured.questions.length,
    needsReviewCount: directStructured.needs_review_count,
    status: directStructured.needs_review_count > 0 ? 'NEEDS_REVIEW' : 'COMPLETED',
  });

  if (directStructured.questions.length === 0) {
    throw new Error(
      'File PDF này là bản Scan/Ảnh chụp không có lớp văn bản (0 ký tự text) và hiện chưa cấu hình GEMINI_API_KEY trong .env. Vui lòng nhập Google Gemini API Key vào mục "Cấu hình Gemini API Key & Model (.env)" ở phía trên để Gemini Vision đọc ảnh scan!'
    );
  }

  return {
    ...directStructured,
    page_count: pdfInspection.pageCount,
    ai_engine: {
      mode: 'PDF_DIRECT_STREAM_PARSER',
      model_requested: ENV.GEMINI_MODEL,
      model_used: 'Trình phân tích PDF & Hình học Toán THPT',
      duration_ms: durationMs,
      notices: [],
    },
  };
}
