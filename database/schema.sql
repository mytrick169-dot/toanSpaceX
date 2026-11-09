-- ============================================================================
-- SPACE X MATH – AI-POWERED EXAM & LEARNING PLATFORM
-- PostgreSQL Database Schema (14 Normalized Core Tables + Auxiliary Tables)
-- ============================================================================

-- 1. ROLES (Vai trò người dùng: ADMIN, STUDENT)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS (Người dùng: Giáo viên/Admin & Học sinh)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  nickname VARCHAR(100),
  class_name VARCHAR(50) DEFAULT '12A1',
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status VARCHAR(30) DEFAULT 'ACTIVE', -- 'ACTIVE' | 'LOCKED'
  streak_days INTEGER DEFAULT 0,
  best_streak_days INTEGER DEFAULT 0,
  last_active_date VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. SUBJECTS (Môn học & Khối lớp: Toán học - Lớp 12, 11, 10)
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  grade INTEGER NOT NULL DEFAULT 12,
  description TEXT,
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. CHAPTERS (Chương học thuộc Môn học)
CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. LESSONS (Bài học thuộc Chương)
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. PDF_DOCUMENTS (Quản lý file PDF gốc giáo viên upload)
CREATE TABLE IF NOT EXISTS pdf_documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  file_name VARCHAR(300) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 1,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  parse_status VARCHAR(50) DEFAULT 'COMPLETED', -- 'PROCESSING' | 'COMPLETED' | 'NEEDS_REVIEW' | 'FAILED'
  extracted_raw_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. EXAMS (Bộ bài tập luyện tập & Đề kiểm tra)
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  exam_type VARCHAR(50) DEFAULT 'EXAM', -- 'PRACTICE' (Bộ bài tập) | 'EXAM' (Đề kiểm tra)
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  pdf_document_id INTEGER REFERENCES pdf_documents(id) ON DELETE SET NULL,
  default_duration_minutes INTEGER DEFAULT 45,
  allow_unlimited_time BOOLEAN DEFAULT TRUE,
  allow_review BOOLEAN DEFAULT TRUE,
  total_points DOUBLE PRECISION DEFAULT 10.0,
  status VARCHAR(50) DEFAULT 'PUBLISHED', -- 'DRAFT' | 'PUBLISHED' | 'HIDDEN'
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng trung gian cho phép gắn 1 file PDF với nhiều bộ bài tập/đề thi
CREATE TABLE IF NOT EXISTS exam_pdf_links (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  pdf_document_id INTEGER NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(exam_id, pdf_document_id)
);

-- 8. QUESTIONS (Câu hỏi: MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER)
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_type VARCHAR(50) NOT NULL DEFAULT 'MULTIPLE_CHOICE', -- 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER'
  content TEXT NOT NULL, -- Hỗ trợ công thức LaTeX ($...$, $$...$$)
  image_url TEXT, -- Hình ảnh, đồ thị, bảng biến thiên (data URL hoặc đường dẫn file)
  svg_diagram TEXT, -- Đồ thị / bảng biến thiên SVG sắc nét nếu có
  page_number INTEGER DEFAULT 1,
  figure_bbox TEXT, -- JSON {"page":1,"x":0.1,"y":0.2,"w":0.8,"h":0.3}
  points DOUBLE PRECISION DEFAULT 0.25,
  order_index INTEGER DEFAULT 1,
  needs_review BOOLEAN DEFAULT FALSE,
  ai_confidence DOUBLE PRECISION DEFAULT 0.98,
  review_note TEXT,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. QUESTION_OPTIONS (Các phương án A, B, C, D hoặc mệnh đề a, b, c, d)
CREATE TABLE IF NOT EXISTS question_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_key VARCHAR(20) NOT NULL, -- 'A', 'B', 'C', 'D' hoặc 'a', 'b', 'c', 'd'
  content TEXT NOT NULL, -- Nội dung phương án/mệnh đề (hỗ trợ LaTeX)
  image_url TEXT,
  order_index INTEGER DEFAULT 1
);

