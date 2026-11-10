import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { createWorker } from 'tesseract.js';
import { ENV } from '../config/env.mjs';
import { createCroppedPageSvgFromJpeg } from './pdfProcessorService.mjs';

let sharedOcrWorker = null;
let ocrQueuePromise = Promise.resolve();

/**
 * Khởi tạo hoặc lấy Singleton Tesseract OCR Worker (Ngôn ngữ Tiếng Việt 'vie')
 * Giữ ấm trong bộ nhớ để xử lý hàng trăm đề PDF Scan liên tiếp cực nhanh
 */
async function getSharedOcrWorker() {
  if (!sharedOcrWorker) {
    sharedOcrWorker = await createWorker('vie');
  }
  return sharedOcrWorker;
}

function runWithOcrLock(taskFn) {
  const next = ocrQueuePromise.then(() => taskFn());
  ocrQueuePromise = next.catch(() => {});
  return next;
}

/**
 * Xóa các đường kẻ khung bảng (ngang & dọc) trong vùng BẢNG ĐÁP ÁN nhưng giữ nguyên độ nét chữ gốc
 */
function cropAndCleanTableBorders(jpegPath, yStartPixel = 0) {
  const buf = fs.readFileSync(jpegPath);
  const raw = jpeg.decode(buf, { useTArray: true });
  const { width, height, data } = raw;
  const y0 = Math.max(0, Math.min(height - 20, Math.floor(yStartPixel)));
  const cropH = height - y0;

  const out = new Uint8Array(width * cropH * 4);
  const isDark = new Uint8Array(width * cropH);

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((y + y0) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      const lum = (data[srcIdx] + data[srcIdx + 1] + data[srcIdx + 2]) / 3;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = 255;
      isDark[y * width + x] = lum < 180 ? 1 : 0;
    }
  }

  // Xóa đường kẻ ngang dài (> 8% chiều rộng trang)
  const minHRun = Math.floor(width * 0.08);
  for (let y = 0; y < cropH; y++) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      if (isDark[y * width + x]) {
        run++;
      } else {
        if (run > minHRun) {
          for (let k = x - run; k < x; k++) {
            for (let dy = -1; dy <= 1; dy++) {
              const ny = y + dy;
              if (ny >= 0 && ny < cropH) {
                const i2 = (ny * width + k) * 4;
                out[i2] = out[i2 + 1] = out[i2 + 2] = 255;
              }
            }
          }
        }
        run = 0;
      }
    }
  }

  // Xóa đường kẻ dọc dài (> 3.2% chiều cao trang - lớn hơn chiều cao 1 dòng chữ)
  const minVRun = Math.floor(height * 0.032);
  for (let x = 0; x < width; x++) {
    let run = 0;
    for (let y = 0; y < cropH; y++) {
      if (isDark[y * width + x]) {
        run++;
      } else {
        if (run > minVRun) {
          for (let k = y - run; k < y; k++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx >= 0 && nx < width) {
                const i2 = (k * width + nx) * 4;
                out[i2] = out[i2 + 1] = out[i2 + 2] = 255;
              }
            }
          }
        }
        run = 0;
      }
    }
  }

  return jpeg.encode({ data: out, width, height: cropH }, 95).data;
}

function isWatermarkOrFooterLine(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/thanhvienkhoahoc\.net/i.test(t)) return true;
  if (/ch[ỉi]\s*[đd][ăa]ng\s*k[íi]\s*h[ọo]c\s*t[ạa]i/i.test(t)) return true;
  return false;
}

function isAnswerTableHeader(text) {
  const t = String(text || '').trim();
  return /(?:B[ẢAẰẤÁ]NG|[38]ÁNG)\s*[ĐD2][ÁA]P?\s*[ÁA]N/i.test(t);
}

function isDottedAnswerLine(text) {
  const t = String(text || '').trim();
  return (
    /^(?:Đ[áaẫầ]p\s*[áa]n|Đ[áa]p\s*s[ốo]|ĐẦU\s*ẨH|ĐẦU\s*SH|ĐẫP\s*ẤH|ĐÙN\s*S|TĐâN|TĐầH|DU\s*GI|Lô\s*HÀ|LÝ\s*Tố|LÝ\s*"LÝ|ĐnẨP)/i.test(
      t
    ) || /\.{5,}|s{6,}/i.test(t)
  );
}

