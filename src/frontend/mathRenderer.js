/**
 * Bộ hiển thị công thức Toán học LaTeX chuyên dụng cho Space X Math
 * Hỗ trợ đầy đủ cú pháp LaTeX THPT ($...$, $$...$$, \frac, \sqrt, \int, \lim, \overrightarrow, \vec, \widehat, mũ, chỉ số dưới)
 * hoạt động tức thì cả khi có mạng (KaTeX) lẫn khi chạy độc lập trong môi trường nội bộ (Offline Sandbox).
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tìm cặp ngoặc nhọn { ... } cân bằng bắt đầu tại vị trí openBraceIdx
 */
function extractBalancedBraces(str, openBraceIdx) {
  if (str[openBraceIdx] !== '{') return null;
  let depth = 0;
  for (let i = openBraceIdx; i < str.length; i++) {
    if (str[i] === '{' && str[i - 1] !== '\\') depth++;
    else if (str[i] === '}' && str[i - 1] !== '\\') {
      depth--;
      if (depth === 0) {
        return {
          inner: str.slice(openBraceIdx + 1, i),
          endIdx: i,
        };
      }
    }
  }
  return null;
}

/**
 * Chuyển đổi biểu thức LaTeX bên trong $...$ sang HTML Toán học chuẩn xác
 */
export function convertLatexExpressionToHtml(latexRaw) {
  let s = String(latexRaw || '').trim();

  // Nếu trình duyệt đã tải thư viện KaTeX toàn cục thì ưu tiên dùng KaTeX
  if (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') {
    try {
      return window.katex.renderToString(s, { throwOnError: false });
    } catch {
      // Fallback xuống bộ dựng HTML Toán học nội bộ
    }
  }

  // Xử lý \overrightarrow{AB}, \vec{u}, \widehat{ABC}
  s = s.replace(/\\overrightarrow\{([^}]+)\}/g, '<span class="math-vec">$1</span>');
  s = s.replace(/\\vec\{([^}]+)\}/g, '<span class="math-vec">$1</span>');
  s = s.replace(/\\widehat\{([^}]+)\}/g, '<span class="math-hat">$1</span>');

  // Xử lý \frac{tu}{mau} (bao gồm cả phân số lồng nhau)
  let safety = 0;
  while (s.includes('\\frac{') && safety < 25) {
    safety++;
    const idx = s.indexOf('\\frac{');
    const numGroup = extractBalancedBraces(s, idx + 5);
    if (!numGroup) break;
    const denGroup = extractBalancedBraces(s, numGroup.endIdx + 1);
    if (!denGroup) break;
    const numHtml = convertLatexExpressionToHtml(numGroup.inner);
    const denHtml = convertLatexExpressionToHtml(denGroup.inner);
    const fracHtml = `<span class="math-frac"><span class="math-num">${numHtml}</span><span class="math-den">${denHtml}</span></span>`;
    s = s.slice(0, idx) + fracHtml + s.slice(denGroup.endIdx + 1);
  }

  // Xử lý \sqrt{...}
  safety = 0;
  while (s.includes('\\sqrt{') && safety < 20) {
    safety++;
    const idx = s.indexOf('\\sqrt{');
    const radGroup = extractBalancedBraces(s, idx + 5);
    if (!radGroup) break;
    const innerHtml = convertLatexExpressionToHtml(radGroup.inner);
    const sqrtHtml = `<span class="math-sqrt">&radic;<span class="math-sqrt-body">${innerHtml}</span></span>`;
    s = s.slice(0, idx) + sqrtHtml + s.slice(radGroup.endIdx + 1);
  }

  // Xử lý tích phân \int_{a}^{b} hoặc \int_a^b
  s = s.replace(
    /\\int_\{([^}]+)\}\^\{([^}]+)\}/g,
    '<span class="math-int"><span class="math-int-sup">$2</span><span class="math-int-sym">&int;</span><span class="math-int-sub">$1</span></span>'
  );
  s = s.replace(
    /\\int_([a-zA-Z0-9+-]+)\^([a-zA-Z0-9+-]+)/g,
    '<span class="math-int"><span class="math-int-sup">$2</span><span class="math-int-sym">&int;</span><span class="math-int-sub">$1</span></span>'
  );
  s = s.replace(/\\int\b/g, '<span class="math-int-sym">&int;</span>');

  // Xử lý giới hạn \lim_{...}
  s = s.replace(
    /\\lim_\{([^}]+)\}/g,
    '<span class="math-lim"><span class="math-lim-op">lim</span><span class="math-lim-sub">$1</span></span>'
  );
  s = s.replace(
    /\\max_\{([^}]+)\}/g,
    '<span class="math-lim"><span class="math-lim-op">max</span><span class="math-lim-sub">$1</span></span>'
  );
  s = s.replace(
    /\\min_\{([^}]+)\}/g,
    '<span class="math-lim"><span class="math-lim-op">min</span><span class="math-lim-sub">$1</span></span>'
  );

  // Xử lý cận tích phân \Big|_a^b
  s = s.replace(/\\Big\|_([a-zA-Z0-9+-]+)\^([a-zA-Z0-9+-]+)/g, '<span class="math-eval-bar">|<sub>$1</sub><sup>$2</sup></span>');

  // Ký hiệu độ ^\circ
  s = s.replace(/\^\\circ/g, '&deg;');
  s = s.replace(/\\circ/g, '&deg;');

  // Thay thế các ký hiệu toán học LaTeX phổ biến
  const symbolMap = [
    [/\\mathbb\{R\}/g, '&#8477;'],
    [/\\mathbb\{Z\}/g, '&#8484;'],
    [/\\mathbb\{N\}/g, '&#8469;'],
    [/\\infty/g, '&infin;'],
    [/\\pm/g, '&plusmn;'],
    [/\\mp/g, '&#8723;'],
    [/\\cdot/g, '&middot;'],
    [/\\times/g, '&times;'],
    [/\\le\b|\\leq\b/g, '&le;'],
    [/\\ge\b|\\geq\b/g, '&ge;'],
    [/\\ne\b|\\neq\b/g, '&ne;'],
    [/\\approx/g, '&approx;'],
    [/\\iff/g, '&hArr;'],
    [/\\Rightarrow/g, '&rArr;'],
    [/\\Leftarrow/g, '&lArr;'],
    [/\\to\b|\\rightarrow\b/g, '&rarr;'],
    [/\\in\b/g, '&isin;'],
    [/\\notin\b/g, '&notin;'],
    [/\\subset\b/g, '&sub;'],
    [/\\cup\b/g, '&cup;'],
    [/\\cap\b/g, '&cap;'],
    [/\\setminus/g, '&#8726;'],
    [/\\emptyset/g, '&empty;'],
    [/\\pi\b/g, '&pi;'],
    [/\\alpha\b/g, '&alpha;'],
    [/\\beta\b/g, '&beta;'],
    [/\\varphi\b/g, '&phi;'],
    [/\\Delta\b/g, '&Delta;'],
    [/\\sin\b/g, '<span class="math-fn">sin</span>'],
    [/\\cos\b/g, '<span class="math-fn">cos</span>'],
    [/\\tan\b/g, '<span class="math-fn">tan</span>'],
    [/\\cot\b/g, '<span class="math-fn">cot</span>'],
    [/\\ln\b/g, '<span class="math-fn">ln</span>'],
    [/\\log\b/g, '<span class="math-fn">log</span>'],
    [/\\\{/g, '{'],
    [/\\\}/g, '}'],
    [/\\,/g, '&thinsp;'],
    [/\\;/g, '&ensp;'],
    [/\\quad/g, '&emsp;'],
  ];

  for (const [regex, replacement] of symbolMap) {
    s = s.replace(regex, replacement);
  }

  // Xử lý lũy thừa ^{...} và ^x, chỉ số dưới _{...} và _x
  s = s.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  s = s.replace(/\^([0-9a-zA-Z+-])/g, '<sup>$1</sup>');
  s = s.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  s = s.replace(/_([0-9a-zA-Z+-]+)/g, '<sub>$1</sub>');

  return `<span class="math-inline">${s}</span>`;
}

