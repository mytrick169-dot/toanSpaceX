import { getDb } from '../db/database.mjs';

/**
 * Lấy ngày hiện tại theo múi giờ Việt Nam (UTC+7) định dạng YYYY-MM-DD
 */
export function getVnDateString(dateObj = new Date()) {
  const vnTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

/**
 * Định dạng YYYY-MM-DD sang DD/MM/YYYY
 */
export function formatVnDisplayDate(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '';
  const parts = yyyyMmDd.slice(0, 10).split('-');
  if (parts.length !== 3) return yyyyMmDd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Xác định mức màu GitHub-style Contribution Graph theo đúng quy ước:
 * - 0 lượt: level 0 (màu xám nhạt)
 * - 1 lượt: level 1 (màu xanh nhạt)
 * - 2–3 lượt: level 2 (màu xanh trung bình)
 * - 4–5 lượt: level 3 (màu xanh đậm)
 * - Trên 5 lượt: level 4 (màu xanh đậm nhất)
 */
export function getContributionColorLevel(submissionCount) {
  const count = Number(submissionCount || 0);
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count >= 2 && count <= 3) return 2;
  if (count >= 4 && count <= 5) return 3;
  return 4;
}

/**
 * Cập nhật hoạt động học tập (LearningActivities), chuỗi ngày học liên tiếp (Streak)
 * và Bảng xếp hạng (Leaderboard) ngay khi học sinh nộp bài hợp lệ.
 */
export function recordValidSubmissionActivity(userId, scoreEarned, dateStr = getVnDateString()) {
  const db = getDb();

  // 1. Cập nhật bảng learning_activities cho ngày hôm nay
  const existingActivity = db
    .prepare('SELECT * FROM learning_activities WHERE user_id = ? AND activity_date = ?')
    .get(userId, dateStr);

  if (existingActivity) {
    db.prepare(`
      UPDATE learning_activities
      SET submission_count = submission_count + 1,
          completed_exams_count = completed_exams_count + 1,
          total_score_earned = ROUND(total_score_earned + ?, 2),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(scoreEarned, existingActivity.id);
  } else {
    db.prepare(`
      INSERT INTO learning_activities (user_id, activity_date, submission_count, completed_exams_count, total_score_earned)
      VALUES (?, ?, 1, 1, ?)
    `).run(userId, dateStr, Number(scoreEarned.toFixed(2)));
  }

  // 2. Tính lại chuỗi ngày học liên tiếp (Streak) cho học sinh
  recomputeUserStreak(userId);

  // 3. Đồng bộ lại bảng Leaderboard (Theo ngày & Toàn thời gian)
  rebuildLeaderboardTables(dateStr);
}

/**
 * Tính toán chính xác chuỗi ngày học liên tiếp (Streak) từ bảng learning_activities
 */
export function recomputeUserStreak(userId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT activity_date FROM learning_activities
       WHERE user_id = ? AND submission_count > 0
       ORDER BY activity_date DESC`
    )
    .all(userId);

  if (rows.length === 0) {
    db.prepare('UPDATE users SET streak_days = 0 WHERE id = ?').run(userId);
    return { currentStreak: 0, bestStreak: 0 };
  }

  const dates = rows.map((r) => r.activity_date);
  const dateSet = new Set(dates);
  const todayStr = getVnDateString();

  const yesterdayDate = new Date(Date.now() + 7 * 3600 * 1000 - 86400 * 1000);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  let currentStreak = 0;
  let checkCursor = dateSet.has(todayStr) ? todayStr : dateSet.has(yesterdayStr) ? yesterdayStr : null;

  if (checkCursor) {
    let cursorTime = new Date(`${checkCursor}T00:00:00Z`).getTime();
    while (true) {
      const dStr = new Date(cursorTime).toISOString().slice(0, 10);
      if (dateSet.has(dStr)) {
        currentStreak++;
        cursorTime -= 86400 * 1000;
      } else {
        break;
      }
    }
  }

  // Tính Best Streak lịch sử
  const ascDates = [...dates].reverse();
  let bestStreak = 0;
  let tempStreak = 0;
  let prevTime = null;
  for (const dStr of ascDates) {
    const t = new Date(`${dStr}T00:00:00Z`).getTime();
    if (prevTime !== null && Math.round((t - prevTime) / (86400 * 1000)) === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }
    if (tempStreak > bestStreak) bestStreak = tempStreak;
    prevTime = t;
  }

  db.prepare(`
    UPDATE users
    SET streak_days = ?,
        best_streak_days = CASE WHEN ? > COALESCE(best_streak_days, 0) THEN ? ELSE COALESCE(best_streak_days, 0) END,
        last_active_date = ?
    WHERE id = ?
  `).run(currentStreak, bestStreak, bestStreak, dates[0], userId);

  return { currentStreak, bestStreak };
}

/**
 * Xây dựng dữ liệu GitHub-style Contribution Graph (365 ngày gần nhất & thống kê chi tiết)
 */
export function getStudentContributionGraph(userId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT activity_date, submission_count, completed_exams_count, total_score_earned
       FROM learning_activities
       WHERE user_id = ? AND submission_count > 0
       ORDER BY activity_date ASC`
    )
    .all(userId);

  const mapByDate = {};
  for (const r of rows) {
    mapByDate[r.activity_date] = r;
  }

  const todayStr = getVnDateString();
  const currentYearPrefix = todayStr.slice(0, 4);
  const currentMonthPrefix = todayStr.slice(0, 7);

  let submissionsThisMonth = 0;
  let submissionsThisYear = 0;
  let mostActiveDay = null;
  let maxSubmissionsInADay = 0;

  for (const r of rows) {
    if (r.activity_date.startsWith(currentMonthPrefix)) {
      submissionsThisMonth += r.submission_count;
    }
    if (r.activity_date.startsWith(currentYearPrefix)) {
      submissionsThisYear += r.submission_count;
    }
    if (r.submission_count > maxSubmissionsInADay) {
      maxSubmissionsInADay = r.submission_count;
      mostActiveDay = {
        date: r.activity_date,
        displayDate: formatVnDisplayDate(r.activity_date),
        count: r.submission_count,
      };
    }
  }

  // Số bài đề thi khác nhau đã hoàn thành hợp lệ
  const distinctExamsCompleted = db
    .prepare(
      `SELECT COUNT(DISTINCT exam_id) as c
       FROM exam_attempts
       WHERE user_id = ? AND status IN ('SUBMITTED', 'AUTO_SUBMITTED')`
    )
    .get(userId).c;

  const userRow = db
    .prepare('SELECT streak_days, best_streak_days FROM users WHERE id = ?')
    .get(userId);

  // Tạo lưới 52 tuần (364-365 ngày) tính tới ngày hiện tại
  const endTime = new Date(`${todayStr}T00:00:00Z`).getTime();
  const totalDays = 365;
  const startTime = endTime - (totalDays - 1) * 86400 * 1000;

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const t = startTime + i * 86400 * 1000;
    const dObj = new Date(t);
    const dateKey = dObj.toISOString().slice(0, 10);
    const displayDate = formatVnDisplayDate(dateKey);
    const act = mapByDate[dateKey];
    const count = act ? act.submission_count : 0;
    const level = getContributionColorLevel(count);

    days.push({
      date: dateKey,
      displayDate,
      dayOfWeek: dObj.getUTCDay(), // 0 (CN) -> 6 (Thứ 7)
      month: dObj.getUTCMonth() + 1,
      submissionCount: count,
      scoreEarned: act ? act.total_score_earned : 0,
      level,
      tooltip: `Ngày ${displayDate} – Đã nộp ${count} bài tập`,
    });
  }

  return {
    days,
    summary: {
      submissionsThisMonth,
      submissionsThisYear,
      currentStreak: userRow?.streak_days || 0,
      bestStreak: userRow?.best_streak_days || 0,
      mostActiveDay,
      completedExamsCount: distinctExamsCompleted,
    },
  };
}

/**
 * Đồng bộ hóa và xếp hạng bảng Leaderboard (ALL_TIME và DAILY)
 * Chỉ tính các bài thi đã được nộp hợp lệ (status IN ('SUBMITTED', 'AUTO_SUBMITTED'))
 */
export function rebuildLeaderboardTables(targetDateStr = getVnDateString()) {
  const db = getDb();

  // 1. ALL_TIME Leaderboard
  const allTimeStats = db
    .prepare(
      `SELECT
         u.id as user_id,
         COUNT(ea.id) as submission_count,
         COALESCE( ROUND(SUM(ea.total_score), 2), 0 ) as total_score,
         COALESCE( ROUND(AVG(ea.total_score), 2), 0 ) as average_score,
         COALESCE( ROUND(MAX(ea.total_score), 2), 0 ) as highest_score
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN exam_attempts ea
         ON ea.user_id = u.id AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
       WHERE r.name = 'STUDENT' AND u.status = 'ACTIVE'
       GROUP BY u.id
       HAVING COUNT(ea.id) > 0
       ORDER BY total_score DESC, highest_score DESC, average_score DESC`
    )
    .all();

  db.prepare("DELETE FROM leaderboard WHERE period_type = 'ALL_TIME'").run();
  const insertLb = db.prepare(`
    INSERT INTO leaderboard (
      user_id, period_type, period_key, total_score, submission_count,
      average_score, highest_score, rank_position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  allTimeStats.forEach((row, idx) => {
    insertLb.run(
      row.user_id,
      'ALL_TIME',
      'ALL',
      row.total_score,
      row.submission_count,
      row.average_score,
      row.highest_score,
      idx + 1
    );
  });

  // 2. DAILY Leaderboard (Theo ngày targetDateStr)
  const dailyStats = db
    .prepare(
      `SELECT
         u.id as user_id,
         COUNT(ea.id) as submission_count,
         COALESCE( ROUND(SUM(ea.total_score), 2), 0 ) as total_score,
         COALESCE( ROUND(AVG(ea.total_score), 2), 0 ) as average_score,
         COALESCE( ROUND(MAX(ea.total_score), 2), 0 ) as highest_score
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN exam_attempts ea
         ON ea.user_id = u.id
         AND ea.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
         AND substr(ea.submitted_at, 1, 10) = ?
       WHERE r.name = 'STUDENT' AND u.status = 'ACTIVE'
       GROUP BY u.id
       ORDER BY total_score DESC, highest_score DESC, average_score DESC`
    )
    .all(targetDateStr);

  db.prepare("DELETE FROM leaderboard WHERE period_type = 'DAILY' AND period_key = ?").run(targetDateStr);
  dailyStats.forEach((row, idx) => {
    insertLb.run(
      row.user_id,
      'DAILY',
      targetDateStr,
      row.total_score,
      row.submission_count,
      row.average_score,
      row.highest_score,
      idx + 1
    );
  });
}

/**
 * Lấy dữ liệu Bảng xếp hạng kèm quyền kiểm soát của Admin (Bật/Tắt, Công khai/Ẩn, Biệt danh)
 */
export function getLeaderboardData({ periodType = 'ALL_TIME', dateKey = getVnDateString(), viewerRole = 'STUDENT' }) {
  const db = getDb();
  const settingsRows = db.prepare('SELECT setting_key, setting_value FROM system_settings').all();
  const settings = {};
  for (const s of settingsRows) settings[s.setting_key] = s.setting_value === 'true';

  const isEnabled = settings.leaderboard_enabled !== false;
  const isPublic = settings.leaderboard_public !== false;
  const allowNickname = settings.leaderboard_allow_nickname !== false;

  if (viewerRole !== 'ADMIN' && (!isEnabled || !isPublic)) {
    return {
      enabled: isEnabled,
      isPublic,
      allowNickname,
      periodType,
      dateKey,
      entries: [],
      message: 'Bảng xếp hạng hiện đang tạm ẩn theo cấu hình của Giáo viên quản trị.',
    };
  }

  rebuildLeaderboardTables(dateKey);

  const pKey = periodType === 'DAILY' ? dateKey : 'ALL';
  const rows = db
    .prepare(
      `SELECT
         lb.*,
         u.full_name,
         u.nickname,
         u.class_name,
         u.streak_days
       FROM leaderboard lb
       JOIN users u ON lb.user_id = u.id
       WHERE lb.period_type = ? AND lb.period_key = ?
       ORDER BY lb.rank_position ASC
       LIMIT 100`
    )
    .all(periodType, pKey);

  // Bảo mật thông tin: Không bao giờ trả về username hoặc dữ liệu nhạy cảm của học sinh khác
  const entries = rows.map((r) => ({
    rank: r.rank_position,
    userId: r.user_id,
    displayName:
      viewerRole === 'ADMIN'
        ? r.full_name
        : allowNickname && r.nickname
        ? r.nickname
        : r.full_name,
    fullName: viewerRole === 'ADMIN' ? r.full_name : undefined,
    nickname: r.nickname || r.full_name,
    className: r.class_name,
    totalScore: r.total_score,
    submissionCount: r.submission_count,
    averageScore: r.average_score,
    highestScore: r.highest_score,
    streakDays: r.streak_days || 0,
  }));

  return {
    enabled: isEnabled,
    isPublic,
    allowNickname,
    periodType,
    dateKey,
    displayDate: formatVnDisplayDate(dateKey),
    entries,
  };
}