-- 10. CORRECT_ANSWERS (Đáp án chuẩn xác nhận bởi Giáo viên)
CREATE TABLE IF NOT EXISTS correct_answers (
  id SERIAL PRIMARY KEY,
  question_id INTEGER UNIQUE NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_key TEXT, -- Với MULTIPLE_CHOICE: 'A'|'B'|'C'|'D'. Với TRUE_FALSE: JSON '{"a":true,"b":false,"c":true,"d":false}'
  short_answer_value VARCHAR(200), -- Với SHORT_ANSWER: giá trị chuẩn, ví dụ '0.5'
  equivalent_answers TEXT, -- JSON mảng các cách viết tương đương: '["0.5", "0,5", "1/2"]'
  explanation TEXT
);

-- 11. EXAM_ATTEMPTS (Lượt làm bài và kiểm soát thời gian ở Backend)
CREATE TABLE IF NOT EXISTS exam_attempts (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_duration_minutes INTEGER DEFAULT 45, -- 0 = Không giới hạn thời gian
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Thời điểm hết hạn kiểm soát bởi Backend (NULL nếu không giới hạn)
  submitted_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED'
  total_score DOUBLE PRECISION DEFAULT 0,
  max_score DOUBLE PRECISION DEFAULT 10,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  blank_count INTEGER DEFAULT 0
);

-- 12. STUDENT_ANSWERS (Chi tiết câu trả lời của học sinh trong từng lượt làm bài)
CREATE TABLE IF NOT EXISTS student_answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option VARCHAR(20), -- Cho MULTIPLE_CHOICE ('A', 'B', 'C', 'D')
  tf_answers TEXT, -- Cho TRUE_FALSE (JSON '{"a":true,"b":false,"c":null,"d":true}')
  short_answer VARCHAR(200), -- Cho SHORT_ANSWER
  is_flagged BOOLEAN DEFAULT FALSE, -- Đánh dấu câu hỏi cần xem lại
  is_answered BOOLEAN DEFAULT FALSE,
  is_correct BOOLEAN DEFAULT FALSE,
  earned_points DOUBLE PRECISION DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attempt_id, question_id)
);

-- 13. LEADERBOARD (Bảng xếp hạng học sinh theo ngày và toàn thời gian)
CREATE TABLE IF NOT EXISTS leaderboard (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_type VARCHAR(30) NOT NULL DEFAULT 'ALL_TIME', -- 'DAILY' | 'MONTHLY' | 'ALL_TIME'
  period_key VARCHAR(30) NOT NULL DEFAULT 'ALL', -- Ví dụ: '2026-11-09', '2026-11', 'ALL'
  total_score DOUBLE PRECISION DEFAULT 0,
  submission_count INTEGER DEFAULT 0,
  average_score DOUBLE PRECISION DEFAULT 0,
  highest_score DOUBLE PRECISION DEFAULT 0,
  rank_position INTEGER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, period_type, period_key)
);

-- 14. LEARNING_ACTIVITIES (Hoạt động học tập GitHub-style Contribution Graph)
CREATE TABLE IF NOT EXISTS learning_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date VARCHAR(20) NOT NULL, -- Định dạng 'YYYY-MM-DD'
  submission_count INTEGER DEFAULT 0,
  completed_exams_count INTEGER DEFAULT 0,
  total_score_earned DOUBLE PRECISION DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, activity_date)
);

-- 15. SYSTEM_SETTINGS (Cấu hình hệ thống: Bảng xếp hạng, Biệt danh, AI Config)
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes tối ưu hóa truy vấn
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter_id);
CREATE INDEX IF NOT EXISTS idx_exams_lesson ON exams(lesson_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON learning_activities(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard(period_type, period_key, total_score DESC);