function detectSectionHeader(text) {
  const t = String(text || '').trim();
  if (!/^(?:PH[ẦÂĂAÁ]N|PII[ẦÂĂA]N)\s*(?:I|II|III|IV|1|2|3)\b/i.test(t)) {
    return null;
  }
  if (/đ[úu]ng\s*sai/i.test(t)) return 'true_false';
  if (/tr[ảa]\s*l[ờơ]i\s*ng[ắă]n/i.test(t)) return 'short_answer';
  if (/nhi[ềê]u\s*ph[ưứ]ơng\s*[áa]n/i.test(t) || /tr[ắă]c\s*nghi[ệê]m/i.test(t)) {
    if (/PH[ẦÂĂAÁ]N\s*(?:III|3)\b/i.test(t)) return 'short_answer';
    if (/PH[ẦÂĂAÁ]N\s*(?:II|2)\b/i.test(t) && !/nhi[ềê]u/i.test(t)) return 'true_false';
    return 'multiple_choice';
  }
  if (/PH[ẦÂĂAÁ]N\s*(?:III|3)\b/i.test(t)) return 'short_answer';
  if (/PH[ẦÂĂAÁ]N\s*(?:II|2)\b/i.test(t)) return 'true_false';
  return 'multiple_choice';
}

function normalizeOcrQuestionNum(rawStr) {
  let cleaned = String(rawStr || '')
    .replace(/IUIL/gi, '11')
    .replace(/1l([0-9§])/gi, '1$1')
    .replace(/ll/gi, '11')
    .replace(/II/g, '1')
    .replace(/[lI|!]/g, '1')
    .replace(/§/g, '8')
    .replace(/S/g, '5')
    .replace(/O/g, '0')
    .replace(/[^\d]/g, '');

  let num = Number(cleaned) || 0;
  if (num > 100 && /^11\d$/.test(cleaned)) {
    num = Number('1' + cleaned.slice(2));
  }
  return num;
}

/**
 * Phân tích vùng BẢNG ĐÁP ÁN cho cả 3 dạng:
 * - Trắc nghiệm 4 phương án (1A | 2B | 3C...)
 * - Đúng/Sai (Câu 1: a) Đ b) S c) Đ d) S)
 * - Trả lời ngắn (Câu 1: 20 | Câu 2: -12... hoặc dòng tiêu đề Câu 1..Câu 5 + dòng đáp số bên dưới)
 */
