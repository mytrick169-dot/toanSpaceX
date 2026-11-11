import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '../../../');

/**
 * Đọc biến môi trường từ file .env ở thư mục gốc của dự án
 */
export function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, '.env');
  const parsed = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      parsed[key] = val;
    }
  }
  return parsed;
}

const fileEnv = loadEnvFile();

function getEnv(key, defaultValue = '') {
  if (process.env[key] !== undefined && process.env[key] !== '') {
    return process.env[key];
  }
  if (fileEnv[key] !== undefined && fileEnv[key] !== '') {
    return fileEnv[key];
  }
  return defaultValue;
}

/**
 * Cấu hình tập trung duy nhất cho toàn bộ Backend và Gemini AI Engine
 */
export const ENV = {
  PORT: Number(getEnv('PORT', '3000')),
  JWT_SECRET: getEnv('JWT_SECRET', 'spacex_math_super_secret_jwt_key_2026_production_grade'),
  JWT_EXPIRES_IN_HOURS: Number(getEnv('JWT_EXPIRES_IN_HOURS', '168')),

  // Cấu hình Gemini API tập trung tại một nơi duy nhất
  get GEMINI_API_KEY() {
    const latestFile = loadEnvFile();
    return process.env.GEMINI_API_KEY || latestFile.GEMINI_API_KEY || '';
  },
  get GEMINI_MODEL() {
    const latestFile = loadEnvFile();
    return process.env.GEMINI_MODEL || latestFile.GEMINI_MODEL || 'gemini-3.8-flash';
  },
  get GEMINI_FALLBACK_MODEL() {
    const latestFile = loadEnvFile();
    return process.env.GEMINI_FALLBACK_MODEL || latestFile.GEMINI_FALLBACK_MODEL || 'gemini-flash-latest';
  },
  GEMINI_REQUESTED_TARGET: getEnv('GEMINI_REQUESTED_TARGET', 'gemini-4-argon'),
  GEMINI_API_BASE_URL: getEnv('GEMINI_API_BASE_URL', 'https://generativelanguage.googleapis.com'),
  GEMINI_MAX_RETRIES: Number(getEnv('GEMINI_MAX_RETRIES', '3')),
  GEMINI_RETRY_BASE_DELAY_MS: Number(getEnv('GEMINI_RETRY_BASE_DELAY_MS', '1500')),
  GEMINI_RATE_LIMIT_PER_MINUTE: Number(getEnv('GEMINI_RATE_LIMIT_PER_MINUTE', '10')),
  GEMINI_RATE_LIMIT_PER_DAY: Number(getEnv('GEMINI_RATE_LIMIT_PER_DAY', '200')),
  GEMINI_INLINE_PDF_MAX_BYTES: Number(getEnv('GEMINI_INLINE_PDF_MAX_BYTES', '15728640')), // 15 MB
  GEMINI_MIN_CONFIDENCE_THRESHOLD: Number(getEnv('GEMINI_MIN_CONFIDENCE_THRESHOLD', '0.85')),

  STORAGE_DRIVER: getEnv('STORAGE_DRIVER', 'local'),
  STORAGE_PATH: path.resolve(ROOT_DIR, getEnv('STORAGE_PATH', './storage')),
  DATABASE_PATH: path.resolve(ROOT_DIR, getEnv('DATABASE_PATH', './data/spacexmath.db')),
  LOG_DIR: path.resolve(ROOT_DIR, './logs'),
};

/**
 * Cập nhật biến cấu hình trong file .env (chỉ gọi từ Admin Backend)
 */
export function updateEnvVariables(updates = {}) {
  const envPath = path.join(ROOT_DIR, '.env');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;
    process.env[key] = String(value);
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(envPath, content.trim() + '\n', 'utf-8');
}

