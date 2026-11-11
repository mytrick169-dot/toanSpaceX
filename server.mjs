import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV } from './src/backend/config/env.mjs';
import { getDb } from './src/backend/db/database.mjs';
import { ensureSeedData } from './src/backend/db/seed.mjs';
import { recalculateAllExamsPointsTo10 } from './src/backend/services/examService.mjs';
import { handleApiRequest } from './src/backend/controllers/apiRouter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.join(__dirname, 'src', 'frontend');

// Khởi tạo Database & Dữ liệu mẫu thực tế khi khởi động Server
getDb();
ensureSeedData();
try {
  recalculateAllExamsPointsTo10();
} catch (e) {
  console.warn('[Points Rebalance Warning]:', e.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

export const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // 1. Chuyển toàn bộ yêu cầu /api/* sang tầng Backend REST Controller
    if (urlObj.pathname.startsWith('/api/')) {
      return await handleApiRequest(req, res, urlObj);
    }

    // 2. Phục vụ các tài nguyên tĩnh của tầng Frontend (src/frontend)
    let relPath = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullFilePath = path.join(FRONTEND_DIR, safePath);

    if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).isFile()) {
      const ext = path.extname(fullFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(fullFilePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      return res.end(content);
    }

    // SPA Fallback về index.html
    const indexHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(indexHtml);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
  }
});

// Chỉ lắng nghe cổng khi chạy trực tiếp server.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const port = Number(process.env.PORT || ENV.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`====================================================================`);
    console.log(`🚀 SPACE X MATH SERVER ĐANG HOẠT ĐỘNG TẠI: http://localhost:${port}`);
    console.log(`🌐 Đường dẫn Đăng ký cho Học sinh:        http://localhost:${port}/#/register`);
    console.log(`🤖 Gemini AI Model cấu hình (.env):       ${ENV.GEMINI_MODEL}`);
    console.log(`👨‍🏫 Tài khoản Quản trị (Giáo viên):        admin / admin123`);
    console.log(`====================================================================`);

    // Tự động giữ kết nối (Keep-Alive) mỗi 10 phút trên Render Cloud để tránh container ngủ đông
    const externalUrl = process.env.RENDER_EXTERNAL_URL || '';
    if (externalUrl) {
      setInterval(() => {
        fetch(`${externalUrl}/api/curriculum`).catch(() => {});
      }, 10 * 60 * 1000);
    }
  });
}