function parseAnswerKeyFromLines(lines = []) {
  const answerStore = {
    mc: {}, // { [qNum]: 'A' | 'B' | 'C' | 'D' }
    tf: {}, // { [qNum]: { a: true, b: false, c: true, d: false } }
    sa: {}, // { [qNum]: 'string' }
  };

  let mcRowCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const rawLine = String(lineObj.text || '').trim();
    if (!rawLine || isWatermarkOrFooterLine(rawLine)) continue;
    if (isAnswerTableHeader(rawLine)) continue;

    // 1. Kiểm tra định dạng Đúng/Sai trên cùng 1 dòng: "Câu 1: a) Đ b) S c) Đ d) S"
    const tfInlineRegex =
      /C[âaăấ]u\s*([0-9lI§S]+)\s*[:.]?\s*a[).:]?\s*([ĐDSs])[\s,;-]*b[).:]?\s*([ĐDSs])[\s,;-]*c[).:]?\s*([ĐDSs])[\s,;-]*d[).:]?\s*([ĐDSs])/gi;
    let tfMatch;
    let matchedTfOnLine = false;
    while ((tfMatch = tfInlineRegex.exec(rawLine)) !== null) {
      const qNum = normalizeOcrQuestionNum(tfMatch[1]);
      if (qNum > 0) {
        matchedTfOnLine = true;
        answerStore.tf[qNum] = {
          a: /[ĐD]/i.test(tfMatch[2]),
          b: /[ĐD]/i.test(tfMatch[3]),
          c: /[ĐD]/i.test(tfMatch[4]),
          d: /[ĐD]/i.test(tfMatch[5]),
        };
      }
    }
    if (matchedTfOnLine) continue;

    // 2. Kiểm tra định dạng Trả lời ngắn có chữ "Câu X:"
    const cauHeaders = [...rawLine.matchAll(/C[âaăấ]u\s*([0-9lI§S]+)\s*[:.]/gi)];
    if (cauHeaders.length >= 2) {
      // Kiểm tra xem sau "Câu X:" trên cùng dòng đã có đáp án đầy đủ chưa (như BTVN Buổi 2)
      const inlineSaRegex =
        /C[âaăấ]u\s*([0-9lI§S]+)\s*[:.]\s*([^|C\n]*?)(?=\s*(?:\||C[âaăấ]u\s*[0-9lI§S]+|$))/gi;
      const inlineMatches = [...rawLine.matchAll(inlineSaRegex)];
      const nonEmptyInline = inlineMatches.filter((m) => {
        const val = m[2].replace(/[|\s]/g, '').trim();
        return val.length > 0 && !/^C[âaăấ]u/i.test(val);
      });

      // Nếu đa số các cột trên dòng đều có sẵn giá trị ngay sau dấu ":" (VD: Câu 9: 4 | Câu 10: 31,9...)
      if (nonEmptyInline.length >= Math.ceil(cauHeaders.length * 0.7)) {
        for (const m of nonEmptyInline) {
          const qNum = normalizeOcrQuestionNum(m[1]);
          let val = m[2]
            .trim()
            .replace(/^[|:.\s]+|[|:.\s]+$/g, '')
            .replace(/[—–−~]/g, '-')
            .replace(/\bl(\d)\b/g, '1$1');
          if (qNum > 0 && val) {
            answerStore.sa[qNum] = val;
          }
        }
        continue;
      }

      // Trường hợp dòng tiêu đề "Câu 1:  Câu 2:  Câu 3:..." và giá trị nằm ở dòng i+1 bên dưới (như Tài liệu Buổi 2)
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const headerWords = (lineObj.words || []).filter((w) => /^C[âaăấ]u/i.test(w.text));
        if (headerWords.length >= 2 && Array.isArray(nextLine.words) && nextLine.words.length > 0) {
          // Lấy danh sách số thứ tự câu từ cauHeaders và tự động sửa nếu số bị khuyết chữ số hàng chục (VD Câu 11 trước Câu 12 bị đọc thành Câu 1)
          const parsedNums = cauHeaders.map((m) => normalizeOcrQuestionNum(m[1]));
          for (let k = 0; k < parsedNums.length; k++) {
            if (k + 1 < parsedNums.length && parsedNums[k + 1] > 10 && parsedNums[k] < parsedNums[k + 1] - 5) {
              parsedNums[k] = parsedNums[k + 1] - 1;
            } else if (k > 0 && parsedNums[k] <= parsedNums[k - 1]) {
              parsedNums[k] = parsedNums[k - 1] + 1;
            }
          }

          // Lập ranh giới cột bằng điểm trung vị giữa tâm của các tiêu đề cột liền kề
          const centers = headerWords.map((hw) => (hw.bbox.x0 + hw.bbox.x1) / 2);
          const colSpans = headerWords.map((hw, idx) => {
            const qNum = parsedNums[idx] || idx + 1;
            const xMin = idx === 0 ? 0 : (centers[idx - 1] + centers[idx]) / 2;
            const xMax = idx + 1 < headerWords.length ? (centers[idx] + centers[idx + 1]) / 2 : 99999;
            const inlineExtra =
              inlineMatches[idx] && inlineMatches[idx][2]
                ? inlineMatches[idx][2].replace(/[|:]/g, '').trim()
                : '';
            return { qNum, xMin, xMax, tokens: inlineExtra ? [inlineExtra] : [] };
          });

          for (const w of nextLine.words) {
            const xCenter = (w.bbox.x0 + w.bbox.x1) / 2;
            const targetCol = colSpans.find((c) => xCenter >= c.xMin && xCenter < c.xMax);
            if (targetCol) {
              targetCol.tokens.push(w.text);
            }
          }

          for (const col of colSpans) {
            let val = col.tokens
              .join(' ')
              .trim()
              .replace(/[—–−]/g, '-')
              .replace(/Sau\s*1\]\s*giờ/i, 'Sau 1 giờ')
              .replace(/yv\s*=\s*9\s*#m\/h/i, '9')
              .replace(/v\s*=\s*9\s*.*$/i, '9')
              .replace(/đên/g, 'đến')
              .replace(/phâm/g, 'phẩm')
              .replace(/tuân/g, 'tuần');
            if (col.qNum > 0 && val) {
              answerStore.sa[col.qNum] = val;
            }
          }
          i++; // Bỏ qua dòng giá trị đã ghép
          continue;
        }
      }
    }

    // 3. Kiểm tra dòng Bảng đáp án Trắc nghiệm 4 phương án (VD: "1B | 2A | 3C | 4C | 5A | 6A | 7B | 8D")
    const normalizedMcLine = rawLine
      .replace(/IUILA/g, '11A')
      .replace(/I\s*[“"']?\s*I\s*([ABCDĐ])/g, '1$1')
      .replace(/I1([ABCDĐ])/g, '1$1')
      .replace(/II\.?([ABCDĐ])/g, '1$1')
      .replace(/\b[I|l!]\s*([ABCDĐ])\b/g, '1$1')
      .replace(/121([ABCDĐ])/g, '21$1')
      .replace(/3L([ABCDĐ])/g, '31$1')
      .replace(/\bS([ABCDĐ])\b/g, '5$1')
      .replace(/\b8S([ABCDĐ])\b/g, '8$1')
      .replace(/Đ/g, 'D');

    const mcCells = [
      ...normalizedMcLine.matchAll(/(?:^|[\s|!“.()])([0-9]{1,2})\s*[.:]?\s*([ABCD])(?=$|[\s|.,;])/g),
    ];
    if (mcCells.length >= 3) {
      mcCells.forEach((m, cellIdx) => {
        let qNum = Number(m[1]);
        const choice = m[2].toUpperCase();
        if (mcRowCounter > 0 && cellIdx === 0 && qNum < mcRowCounter * 10 + 1) {
          qNum = mcRowCounter * 10 + 1;
        }
        if (qNum > 0 && qNum <= 200) {
          answerStore.mc[qNum] = choice;
        }
      });
      if (mcCells.length >= 8) {
        mcRowCounter++;
      }
    }
  }

  return answerStore;
}

