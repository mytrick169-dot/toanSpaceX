import { getDb } from './database.mjs';
import { hashPassword } from '../services/authService.mjs';
import { ensureStorageDirs } from '../services/storageService.mjs';

/**
 * Khởi tạo dữ liệu nền tảng chuẩn (Chỉ tạo tài khoản Admin mặc định và khung Chương trình Toán THPT,
 * tuyệt đối KHÔNG tạo học sinh giả, đề thi giả hay lượt nộp bài giả).
 */
export function ensureSeedData() {
  const db = getDb();
  ensureStorageDirs();

  // 1. Đảm bảo có ít nhất 1 tài khoản Giáo viên Quản trị (Admin)
  const adminExisting = db.prepare('SELECT id FROM users WHERE role_id = 1 LIMIT 1').get();
  if (!adminExisting) {
    const adminHash = hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'admin123');
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, nickname, class_name, role_id, status)
      VALUES ('admin', ?, 'Giáo viên Quản trị', 'Giáo viên', 'GV-THPT', 1, 'ACTIVE')
    `).run(adminHash);
  }

  // 2. Đảm bảo có Môn Toán học 12 (id = 1) và các Chương / Bài học chuẩn THPT
  let math12 = db.prepare('SELECT id FROM subjects WHERE grade = 12 LIMIT 1').get();
  if (!math12) {
    const info = db.prepare(`
      INSERT INTO subjects (id, name, grade, description, order_index)
      VALUES (1, 'Toán học 12', 12, 'Chương trình Toán lớp 12 THPT & Luyện thi Tốt nghiệp THPT Quốc gia', 1)
    `).run();
    math12 = { id: Number(info.lastInsertRowid) };
  }

  const ch12Count = db.prepare('SELECT COUNT(*) as c FROM chapters WHERE subject_id = ?').get(math12.id).c;
  if (ch12Count === 0) {
    const insertChapter = db.prepare(`
      INSERT OR IGNORE INTO chapters (id, subject_id, name, description, order_index)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertChapter.run(
      1,
      math12.id,
      'Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
      'Tính đơn điệu, cực trị, GTLN-GTNN, đường tiệm cận và khảo sát hàm số',
      1
    );
    insertChapter.run(
      2,
      math12.id,
      'Chương 2: Vectơ và Hệ trục tọa độ trong không gian',
      'Vectơ trong không gian, tích vô hướng của hai vectơ và tọa độ trong không gian Oxyz',
      2
    );
    insertChapter.run(
      3,
      math12.id,
      'Chương 3: Nguyên hàm, Tích phân và Ứng dụng',
      'Nguyên hàm, tích phân xác định, ứng dụng tính diện tích và thể tích khối tròn xoay',
      3
    );
    insertChapter.run(
      4,
      math12.id,
      'Chương 4: Phương pháp tọa độ trong không gian Oxyz',
      'Phương trình mặt phẳng, đường thẳng, mặt cầu và bài toán khoảng cách, góc',
      4
    );

    const insertLesson = db.prepare(`
      INSERT OR IGNORE INTO lessons (id, chapter_id, name, description, order_index)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertLesson.run(1, 1, 'Bài 1: Tính đơn điệu và cực trị của hàm số', 'Xét dấu đạo hàm, khoảng đồng biến, nghịch biến và điểm cực trị', 1);
    insertLesson.run(2, 1, 'Bài 2: Giá trị lớn nhất và giá trị nhỏ nhất của hàm số', 'Tìm GTLN, GTNN trên đoạn và ứng dụng thực tiễn', 2);
    insertLesson.run(3, 1, 'Bài 3: Đường tiệm cận và Khảo sát đồ thị hàm số', 'Tiệm cận đứng, tiệm cận ngang, tiệm cận xiên và nhận dạng đồ thị', 3);
    insertLesson.run(4, 2, 'Bài 1: Vectơ và Tích vô hướng của hai vectơ trong không gian', 'Góc giữa hai vectơ, tích vô hướng và ứng dụng trong hình học không gian', 1);
    insertLesson.run(5, 3, 'Bài 1: Nguyên hàm và Tích phân cơ bản', 'Bảng nguyên hàm, tính chất tích phân và ứng dụng hình học', 1);
    insertLesson.run(6, 4, 'Bài 1: Phương trình mặt phẳng và đường thẳng trong Oxyz', 'Vectơ pháp tuyến, vectơ chỉ phương và khoảng cách', 1);
  }
}
