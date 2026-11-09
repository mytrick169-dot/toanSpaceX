import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ENV } from '../config/env.mjs';

const PDF_DIR = path.join(ENV.STORAGE_PATH, 'pdfs');
const FIGURE_DIR = path.join(ENV.STORAGE_PATH, 'figures');

export function ensureStorageDirs() {
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
  if (!fs.existsSync(FIGURE_DIR)) fs.mkdirSync(FIGURE_DIR, { recursive: true });
}

/**
 * Lưu file PDF gốc vào hệ thống lưu trữ
 */
export function savePdfBuffer(originalFileName, buffer) {
  ensureStorageDirs();
  const safeBase = String(originalFileName || 'document.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.pdf$/i, '');
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const storedFileName = `${Date.now()}_${uniqueId}_${safeBase}.pdf`;
  const fullPath = path.join(PDF_DIR, storedFileName);
  fs.writeFileSync(fullPath, buffer);
  return {
    storedFileName,
    relativePath: `pdfs/${storedFileName}`,
    fullPath,
    fileSize: buffer.length,
  };
}

/**
 * Thay thế nội dung file PDF gốc
 */
export function replacePdfBuffer(existingRelativePath, originalFileName, buffer) {
  ensureStorageDirs();
  if (existingRelativePath) {
    const oldPath = path.join(ENV.STORAGE_PATH, existingRelativePath);
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch {
        // ignore
      }
    }
  }
  return savePdfBuffer(originalFileName, buffer);
}

/**
 * Lưu hình ảnh/biểu đồ trích xuất từ trang PDF (base64 PNG/JPEG hoặc SVG)
 */
export function saveFigureDataUrl(dataUrlOrSvg, prefix = 'fig') {
  ensureStorageDirs();
  const uniqueId = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  if (dataUrlOrSvg.startsWith('data:image/')) {
    const match = dataUrlOrSvg.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (match) {
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1] === 'svg+xml' ? 'svg' : 'png';
      const fileName = `${prefix}_${uniqueId}.${ext}`;
      const fullPath = path.join(FIGURE_DIR, fileName);
      fs.writeFileSync(fullPath, Buffer.from(match[2], 'base64'));
      return `/api/storage/figures/${fileName}`;
    }
  } else if (dataUrlOrSvg.trim().startsWith('<svg')) {
    const fileName = `${prefix}_${uniqueId}.svg`;
    const fullPath = path.join(FIGURE_DIR, fileName);
    fs.writeFileSync(fullPath, dataUrlOrSvg, 'utf-8');
    return `/api/storage/figures/${fileName}`;
  }
  return dataUrlOrSvg;
}

/**
 * Đọc Buffer của file từ đường dẫn tương đối trong storage
 */
export function readStorageFile(relativePath) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(ENV.STORAGE_PATH, normalized);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

/**
 * Xóa file trong storage
 */
export function deleteStorageFile(relativePath) {
  if (!relativePath) return;
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(ENV.STORAGE_PATH, normalized);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // ignore
    }
  }
}