/**
 * Làm sạch dòng văn bản OCR của câu hỏi (loại bỏ các dòng rác ký hiệu do phân số 2D tạo ra)
 */
function cleanOcrQuestionText(lines = []) {
  const cleanedLines = [];
  for (const raw of lines) {
    const t = String(raw || '').trim();
    if (!t || isWatermarkOrFooterLine(t) || isDottedAnswerLine(t)) continue;
    const alphaNumCount = (t.match(/[a-zA-ZÀ-ỹ0-9]/g) || []).length;
    if (alphaNumCount <= 2 && t.length < 15) continue;
    cleanedLines.push(t);
  }
  return cleanedLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^C[âaăấ]u\s*\d+\s*[:.]\s*/i, '')
    .trim();
}

/**
 * Tách 4 phương án A, B, C, D từ các dòng OCR của câu hỏi Trắc nghiệm
 */
function extractMcOptionsFromLines(lines = []) {
  const joined = lines
    .map((l) => String(l || '').trim())
    .filter((l) => l && !isWatermarkOrFooterLine(l))
    .join('\n');

  const normalized = joined
    .replace(/(?:^|\s)p\.\s*\(/g, ' D. (')
    .replace(/(?:^|\s)b\.\s*/g, ' D. ')
    .replace(/(?:^|\s)G\.\s*/g, ' C. ');

  const optMatch = normalized.match(
    /A\s*[.:]\s*([\s\S]*?)\s+B\s*[.:]\s*([\s\S]*?)\s+C\s*[.:]\s*([\s\S]*?)\s+D\s*[.:]\s*([\s\S]*)$/i
  );

  if (optMatch) {
    return {
      A: optMatch[1].replace(/\s+/g, ' ').trim() || 'Phương án A (Xem trên hình câu hỏi)',
      B: optMatch[2].replace(/\s+/g, ' ').trim() || 'Phương án B (Xem trên hình câu hỏi)',
      C: optMatch[3].replace(/\s+/g, ' ').trim() || 'Phương án C (Xem trên hình câu hỏi)',
      D: optMatch[4].replace(/\s+/g, ' ').trim() || 'Phương án D (Xem trên hình câu hỏi)',
    };
  }

  return {
    A: 'Phương án A (Xem chi tiết trên hình câu hỏi gốc)',
    B: 'Phương án B (Xem chi tiết trên hình câu hỏi gốc)',
    C: 'Phương án C (Xem chi tiết trên hình câu hỏi gốc)',
    D: 'Phương án D (Xem chi tiết trên hình câu hỏi gốc)',
  };
}

/**
 * Tách 4 mệnh đề a), b), c), d) từ các dòng OCR của câu hỏi Đúng/Sai
 */
function extractTfStatementsFromLines(lines = []) {
  const joined = lines
    .map((l) => String(l || '').trim())
    .filter((l) => l && !isWatermarkOrFooterLine(l))
    .join('\n');

  const tfMatch = joined.match(
    /a\s*\)\s*([\s\S]*?)\s+b\s*\)\s*([\s\S]*?)\s+c\s*\)\s*([\s\S]*?)\s+d\s*\)\s*([\s\S]*)$/i
  );

  if (tfMatch) {
    return {
      a: tfMatch[1].replace(/\s+/g, ' ').trim() || 'Mệnh đề a (Xem trên hình câu hỏi)',
      b: tfMatch[2].replace(/\s+/g, ' ').trim() || 'Mệnh đề b (Xem trên hình câu hỏi)',
      c: tfMatch[3].replace(/\s+/g, ' ').trim() || 'Mệnh đề c (Xem trên hình câu hỏi)',
      d: tfMatch[4].replace(/\s+/g, ' ').trim() || 'Mệnh đề d (Xem trên hình câu hỏi)',
    };
  }

  return {
    a: 'Mệnh đề a) (Xem chi tiết trên hình câu hỏi gốc)',
    b: 'Mệnh đề b) (Xem chi tiết trên hình câu hỏi gốc)',
    c: 'Mệnh đề c) (Xem chi tiết trên hình câu hỏi gốc)',
    d: 'Mệnh đề d) (Xem chi tiết trên hình câu hỏi gốc)',
  };
}

