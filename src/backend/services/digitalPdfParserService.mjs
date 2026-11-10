import fs from 'node:fs';
import path from 'node:path';
import * as mupdf from 'mupdf';
import { ENV } from '../config/env.mjs';
import { ensureStorageDirs } from './storageService.mjs';
import { createCroppedPageSvgFromJpeg } from './pdfProcessorService.mjs';

function cleanMathSymbols(str) {
  return str
    .replace(//g, '$\\mathbb{R}$')
    .replace(/−/g, '$-\\infty$')
    .replace(/\+/g, '$+\\infty$')
    .replace(//g, '$\\infty$')
    .replace(/−/g, '-')
    .replace(/y/g, "$y'$")
    .replace(/'y/g, "$y'$")
    .replace(//g, '$\\forall$')
    .replace(//g, '$\\in$')
    .replace(//g, '$\\Rightarrow$')
    .replace(//g, '$<$')
    .replace(//g, '$>$')
    .replace(//g, '$[$')
    .replace(//g, '$]$')
    .replace(/\[\s*\]/g, '$[]$')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phân tích bảng đáp án ở trang cuối (hỗ trợ cả Đúng/Sai, Trắc nghiệm A/B/C/D, và Trả lời ngắn)
 */
function parseAnswerKeyFromDoc(doc, totalPages) {
  const ansMap = {
    tf: {},
    mc: {},
    sa: {},
  };

  // Quét 2 trang cuối (nơi chứa bảng đáp án)
  const startP = Math.max(0, totalPages - 2);
  const allLines = [];
  for (let p = startP; p < totalPages; p++) {
    const page = doc.loadPage(p);
    const json = JSON.parse(page.toStructuredText('preserve-whitespace').asJSON());
    for (const b of json.blocks) {
      if (b.lines) {
        for (const l of b.lines) allLines.push(l.text.trim());
      }
    }
  }

  // 1. Dạng Đúng/Sai theo khối: "Câu 1 \n a) Sai \n b) Đúng ..." hoặc "Câu 1: a) S b) Đ ..."
  let curTfQ = null;
  for (const line of allLines) {
    const qMatch = line.match(/^C[âa]u\s*(\d+)/i);
    if (qMatch) {
      curTfQ = Number(qMatch[1]);
      if (!ansMap.tf[curTfQ]) ansMap.tf[curTfQ] = {};
    }

    // "a) Đúng", "b) Sai"
    const stMatch = line.match(/^([a-d])\)\s*(Đúng|Sai|Đ|S)/i);
    if (stMatch && curTfQ) {
      ansMap.tf[curTfQ][stMatch[1].toLowerCase()] = /đúng|đ/i.test(stMatch[2]);
    }

    // Inline: "Câu 1: a) Đ b) S c) Đ d) S"
    const inlineTf = line.match(/C[âa]u\s*(\d+)\s*[:.]?\s*a[).:]?\s*([ĐDSs])[\s,;-]*b[).:]?\s*([ĐDSs])[\s,;-]*c[).:]?\s*([ĐDSs])[\s,;-]*d[).:]?\s*([ĐDSs])/i);
    if (inlineTf) {
      const qN = Number(inlineTf[1]);
      ansMap.tf[qN] = {
        a: /đ/i.test(inlineTf[2]),
        b: /đ/i.test(inlineTf[3]),
        c: /đ/i.test(inlineTf[4]),
        d: /đ/i.test(inlineTf[5]),
      };
    }
  }

  // 2. Dạng Trắc nghiệm 4 lựa chọn: "1.A 2.B" hoặc "1A | 2B" hoặc "Câu 1: A"
  const joinedText = allLines.join(' ');
  const mcMatches = [...joinedText.matchAll(/(?:^|[\s|!“.()])([0-9]{1,2})\s*[.:]?\s*([ABCD])(?=$|[\s|.,;])/g)];
  for (const m of mcMatches) {
    const qN = Number(m[1]);
    if (qN > 0 && qN <= 150) {
      ansMap.mc[qN] = m[2].toUpperCase();
    }
  }

  // 3. Dạng Trả lời ngắn: "Câu 1: 20", "Câu 2: -12"
  const saMatches = [...joinedText.matchAll(/C[âa]u\s*(\d+)\s*[:=-]\s*([^\s|C\n]+)/gi)];
  for (const m of saMatches) {
    const qN = Number(m[1]);
    const val = m[2].trim().replace(/^[|:.]+|[|:.]+$/g, '');
    if (qN > 0 && val && !ansMap.mc[qN]) {
      ansMap.sa[qN] = val;
    }
  }

  return ansMap;
}

/**
 * Trích xuất các dòng văn bản của 1 trang, nhóm các ký tự trên cùng một dòng y (±4pt)
 * và sắp xếp từ trái qua phải (tránh lỗi ngắt dòng và xáo trộn chữ)
 */
function extractSortedLinesFromPage(page) {
  const st = page.toStructuredText('preserve-whitespace');
  const chars = [];
  st.walk({
    onChar(c, origin, font, size, quad) {
      chars.push({ c, x: (quad[0] + quad[2]) / 2, y: origin[1] });
    },
  });

  if (chars.length === 0) return [];

  // Nhóm các ký tự có y gần nhau (trong khoảng ±4.0pt) vào cùng 1 dòng
  chars.sort((a, b) => a.y - b.y);
  const lines = [];
  for (const ch of chars) {
    const line = lines.find((l) => Math.abs(l.y - ch.y) <= 4.0);
    if (line) {
      line.chars.push(ch);
      line.y = (line.y * (line.chars.length - 1) + ch.y) / line.chars.length;
    } else {
      lines.push({ y: ch.y, chars: [ch] });
    }
  }

  lines.sort((a, b) => a.y - b.y);
  for (const l of lines) {
    l.chars.sort((a, b) => a.x - b.x);
    l.text = cleanMathSymbols(l.chars.map((c) => c.c).join(''));
  }

  return lines;
}

/**
 * Bộ phân tích và trích xuất PDF Toán học số hóa (Digital PDF) sử dụng MuPDF:
 * - Dựng trang chất lượng cao (2x DPI) để giữ nguyên bảng biến thiên, đồ thị, hình vẽ
 * - Tự động nhận diện cấu trúc Câu hỏi (Trắc nghiệm, Đúng/Sai, Trả lời ngắn)
 * - Tự động đối chiếu Bảng đáp án
 */
export async function parseDigitalPdfWithMuPdf(pdfBuffer, fileName = 'De_Thi_Toan.pdf', pdfId = 'upload') {
  ensureStorageDirs();
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  const totalPages = doc.countPages();

  // 1. Bóc tách bảng đáp án ở cuối tài liệu
  const answerMap = parseAnswerKeyFromDoc(doc, totalPages);

  // 2. Dựng và lưu các trang tài liệu dạng JPEG độ phân giải cao
  const pageJpegs = [];
  for (let p = 0; p < totalPages; p++) {
    const page = doc.loadPage(p);
    const pix = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
    const jpgBytes = pix.asJPEG(85);
    const fileNameJpg = `pdf_${pdfId}_page_${p + 1}.jpg`;
    const fullPath = path.join(ENV.STORAGE_PATH, 'figures', fileNameJpg);
    try {
      fs.writeFileSync(fullPath, jpgBytes);
    } catch {
      // ignore
    }
    pageJpegs.push({
      page: p + 1,
      fileName: fileNameJpg,
      filePath: fullPath,
      url: `/api/storage/figures/${fileNameJpg}`,
      width: pix.getWidth(),
      height: pix.getHeight(),
    });
  }

  // 3. Quét từng trang nội dung (trừ trang chỉ toàn bảng đáp án)
  const extractedQuestions = [];
  let detectedType = 'TRUE_FALSE'; // Mặc định tự suy luận theo từng câu

  for (let p = 0; p < totalPages; p++) {
    const page = doc.loadPage(p);
    const lines = extractSortedLinesFromPage(page);

    // Kiểm tra nếu trang này chỉ là Bảng đáp án thì bỏ qua không tạo câu hỏi mới
    const isOnlyAnswerPage = lines.some((l) => /BẢNG ĐÁP ÁN/i.test(l.text)) &&
      lines.filter((l) => /^C[âa]u\s*\d+\s*[:.]/i.test(l.text)).length === 0;
    if (isOnlyAnswerPage) continue;

    // Tìm các mốc bắt đầu của Câu hỏi trên trang
    const qStarts = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const m = l.text.match(/^C[âa]u\s*(\d+)\s*[:.]/i);
      if (m) {
        qStarts.push({ qNum: Number(m[1]), y0: l.y, lineIdx: i });
      }
    }

    if (qStarts.length === 0) continue;

    const pageBounds = page.getBounds();
    const pageH = pageBounds[3] || 842;

    for (let k = 0; k < qStarts.length; k++) {
      const qInfo = qStarts[k];
      const nextQ = qStarts[k + 1];
      const endLineIdx = nextQ ? nextQ.lineIdx - 1 : lines.length - 1;
      const qLines = lines.slice(qInfo.lineIdx, endLineIdx + 1);

      const yStartPx = Math.max(0, qInfo.y0 - 15);
      const yEndPx = nextQ
        ? Math.max(yStartPx + 40, nextQ.y0 - 8)
        : Math.min(pageH, (qLines[qLines.length - 1]?.y || qInfo.y0 + 100) + 25);

      // Tạo SVG cắt đúng vùng câu hỏi (bao gồm cả Bảng biến thiên / Đồ thị bên phải)
      const yminNorm = Math.max(0, Math.round((yStartPx / pageH) * 1000));
      const ymaxNorm = Math.min(1000, Math.round((yEndPx / pageH) * 1000));
      const bboxNorm = [yminNorm, 40, Math.max(yminNorm + 30, ymaxNorm), 960];
      const croppedSvg = createCroppedPageSvgFromJpeg(pageJpegs[p].url, bboxNorm);

      // Nhận diện dạng câu hỏi: TRUE_FALSE, MULTIPLE_CHOICE, hay SHORT_ANSWER
      const hasTfStatements = qLines.some((l) => /^[a-d]\)/i.test(l.text));
      const hasMcOptions = qLines.some((l) => /^[A-D]\s*[.:]/i.test(l.text));

      let qType = 'SHORT_ANSWER';
      if (answerMap.tf[qInfo.qNum] || hasTfStatements) {
        qType = 'TRUE_FALSE';
      } else if (answerMap.mc[qInfo.qNum] || hasMcOptions) {
        qType = 'MULTIPLE_CHOICE';
      }

      // Tách phần thân đề bài (stem) và các mệnh đề/phương án
      const groups = { stem: [], a: [], b: [], c: [], d: [], A: [], B: [], C: [], D: [] };
      let curGroup = 'stem';

      for (const l of qLines) {
        const tfMatch = l.text.match(/^([a-d])\)/i);
        const mcMatch = l.text.match(/^([A-D])\s*[.:]/);
        if (qType === 'TRUE_FALSE' && tfMatch) {
          curGroup = tfMatch[1].toLowerCase();
        } else if (qType === 'MULTIPLE_CHOICE' && mcMatch) {
          curGroup = mcMatch[1].toUpperCase();
        }
        groups[curGroup].push(l.text);
      }

      const stemText = groups.stem.join(' ').replace(/^C[âa]u\s*\d+\s*[:.]\s*/i, '').trim();

      if (qType === 'TRUE_FALSE') {
        const tfAns = answerMap.tf[qInfo.qNum] || null;
        const stmts = {
          a: {
            content: groups.a.join(' ').replace(/^a\)\s*/i, '').trim() || 'Mệnh đề a (xem trên đề bài)',
            correct: tfAns ? Boolean(tfAns.a) : true,
          },
          b: {
            content: groups.b.join(' ').replace(/^b\)\s*/i, '').trim() || 'Mệnh đề b (xem trên đề bài)',
            correct: tfAns ? Boolean(tfAns.b) : false,
          },
          c: {
            content: groups.c.join(' ').replace(/^c\)\s*/i, '').trim() || 'Mệnh đề c (xem trên đề bài)',
            correct: tfAns ? Boolean(tfAns.c) : true,
          },
          d: {
            content: groups.d.join(' ').replace(/^d\)\s*/i, '').trim() || 'Mệnh đề d (xem trên đề bài)',
            correct: tfAns ? Boolean(tfAns.d) : false,
          },
        };

        extractedQuestions.push({
          question_number: qInfo.qNum,
          question_type: 'true_false',
          content: stemText || `Câu ${qInfo.qNum}: Xem nội dung chi tiết trên hình đề bài`,
          svg_diagram: croppedSvg,
          images: [{ page: p + 1, bbox: bboxNorm, diagram_type: 'custom_figure' }],
          statements: stmts,
          correct_answer: tfAns || { a: true, b: false, c: true, d: false },
          source_page: p + 1,
          points: 1.0,
          confidence: tfAns ? 0.98 : 0.85,
          status: tfAns ? 'verified' : 'NEEDS_REVIEW',
          review_reason: tfAns ? null : 'Cần Giáo viên xác nhận đáp án Đúng/Sai cho 4 mệnh đề.',
        });
      } else if (qType === 'MULTIPLE_CHOICE') {
        const mcAns = answerMap.mc[qInfo.qNum] || '';
        const options = {
          A: groups.A.join(' ').replace(/^A\s*[.:]\s*/i, '').trim() || 'Phương án A',
          B: groups.B.join(' ').replace(/^B\s*[.:]\s*/i, '').trim() || 'Phương án B',
          C: groups.C.join(' ').replace(/^C\s*[.:]\s*/i, '').trim() || 'Phương án C',
          D: groups.D.join(' ').replace(/^D\s*[.:]\s*/i, '').trim() || 'Phương án D',
        };

        const hasAns = ['A', 'B', 'C', 'D'].includes(mcAns);
        extractedQuestions.push({
          question_number: qInfo.qNum,
          question_type: 'multiple_choice',
          content: stemText || `Câu ${qInfo.qNum}: Xem nội dung chi tiết trên hình đề bài`,
          svg_diagram: croppedSvg,
          images: [{ page: p + 1, bbox: bboxNorm, diagram_type: 'custom_figure' }],
          options,
          correct_answer: hasAns ? mcAns : '',
          source_page: p + 1,
          points: 0.25,
          confidence: hasAns ? 0.98 : 0.7,
          status: hasAns ? 'verified' : 'NEEDS_REVIEW',
          review_reason: hasAns ? null : 'Chưa có đáp án trắc nghiệm A/B/C/D trong bảng đáp án.',
        });
      } else {
        const saAns = answerMap.sa[qInfo.qNum] || '';
        extractedQuestions.push({
          question_number: qInfo.qNum,
          question_type: 'short_answer',
          content: stemText || `Câu ${qInfo.qNum}: Xem nội dung chi tiết trên hình đề bài`,
          svg_diagram: croppedSvg,
          images: [{ page: p + 1, bbox: bboxNorm, diagram_type: 'custom_figure' }],
          correct_answer: saAns,
          equivalent_answers: saAns ? [saAns] : [],
          source_page: p + 1,
          points: 0.5,
          confidence: saAns ? 0.98 : 0.7,
          status: saAns ? 'verified' : 'NEEDS_REVIEW',
          review_reason: saAns ? null : 'Cần kiểm tra đáp số trả lời ngắn.',
        });
      }
    }
  }

  const cleanTitle = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  return {
    exam_title: cleanTitle,
    detected_grade: 12,
    detected_chapter: 'CHƯƠNG I. ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ CỦA HÀM SỐ',
    has_answer_key_in_pdf: Object.keys(answerMap.tf).length > 0 || Object.keys(answerMap.mc).length > 0,
    questions: extractedQuestions,
    embeddedJpegs: pageJpegs,
  };
}
