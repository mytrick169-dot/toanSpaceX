import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ENV } from '../config/env.mjs';

let dbInstance = null;

/**
 * Khởi tạo và trả về kết nối Database chuẩn hóa (14 bảng cốt lõi + bảng phụ trợ)
 */
export function getDb() {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(ENV.DATABASE_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(ENV.DATABASE_PATH);
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  initSchema(dbInstance);
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    -- 1. ROLES
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 2. USERS
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      nickname TEXT,
      class_name TEXT DEFAULT '12A1',
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      status TEXT DEFAULT 'ACTIVE',
      streak_days INTEGER DEFAULT 0,
      best_streak_days INTEGER DEFAULT 0,
      last_active_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 3. SUBJECTS
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade INTEGER NOT NULL DEFAULT 12,
      description TEXT,
      order_index INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 4. CHAPTERS
    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      order_index INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 5. LESSONS
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      order_index INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 6. PDF_DOCUMENTS
    CREATE TABLE IF NOT EXISTS pdf_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      page_count INTEGER DEFAULT 1,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
      lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      parse_status TEXT DEFAULT 'COMPLETED',
      ai_model_used TEXT,
      extracted_raw_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 7. EXAMS
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      exam_type TEXT DEFAULT 'EXAM',
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
      lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
      pdf_document_id INTEGER REFERENCES pdf_documents(id) ON DELETE SET NULL,
      default_duration_minutes INTEGER DEFAULT 45,
      allow_unlimited_time INTEGER DEFAULT 1,
      allow_review INTEGER DEFAULT 1,
      total_points REAL DEFAULT 10.0,
      status TEXT DEFAULT 'PUBLISHED',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Bảng liên kết N-N giữa PDF và Đề thi/Bộ bài tập
    CREATE TABLE IF NOT EXISTS exam_pdf_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      pdf_document_id INTEGER NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(exam_id, pdf_document_id)
    );

    -- 8. QUESTIONS
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      question_number INTEGER DEFAULT 1,
      question_type TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE',
      content TEXT NOT NULL,
      image_url TEXT,
      images_json TEXT DEFAULT '[]',
      svg_diagram TEXT,
      source_page INTEGER DEFAULT 1,
      figure_bbox TEXT,
      points REAL DEFAULT 0.25,
      order_index INTEGER DEFAULT 1,
      confidence REAL DEFAULT 0.99,
      status TEXT DEFAULT 'verified',
      needs_review INTEGER DEFAULT 0,
      review_reason TEXT,
      explanation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 9. QUESTION_OPTIONS
    CREATE TABLE IF NOT EXISTS question_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      option_key TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      order_index INTEGER DEFAULT 1
    );

    -- 10. CORRECT_ANSWERS
    CREATE TABLE IF NOT EXISTS correct_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER UNIQUE NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      answer_key TEXT,
      short_answer_value TEXT,
      equivalent_answers TEXT DEFAULT '[]',
      explanation TEXT
    );

    -- 11. EXAM_ATTEMPTS
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      selected_duration_minutes INTEGER DEFAULT 45,
      started_at TEXT NOT NULL,
      expires_at TEXT,
      submitted_at TEXT,
      status TEXT DEFAULT 'IN_PROGRESS',
      total_score REAL DEFAULT 0,
      max_score REAL DEFAULT 10,
      correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      blank_count INTEGER DEFAULT 0
    );

    -- 12. STUDENT_ANSWERS
    CREATE TABLE IF NOT EXISTS student_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      selected_option TEXT,
      tf_answers TEXT,
      short_answer TEXT,
      is_flagged INTEGER DEFAULT 0,
      is_answered INTEGER DEFAULT 0,
      is_correct INTEGER DEFAULT 0,
      earned_points REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(attempt_id, question_id)
    );

    -- 13. LEADERBOARD
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_type TEXT NOT NULL DEFAULT 'ALL_TIME',
      period_key TEXT NOT NULL DEFAULT 'ALL',
      total_score REAL DEFAULT 0,
      submission_count INTEGER DEFAULT 0,
      average_score REAL DEFAULT 0,
      highest_score REAL DEFAULT 0,
      rank_position INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, period_type, period_key)
    );

    -- 14. LEARNING_ACTIVITIES
    CREATE TABLE IF NOT EXISTS learning_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_date TEXT NOT NULL,
      submission_count INTEGER DEFAULT 0,
      completed_exams_count INTEGER DEFAULT 0,
      total_score_earned REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, activity_date)
    );

    -- 15. AI_PROCESSING_LOGS (Ghi nhận quá trình gọi Gemini API & đọc PDF)
    CREATE TABLE IF NOT EXISTS ai_processing_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_document_id INTEGER REFERENCES pdf_documents(id) ON DELETE SET NULL,
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      model_requested TEXT,
      model_used TEXT,
      upload_method TEXT,
      retry_count INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      questions_count INTEGER DEFAULT 0,
      needs_review_count INTEGER DEFAULT 0,
      status TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 16. SYSTEM_SETTINGS
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_exams_lesson ON exams(lesson_id);
    CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON exam_attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
    CREATE INDEX IF NOT EXISTS idx_activities_user_date ON learning_activities(user_id, activity_date);
  `);

  // Khởi tạo Roles mặc định nếu chưa có
  const roleCount = db.prepare('SELECT COUNT(*) as c FROM roles').get().c;
  if (roleCount === 0) {
    db.prepare('INSERT INTO roles (id, name, description) VALUES (1, ?, ?)').run('ADMIN', 'Giáo viên / Quản trị viên hệ thống');
    db.prepare('INSERT INTO roles (id, name, description) VALUES (2, ?, ?)').run('STUDENT', 'Học sinh THPT');
  }

  // Khởi tạo System Settings mặc định cho Leaderboard & Hệ thống
  const defaultSettings = {
    leaderboard_enabled: 'true',
    leaderboard_public: 'true',
    leaderboard_allow_nickname: 'true',
  };
  const upsertSetting = db.prepare(`
    INSERT INTO system_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON CONFLICT(setting_key) DO NOTHING
  `);
  for (const [k, v] of Object.entries(defaultSettings)) {
    upsertSetting.run(k, v);
  }
}