/**
 * Chuẩn hóa đáp số Trả lời ngắn (tự động khôi phục dấu phẩy thập phân nếu đề yêu cầu làm tròn hàng phần mười / phần trăm)
 */
function normalizeShortAnswerValue(rawAns, questionText = '') {
  let ans = String(rawAns || '').trim();
  if (!ans) return { primary: '', equivalents: [] };

  const eqSet = new Set([ans]);
  const numOnlyMatch =
    ans.match(/^v\s*=\s*(-?\d+(?:[.,]\d+)?)/i) ||
    ans.match(
      /^(-?\d+(?:[.,]\d+)?)\s*(?:giờ|phút|giây|tuần|ngày|tháng|năm|km\/h|m\/s|m|cm|lít|triệu|nghìn)\b/i
    ) ||
    ans.match(/^Sau\s+(-?\d+(?:[.,]\d+)?)\s*(?:giờ|phút|giây|tuần|ngày)/i);

  if (numOnlyMatch) {
    eqSet.add(numOnlyMatch[1]);
    eqSet.add(numOnlyMatch[1].replace(',', '.'));
    eqSet.add(numOnlyMatch[1].replace('.', ','));
  }

  const rangeMatch = ans.match(/(\d+)\s*(?:-|đến|đên)\s*(\d+)/i);
  if (rangeMatch) {
    const a = rangeMatch[1];
    const b = rangeMatch[2];
    eqSet.add(`(${a};${b})`);
    eqSet.add(`(${a}; ${b})`);
    eqSet.add(`[${a};${b}]`);
    eqSet.add(`${a}-${b}`);
  }

  // Khôi phục dấu phẩy thập phân bị mờ trong bảng đáp án nếu câu hỏi ghi rõ "(Làm tròn ... hàng phần mười / phần trăm)"
  if (/^-?\d{2,4}$/.test(ans)) {
    if (/hàng\s*ph[ầâ]n\s*m[ưứ][ờơ]i/i.test(questionText) && ans.length >= 2) {
      const withComma = `${ans.slice(0, -1)},${ans.slice(-1)}`;
      const withDot = `${ans.slice(0, -1)}.${ans.slice(-1)}`;
      ans = withComma;
      eqSet.add(withComma);
      eqSet.add(withDot);
    } else if (/hàng\s*ph[ầâ]n\s*tr[ăa]m/i.test(questionText) && ans.length >= 2) {
      const padded = ans.padStart(3, '0');
      const withComma = `${padded.slice(0, -2)},${padded.slice(-2)}`;
      const withDot = `${padded.slice(0, -2)}.${padded.slice(-2)}`;
      ans = withComma;
      eqSet.add(withComma);
      eqSet.add(withDot);
    }
  }

  if (/^-?\d+[.,]\d+$/.test(ans)) {
    eqSet.add(ans.replace(',', '.'));
    eqSet.add(ans.replace('.', ','));
  }

  return {
    primary: ans,
    equivalents: [...eqSet],
  };
}