/**
 * Ảnh cắt trực tiếp từ trang PDF gốc (giữ nguyên 100% phông chữ, công thức, bảng biến thiên, đồ thị)
 * Cú pháp: [[PDFCROP:url|pageW|pageH|x0|y0|x1|y1]]  (toạ độ theo pixel của ảnh trang)
 */
const PDF_CROP_REGEX = /\[\[PDFCROP:([^|\]]+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\]\]/g;
const SEE_ABOVE_TOKEN = '[[SEE_ABOVE]]';

function renderPdfCropHtml(url, pageW, pageH, x0, y0, x1, y1) {
  const w = Math.max(10, x1 - x0);
  const h = Math.max(10, y1 - y0);
  const safeUrl = escapeHtml(url);
  // Ảnh trang được dựng ở tỉ lệ ~2x (≈1190px chiều rộng A4) => hiển thị ở 1/1.35 kích thước để chữ có cỡ tự nhiên
  const maxWidth = Math.round(w / 1.35);
  return `<div class="pdf-crop" style="width:100%;max-width:${maxWidth}px;margin:4px 0;">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="xMinYMin meet" style="display:block;width:100%;height:auto;aspect-ratio:${w} / ${h};background:#fff;">
      <image href="${safeUrl}" x="0" y="0" width="${pageW}" height="${pageH}" />
    </svg>
  </div>`;
}

/**
 * Render chuỗi văn bản có chứa công thức LaTeX ($$...$$ và $...$) sang HTML an toàn
 */
export function renderMathText(rawText) {
  if (!rawText) return '';
  const fullText = String(rawText);

  if (fullText.trim() === SEE_ABOVE_TOKEN) {
    return '<span class="text-slate-400 italic text-sm">(như trong đề bài)</span>';
  }

  if (fullText.includes('[[PDFCROP:')) {
    let html = '';
    let last = 0;
    PDF_CROP_REGEX.lastIndex = 0;
    let m;
    while ((m = PDF_CROP_REGEX.exec(fullText)) !== null) {
      const before = fullText.slice(last, m.index).trim();
      if (before) html += renderMathTextCore(before);
      html += renderPdfCropHtml(m[1], +m[2], +m[3], +m[4], +m[5], +m[6], +m[7]);
      last = PDF_CROP_REGEX.lastIndex;
    }
    const after = fullText.slice(last).trim();
    if (after) html += renderMathTextCore(after);
    return html;
  }

  return renderMathTextCore(fullText);
}

function renderMathTextCore(text) {
  const tokens = [];
  let lastIndex = 0;
  const mathRegex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let match;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        value: escapeHtml(text.slice(lastIndex, match.index)).replace(/\n/g, '<br/>'),
      });
    }
    if (match[1] !== undefined) {
      tokens.push({
        type: 'block-math',
        value: `<div class="math-block">${convertLatexExpressionToHtml(match[1])}</div>`,
      });
    } else if (match[2] !== undefined) {
      tokens.push({
        type: 'inline-math',
        value: convertLatexExpressionToHtml(match[2]),
      });
    }
    lastIndex = mathRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      value: escapeHtml(text.slice(lastIndex)).replace(/\n/g, '<br/>'),
    });
  }

  return tokens.map((t) => t.value).join('');
}