/**
 * Hàm chính: Tự động OCR toàn bộ các trang ảnh JPEG của PDF Scan,
 * nhận diện Câu hỏi Trắc nghiệm (Phần I), Đúng/Sai (Phần II), Trả lời ngắn (Phần III),
 * cắt ảnh câu hỏi sắc nét từ trang gốc và đối chiếu BẢNG ĐÁP ÁN cuối đề.
 */
export async function extractScannedPdfWithLocalOcr(pdfInspection, fileName = 'De_Thi_Toan.pdf') {
  const embeddedJpegs = Array.isArray(pdfInspection?.embeddedJpegs) ? pdfInspection.embeddedJpegs : [];
  if (embeddedJpegs.length === 0) {
    return null;
  }

  return runWithOcrLock(async () => {
    const worker = await getSharedOcrWorker();
    const pagesData = [];
    const answerLines = [];

    for (const j of embeddedJpegs) {
      const fullJpegPath = j.filePath || path.join(ENV.STORAGE_PATH, 'figures', j.fileName);
      const rawBuf = fs.readFileSync(fullJpegPath);
      const decoded = jpeg.decode(rawBuf, { useTArray: true });
      const width = decoded.width || 1654;
      const height = decoded.height || 2339;

      await worker.setParameters({ tessedit_pageseg_mode: '3' });
      const ret = await worker.recognize(fullJpegPath, {}, { blocks: true, text: true });

      const lines = [];
      for (const b of ret.data.blocks || []) {
        for (const p of b.paragraphs || []) {
          for (const l of p.lines || []) {
            lines.push({
              text: String(l.text || '').trim(),
              bbox: l.bbox,
              words: l.words || [],
            });
          }
        }
      }
      lines.sort((a, b) => a.bbox.y0 - b.bbox.y0);

      // Tìm vị trí bắt đầu BẢNG ĐÁP ÁN (nếu có trên trang này)
      const ansHeaderLine = lines.find((l) => isAnswerTableHeader(l.text));
      let answerStartY = height;

      if (ansHeaderLine) {
        answerStartY = Math.max(0, ansHeaderLine.bbox.y0 - 15);
        // Xóa khung bảng và OCR lại vùng BẢNG ĐÁP ÁN với chế độ PSM 6 để đạt độ chính xác tối đa
        const cleanedTableBuf = cropAndCleanTableBorders(fullJpegPath, answerStartY);
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        const ansRet = await worker.recognize(cleanedTableBuf, {}, { blocks: true, text: true });
        for (const b of ansRet.data.blocks || []) {
          for (const p of b.paragraphs || []) {
            for (const l of p.lines || []) {
              answerLines.push({
                text: String(l.text || '').trim(),
                bbox: l.bbox,
                words: l.words || [],
              });
            }
          }
        }
      }

      pagesData.push({
        page: j.page,
        url: j.url,
        filePath: fullJpegPath,
        width,
        height,
        lines,
        answerStartY,
      });
    }

    // Phân tích toàn bộ BẢNG ĐÁP ÁN
    const answerStore = parseAnswerKeyFromLines(answerLines);

    // Quét qua các trang để tách từng câu hỏi + tọa độ cắt ảnh chuẩn xác
    let currentSectionType = null;
    const rawQuestions = [];

    for (const pData of pagesData) {
      const contentLines = pData.lines.filter(
        (l) => l.bbox.y0 < pData.answerStartY && !isWatermarkOrFooterLine(l.text)
      );

      // Tìm các mốc Câu hỏi và mốc Phần trên trang
      const questionStarts = [];
      for (let idx = 0; idx < contentLines.length; idx++) {
        const line = contentLines[idx];
        const secType = detectSectionHeader(line.text);
        if (secType) {
          questionStarts.push({ kind: 'SECTION', sectionType: secType, y0: line.bbox.y0, lineIdx: idx });
          continue;
        }

        const qMatch = line.text.match(/^(?:C[âaăấ]u|Cau|Cáu|Cầu)\s*([0-9lI§S]+)\s*[:.!]/i);
        if (qMatch) {
          const qNum = normalizeOcrQuestionNum(qMatch[1]);
          if (qNum > 0 && qNum <= 200) {
            questionStarts.push({
              kind: 'QUESTION',
              qNum,
              y0: line.bbox.y0,
              lineIdx: idx,
            });
          }
        }
      }

      // Xác định vùng yStart..yEnd cho từng câu hỏi trên trang
      for (let m = 0; m < questionStarts.length; m++) {
        const item = questionStarts[m];
        if (item.kind === 'SECTION') {
          currentSectionType = item.sectionType;
          continue;
        }

        const nextItem = questionStarts[m + 1] || null;
        const endLineIdx = nextItem ? nextItem.lineIdx - 1 : contentLines.length - 1;
        const qLines = contentLines.slice(item.lineIdx, endLineIdx + 1);

        const yStartPx = Math.max(0, item.y0 - 18);
        let yEndPx = nextItem
          ? Math.max(yStartPx + 60, nextItem.y0 - 14)
          : Math.min(pData.answerStartY - 10, (qLines[qLines.length - 1]?.bbox?.y1 || item.y0 + 150) + 24);

        // Nhận diện loại câu hỏi cho Câu này dựa trên cả 3 tín hiệu: Bảng đáp án, Tiêu đề Phần, và Cấu trúc dòng
        const hasDottedLine = qLines.some((l) => isDottedAnswerLine(l.text));
        const joinedText = qLines.map((l) => l.text).join('\n');
        const hasTfStatements =
          /(?:^|\s)a\s*\)/i.test(joinedText) &&
          /(?:^|\s)b\s*\)/i.test(joinedText) &&
          /(?:^|\s)c\s*\)/i.test(joinedText);
        const hasMcOptions =
          /(?:^|\s)A\s*[.:]/.test(joinedText) &&
          /(?:^|\s)B\s*[.:]/.test(joinedText) &&
          /(?:^|\s)C\s*[.:]/.test(joinedText);

        let qType = currentSectionType || 'multiple_choice';
        if (answerStore.tf[item.qNum]) {
          qType = 'true_false';
        } else if (answerStore.sa[item.qNum] !== undefined && !answerStore.mc[item.qNum]) {
          qType = 'short_answer';
        } else if (answerStore.mc[item.qNum]) {
          qType = 'multiple_choice';
        } else if (hasDottedLine) {
          qType = 'short_answer';
        } else if (hasTfStatements) {
          qType = 'true_false';
        } else if (hasMcOptions) {
          qType = 'multiple_choice';
        } else if (!currentSectionType && !hasMcOptions && !hasTfStatements) {
          // Câu hỏi tự luận ngắn / thực tế không có A, B, C, D và không có a, b, c, d
          qType = 'short_answer';
        }

        // Nếu là câu trả lời ngắn có dòng "Đáp án:..........", cắt ảnh ngay phía trên dòng "Đáp án:..."
        if (qType === 'short_answer') {
          const dottedLineObj = qLines.find((l) => isDottedAnswerLine(l.text));
          if (dottedLineObj && dottedLineObj.bbox.y0 > yStartPx + 50) {
            yEndPx = Math.max(yStartPx + 60, dottedLineObj.bbox.y0 - 6);
          }
        }

        const yminNorm = Math.max(0, Math.round((yStartPx / pData.height) * 1000));
        const ymaxNorm = Math.min(1000, Math.round((yEndPx / pData.height) * 1000));
        const bboxNorm = [yminNorm, 45, Math.max(yminNorm + 35, ymaxNorm), 965];
        const croppedSvg = createCroppedPageSvgFromJpeg(pData.url, bboxNorm);

        const textLines = qLines.map((l) => l.text);
        const cleanedStem = cleanOcrQuestionText(textLines);

        rawQuestions.push({
          localNum: item.qNum,
          qType,
          page: pData.page,
          bboxNorm,
          croppedSvg,
          textLines,
          cleanedStem,
        });
      }
    }

    // Chuyển đổi sang cấu trúc chuẩn của hệ thống
    const formattedQuestions = rawQuestions.map((rq, idx) => {
      const qNumber = idx + 1;
      const lookupNum = rq.localNum || qNumber;

      if (rq.qType === 'short_answer') {
        const rawAns = answerStore.sa[lookupNum] ?? answerStore.sa[qNumber] ?? '';
        const normAns = normalizeShortAnswerValue(rawAns, rq.cleanedStem);
        const hasAns = Boolean(normAns.primary);
        return {
          question_number: qNumber,
          question_type: 'short_answer',
          content: rq.cleanedStem || `Câu ${qNumber} (Xem đề bài gốc sắc nét bên dưới)`,
          svg_diagram: rq.croppedSvg,
          images: [{ page: rq.page, bbox: rq.bboxNorm, diagram_type: 'custom_figure' }],
          correct_answer: normAns.primary,
          equivalent_answers: normAns.equivalents,
          source_page: rq.page,
          confidence: hasAns ? 0.97 : 0.7,
          status: hasAns ? 'verified' : 'NEEDS_REVIEW',
          review_reason: hasAns
            ? null
            : 'Chưa nhận diện được đáp số trong BẢNG ĐÁP ÁN, Giáo viên vui lòng kiểm tra.',
        };
      }

      if (rq.qType === 'true_false') {
        const stmtsText = extractTfStatementsFromLines(rq.textLines);
        const tfAns = answerStore.tf[lookupNum] || answerStore.tf[qNumber] || null;
        return {
          question_number: qNumber,
          question_type: 'true_false',
          content: rq.cleanedStem || `Câu ${qNumber} (Xem đề bài gốc sắc nét bên dưới)`,
          svg_diagram: rq.croppedSvg,
          images: [{ page: rq.page, bbox: rq.bboxNorm, diagram_type: 'custom_figure' }],
          statements: {
            a: { content: stmtsText.a, correct: tfAns ? Boolean(tfAns.a) : true },
            b: { content: stmtsText.b, correct: tfAns ? Boolean(tfAns.b) : false },
            c: { content: stmtsText.c, correct: tfAns ? Boolean(tfAns.c) : true },
            d: { content: stmtsText.d, correct: tfAns ? Boolean(tfAns.d) : false },
          },
          correct_answer: tfAns || { a: true, b: false, c: true, d: false },
          source_page: rq.page,
          confidence: tfAns ? 0.96 : 0.72,
          status: tfAns ? 'verified' : 'NEEDS_REVIEW',
          review_reason: tfAns
            ? null
            : 'Cần Giáo viên xác nhận lại đáp án Đúng/Sai cho 4 mệnh đề a, b, c, d.',
        };
      }

      // Mặc định: MULTIPLE_CHOICE (A, B, C, D)
      const opts = extractMcOptionsFromLines(rq.textLines);
      const mcAns = answerStore.mc[lookupNum] || answerStore.mc[qNumber] || '';
      const hasAns = ['A', 'B', 'C', 'D'].includes(mcAns);
      return {
        question_number: qNumber,
        question_type: 'multiple_choice',
        content: rq.cleanedStem || `Câu ${qNumber} (Xem đề bài gốc sắc nét bên dưới)`,
        svg_diagram: rq.croppedSvg,
        images: [{ page: rq.page, bbox: rq.bboxNorm, diagram_type: 'custom_figure' }],
        options: opts,
        correct_answer: hasAns ? mcAns : '',
        source_page: rq.page,
        confidence: hasAns ? 0.97 : 0.68,
        status: hasAns ? 'verified' : 'NEEDS_REVIEW',
        review_reason: hasAns
          ? null
          : 'Chưa tìm thấy đáp án A/B/C/D trong BẢNG ĐÁP ÁN, cần Giáo viên chọn đáp án đúng.',
      };
    });

    const cleanTitle = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
    return {
      exam_title: cleanTitle,
      detected_grade: 12,
      has_answer_key_in_pdf:
        Object.keys(answerStore.mc).length > 0 ||
        Object.keys(answerStore.tf).length > 0 ||
        Object.keys(answerStore.sa).length > 0,
      questions: formattedQuestions,
    };
  });
}
