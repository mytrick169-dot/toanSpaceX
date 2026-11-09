import { renderMathText } from './mathRenderer.js';

/**
 * Component hiển thị GitHub-style Learning Activity Contribution Graph
 * Quy ước màu sắc:
 * - 0 lượt: màu xám nhạt (level-0)
 * - 1 lượt: màu xanh nhạt (level-1)
 * - 2–3 lượt: màu xanh trung bình (level-2)
 * - 4–5 lượt: màu xanh đậm (level-3)
 * - Trên 5 lượt: màu xanh đậm nhất (level-4)
 */
export function renderGithubContributionGraphHtml(contributionGraph, title = 'Hoạt động học tập (GitHub-style Activity Graph)') {
  if (!contributionGraph || !Array.isArray(contributionGraph.days)) return '';
  const { days, summary } = contributionGraph;

  // Nhóm các ngày theo từng cột tuần (mỗi cột 7 ngày từ Chủ Nhật -> Thứ 7)
  const weeks = [];
  let currentWeek = [];
  if (days.length > 0) {
    const firstDow = days[0].dayOfWeek;
    for (let p = 0; p < firstDow; p++) {
      currentWeek.push(null);
    }
  }
  for (const d of days) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return `
    <div class="card p-6 mb-6">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="inline-block w-3 h-3 rounded-sm bg-emerald-600"></span>
            ${title}
          </h3>
          <p class="text-sm text-slate-500 mt-0.5">
            Chỉ tính những lần nộp bài hợp lệ. Rê chuột hoặc nhấn vào từng ô vuông để xem chi tiết ngày.
          </p>
        </div>
        <div id="gh-selected-day-banner" class="px-3.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm font-semibold">
          ${
            days.length > 0
              ? days[days.length - 1].tooltip
              : 'Chưa có dữ liệu hoạt động'
          }
        </div>
      </div>

      <!-- 5 chỉ số thống kê hoạt động học tập -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div class="text-xs text-slate-500">Lượt nộp trong tháng</div>
          <div class="text-xl font-bold text-slate-900 mt-0.5">${summary.submissionsThisMonth} lượt</div>
        </div>
        <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div class="text-xs text-slate-500">Lượt nộp trong năm</div>
          <div class="text-xl font-bold text-slate-900 mt-0.5">${summary.submissionsThisYear} lượt</div>
        </div>
        <div class="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <div class="text-xs text-emerald-700">Chuỗi ngày học liên tiếp</div>
          <div class="text-xl font-bold text-emerald-700 mt-0.5">${summary.currentStreak} ngày</div>
        </div>
        <div class="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div class="text-xs text-blue-700">Ngày hoạt động nhiều nhất</div>
          <div class="text-sm font-bold text-blue-900 mt-1">
            ${
              summary.mostActiveDay
                ? `${summary.mostActiveDay.displayDate} (${summary.mostActiveDay.count} bài)`
                : 'Chưa có'
            }
          </div>
        </div>
        <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div class="text-xs text-slate-500">Số bài đã hoàn thành</div>
          <div class="text-xl font-bold text-slate-900 mt-0.5">${summary.completedExamsCount} đề</div>
        </div>
      </div>

      <!-- Lưới ô vuông 53 tuần giống GitHub -->
      <div class="gh-graph-wrapper overflow-x-auto pb-2">
        <div class="gh-grid">
          ${weeks
            .map(
              (week) => `
            <div class="gh-week-col">
              ${week
                .map((cell) => {
                  if (!cell) return `<div class="gh-cell gh-empty"></div>`;
                  return `<div
                    class="gh-cell gh-level-${cell.level}"
                    title="${cell.tooltip}"
                    data-tooltip="${cell.tooltip}"
                    onclick="window.SpaceXApp.showActivityTooltip('${cell.tooltip}')"
                    onmouseenter="window.SpaceXApp.showActivityTooltip('${cell.tooltip}')"
                  ></div>`;
                })
                .join('')}
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Chú thích quy ước màu sắc -->
      <div class="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <div class="flex items-center gap-4 flex-wrap">
          <span class="flex items-center gap-1.5"><span class="gh-cell gh-level-0 inline-block"></span> 0 lượt (Xám nhạt)</span>
          <span class="flex items-center gap-1.5"><span class="gh-cell gh-level-1 inline-block"></span> 1 lượt (Xanh nhạt)</span>
          <span class="flex items-center gap-1.5"><span class="gh-cell gh-level-2 inline-block"></span> 2–3 lượt (Xanh TB)</span>
          <span class="flex items-center gap-1.5"><span class="gh-cell gh-level-3 inline-block"></span> 4–5 lượt (Xanh đậm)</span>
          <span class="flex items-center gap-1.5"><span class="gh-cell gh-level-4 inline-block"></span> Trên 5 lượt (Xanh đậm nhất)</span>
        </div>
        <div>Kỷ lục chuỗi học tập: <strong>${summary.bestStreak} ngày liên tiếp</strong></div>
      </div>
    </div>
  `;
}

/**
 * 1. TRANG CHỦ HỌC SINH (#/student/dashboard)
 */
export function renderStudentDashboardView(data) {
  const { user, stats, contributionGraph, latestExams, unfinishedExams, leaderboard } = data;

  return `
    <div class="space-y-6">
      <!-- Banner chào mừng học sinh -->
      <div class="card p-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white border-0 shadow-md">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium mb-2">
              <span>Lớp ${user.className || '12A1'}</span>
              <span>•</span>
              <span>Chuỗi học tập: ${stats.streakDays} ngày liên tiếp</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold">Xin chào, ${user.fullName}!</h1>
            <p class="text-blue-100 text-sm mt-1">
              Hôm nay bạn đã sẵn sàng chinh phục các chuyên đề Toán THPT cùng Space X Math chưa?
            </p>
          </div>
          <div class="flex items-center gap-2.5">
            <button onclick="window.SpaceXApp.navigate('#/student/exams')" class="btn bg-white text-blue-700 hover:bg-blue-50 font-semibold">
              Vào luyện đề ngay →
            </button>
            <button onclick="window.SpaceXApp.openProfileModal()" class="btn bg-blue-700/60 text-white border border-white/25 hover:bg-blue-700">
              Đổi mật khẩu / Biệt danh
            </button>
          </div>
        </div>
      </div>

      <!-- 5 Thẻ chỉ số học tập cốt lõi -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div class="card p-4">
          <div class="text-xs font-medium text-slate-500">Tổng số bài đã hoàn thành</div>
          <div class="text-2xl font-bold text-slate-900 mt-1">${stats.completedExamsCount}</div>
          <div class="text-xs text-emerald-600 mt-1">Bộ đề khác nhau</div>
        </div>
        <div class="card p-4">
          <div class="text-xs font-medium text-slate-500">Tổng số lượt nộp bài</div>
          <div class="text-2xl font-bold text-blue-600 mt-1">${stats.totalSubmissions}</div>
          <div class="text-xs text-slate-500 mt-1">Lượt nộp hợp lệ</div>
        </div>
        <div class="card p-4">
          <div class="text-xs font-medium text-slate-500">Điểm trung bình</div>
          <div class="text-2xl font-bold text-slate-900 mt-1">${stats.averageScore}<span class="text-sm font-normal text-slate-400">/10</span></div>
          <div class="text-xs text-slate-500 mt-1">Thang điểm 10</div>
        </div>
        <div class="card p-4">
          <div class="text-xs font-medium text-slate-500">Điểm cao nhất</div>
          <div class="text-2xl font-bold text-emerald-600 mt-1">${stats.highestScore}<span class="text-sm font-normal text-slate-400">/10</span></div>
          <div class="text-xs text-emerald-600 mt-1">Thành tích tốt nhất</div>
        </div>
        <div class="card p-4">
          <div class="text-xs font-medium text-slate-500">Chuỗi ngày học liên tiếp</div>
          <div class="text-2xl font-bold text-amber-600 mt-1">${stats.streakDays} ngày</div>
          <div class="text-xs text-slate-500 mt-1">Kỷ lục: ${stats.bestStreakDays} ngày</div>
        </div>
      </div>

      <!-- GitHub-style Contribution Graph -->
      ${renderGithubContributionGraphHtml(contributionGraph)}

      <!-- Cột: Bài tập chưa hoàn thành & Bài tập mới nhất + Bảng xếp hạng -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <!-- Những bài tập chưa hoàn thành -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-slate-900">Những bài tập chưa hoàn thành</h3>
              <button onclick="window.SpaceXApp.navigate('#/student/exams')" class="text-sm font-semibold text-blue-600 hover:underline">
                Xem tất cả đề →
              </button>
            </div>
            ${
              unfinishedExams.length === 0
                ? `<div class="p-6 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-sm">
                     Tuyệt vời! Bạn đã hoàn thành tất cả các bộ đề hiện có. Bạn có thể luyện tập lại để nâng cao điểm số!
                   </div>`
                : `<div class="space-y-3">
                    ${unfinishedExams.map((ex) => renderCompactExamRow(ex)).join('')}
                   </div>`
            }
          </div>

          <!-- Những bài tập mới nhất -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-slate-900">Những bài tập & Đề thi mới nhất</h3>
              <button onclick="window.SpaceXApp.navigate('#/student/chapters')" class="text-sm font-semibold text-blue-600 hover:underline">
                Chọn theo chương →
              </button>
            </div>
            <div class="space-y-3">
              ${latestExams.map((ex) => renderCompactExamRow(ex)).join('')}
            </div>
          </div>
        </div>

        <!-- Bảng xếp hạng học sinh rút gọn -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-slate-900">Bảng xếp hạng học sinh</h3>
            <button onclick="window.SpaceXApp.navigate('#/student/leaderboard')" class="text-sm font-semibold text-blue-600 hover:underline">
              Chi tiết →
            </button>
          </div>
          ${
            leaderboard.length === 0
              ? `<p class="text-sm text-slate-500">Chưa có dữ liệu bảng xếp hạng.</p>`
              : `<div class="space-y-3">
                  ${leaderboard
                    .map(
                      (item) => `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div class="flex items-center gap-3">
                        <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          item.rank === 1
                            ? 'bg-amber-400 text-slate-950'
                            : item.rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : item.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }">
                          #${item.rank}
                        </span>
                        <div>
                          <div class="text-sm font-bold text-slate-900">${item.displayName}</div>
                          <div class="text-xs text-slate-500">Lớp ${item.className} • ${item.submissionCount} bài nộp</div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-sm font-bold text-blue-600">${item.totalScore} đ</div>
                        <div class="text-xs text-slate-500">TB: ${item.averageScore}</div>
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                 </div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderCompactExamRow(ex) {
  const statusBadge =
    ex.completionStatus === 'COMPLETED'
      ? `<span class="badge badge-success">Đã hoàn thành (${ex.myBestScore}/10)</span>`
      : ex.completionStatus === 'IN_PROGRESS'
      ? `<span class="badge badge-info">Đang làm dở</span>`
      : `<span class="badge badge-neutral">Chưa làm</span>`;

  return `
    <div class="p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition bg-white flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-1 flex-1 min-w-[240px]">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
            ${ex.exam_type === 'PRACTICE' ? 'Bộ bài tập' : 'Đề kiểm tra'}
          </span>
          ${statusBadge}
          <span class="text-xs text-slate-500">${ex.chapter_name || 'Toán 12'}</span>
        </div>
        <h4 class="font-bold text-slate-900">${ex.title}</h4>
        <div class="text-xs text-slate-500 flex flex-wrap items-center gap-3">
          <span>Số câu: <strong>${ex.question_count} câu</strong></span>
          <span>•</span>
          <span>Thời gian mặc định: <strong>${ex.default_duration_minutes} phút</strong></span>
          <span>•</span>
          <span>Điểm tối đa: <strong>10 điểm</strong></span>
          <span>•</span>
          <span>Đã làm: <strong>${ex.myAttemptCount || 0} lượt</strong></span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${
          ex.pdf_document_id
            ? `<a href="/api/storage/pdfs/${ex.pdf_document_id}/download" target="_blank" class="btn btn-secondary text-xs">
                 📥 Tải tài liệu PDF gốc
               </a>`
            : ''
        }
        <button onclick="window.SpaceXApp.openStartExamModal(${ex.id})" class="btn btn-primary text-xs">
          ${ex.completionStatus === 'IN_PROGRESS' ? 'Tiếp tục làm bài' : 'Vào làm bài'}
        </button>
      </div>
    </div>
  `;
}

/**
 * 2. TRANG DANH SÁCH MÔN HỌC (#/student/subjects)
 */
export function renderStudentSubjectsView(curriculum) {
  const subjects = curriculum?.subjects || [];
  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Danh sách Môn học & Khối lớp</h1>
          <p class="text-sm text-slate-500 mt-1">Chọn khối lớp Toán THPT để truy cập hệ thống chương, bài học và bộ đề luyện thi.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${subjects
          .map(
            (s) => `
          <div class="card p-6 hover:border-blue-400 transition flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                  Khối lớp ${s.grade}
                </span>
                <span class="text-xs text-slate-500">${s.chapters.length} chương học</span>
              </div>
              <h2 class="text-xl font-bold text-slate-900">${s.name}</h2>
              <p class="text-sm text-slate-600 mt-2">${s.description || ''}</p>

              <div class="mt-4 space-y-2 border-t border-slate-100 pt-4">
                ${s.chapters
                  .slice(0, 4)
                  .map(
                    (c) => `
                  <div class="text-xs text-slate-700 flex items-center justify-between py-1">
                    <span class="font-medium truncate pr-2">• ${c.name}</span>
                    <span class="text-slate-400 shrink-0">${c.lessons.length} bài</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button onclick="window.SpaceXApp.navigate('#/student/chapters?subjectId=${s.id}')" class="btn btn-primary w-full">
                Khám phá các Chương & Bài học →
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

/**
 * 3. TRANG DANH SÁCH CHƯƠNG & BÀI HỌC (#/student/chapters)
 */
export function renderStudentChaptersView(curriculum, selectedSubjectId = null) {
  const subjects = curriculum?.subjects || [];
  const filteredSubjects = selectedSubjectId
    ? subjects.filter((s) => s.id === Number(selectedSubjectId))
    : subjects;

  const groupLessonsBySection = (lessons = []) => {
    const groups = [];
    const map = new Map();
    for (const les of lessons) {
      const gName = les.description || 'DANH SÁCH BÀI HỌC';
      if (!map.has(gName)) {
        const gObj = { groupName: gName, items: [] };
        map.set(gName, gObj);
        groups.push(gObj);
      }
      map.get(gName).items.push(les);
    }
    return groups;
  };

  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="text-xs text-blue-600 font-semibold mb-1">
            Toán học 12 THPT → 12 Chương & Chuyên đề → Chọn Phần / Tiết học → Luyện tập
          </div>
          <h1 class="text-2xl font-bold text-slate-900">Lộ trình Chương & Phần học Toán 12</h1>
          <p class="text-sm text-slate-500 mt-1">
            Chọn đúng tiết học hoặc đề ôn tập bên dưới để làm bài tập về nhà (BTVN) và đề kiểm tra.
          </p>
        </div>
        <button onclick="window.SpaceXApp.navigate('#/student/exams')" class="btn btn-secondary">
          Xem toàn bộ Đề thi & Bài tập
        </button>
      </div>

      ${filteredSubjects
        .map(
          (subj) => `
        <div class="space-y-6">
          ${subj.chapters
            .map((ch) => {
              const groups = groupLessonsBySection(ch.lessons);
              return `
              <div class="card overflow-hidden border-2 border-slate-300 shadow-sm">
                <!-- Banner Đỏ: Tên Chương / Chuyên đề lớn -->
                <div class="bg-red-600 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 class="text-sm sm:text-base font-extrabold uppercase tracking-wide text-yellow-200">
                      ${ch.name}
                    </h3>
                    <p class="text-xs text-red-100 mt-0.5">${ch.description || ''}</p>
                  </div>
                  <button onclick="window.SpaceXApp.navigate('#/student/exams?chapterId=${ch.id}')" class="px-3 py-1.5 rounded-lg bg-white text-red-700 font-bold text-xs hover:bg-yellow-50 transition">
                    Tất cả đề chương này →
                  </button>
                </div>

                <!-- Các Nhóm [BÀI 1], [BÀI 2]... màu vàng & Danh sách Tiết học bên dưới -->
                <div class="divide-y divide-slate-200">
                  ${groups
                    .map(
                      (grp) => `
                    <div>
                      <div class="bg-yellow-300 text-red-700 font-extrabold text-xs sm:text-sm uppercase px-4 py-2 text-center border-b border-slate-300">
                        ${grp.groupName}
                      </div>
                      <div class="divide-y divide-slate-200 bg-white">
                        ${grp.items
                          .map(
                            (les) => `
                          <div class="px-4 py-2.5 hover:bg-blue-50/50 transition flex flex-wrap items-center justify-between gap-3">
                            <div class="text-xs sm:text-sm font-medium text-slate-900">
                              ${les.name}
                            </div>
                            <div class="flex items-center gap-3">
                              ${
                                (les.totalSets || 0) > 0
                                  ? `<span class="badge badge-success">✓ Đã có ${les.totalSets} bộ đề</span>
                                     <button onclick="window.SpaceXApp.navigate('#/student/exams?chapterId=${ch.id}&lessonId=${les.id}')" class="btn btn-primary text-xs py-1 px-3">
                                       ✍️ Vào làm BTVN / Đề thi →
                                     </button>`
                                  : `<span class="text-xs text-slate-400">Chưa cập nhật đề</span>
                                     <button onclick="window.SpaceXApp.navigate('#/student/exams?chapterId=${ch.id}&lessonId=${les.id}')" class="text-xs font-semibold text-blue-600 hover:underline">
                                       Xem mục này
                                     </button>`
                              }
                            </div>
                          </div>
                        `
                          )
                          .join('')}
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * 4. TRANG DANH SÁCH BÀI TẬP & ĐỀ THI (#/student/exams)
 */
export function renderStudentExamsView(exams, curriculum, filters = {}) {
  const rawChapters = curriculum?.rawChapters || [];
  const rawLessons = curriculum?.rawLessons || [];

  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Danh sách Bộ bài tập & Đề kiểm tra</h1>
          <p class="text-sm text-slate-500 mt-1">
            Mỗi bộ đề đều đính kèm tài liệu PDF gốc của Giáo viên để bạn tải về ôn tập hoặc làm trực tuyến.
          </p>
        </div>
      </div>

      <!-- Bộ lọc Chương, Bài học, Loại đề -->
      <div class="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Lọc theo Chương</label>
          <select id="student-filter-chapter" onchange="window.SpaceXApp.applyStudentExamFilter()" class="input text-sm">
            <option value="">-- Tất cả các Chương --</option>
            ${rawChapters
              .map(
                (c) =>
                  `<option value="${c.id}" ${
                    String(filters.chapterId) === String(c.id) ? 'selected' : ''
                  }>${c.name}</option>`
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Lọc theo Bài học</label>
          <select id="student-filter-lesson" onchange="window.SpaceXApp.applyStudentExamFilter()" class="input text-sm">
            <option value="">-- Tất cả Bài học --</option>
            ${rawLessons
              .filter((l) => !filters.chapterId || String(l.chapter_id) === String(filters.chapterId))
              .map(
                (l) =>
                  `<option value="${l.id}" ${
                    String(filters.lessonId) === String(l.id) ? 'selected' : ''
                  }>${l.name}</option>`
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Loại hình</label>
          <select id="student-filter-type" onchange="window.SpaceXApp.applyStudentExamFilter()" class="input text-sm">
            <option value="">-- Tất cả (Bài tập & Đề thi) --</option>
            <option value="PRACTICE" ${filters.examType === 'PRACTICE' ? 'selected' : ''}>Bộ bài tập luyện tập</option>
            <option value="EXAM" ${filters.examType === 'EXAM' ? 'selected' : ''}>Đề kiểm tra định kỳ</option>
          </select>
        </div>
        <div class="flex items-end">
          <button onclick="window.SpaceXApp.navigate('#/student/exams')" class="btn btn-secondary w-full text-sm">
            Đặt lại bộ lọc
          </button>
        </div>
      </div>

      <!-- Danh sách các bộ đề -->
      ${
        exams.length === 0
          ? `<div class="card p-10 text-center text-slate-500">
               Không tìm thấy bộ bài tập hoặc đề kiểm tra nào khớp với bộ lọc hiện tại.
             </div>`
          : `<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              ${exams
                .map((ex) => {
                  const statusBadge =
                    ex.completionStatus === 'COMPLETED'
                      ? `<span class="badge badge-success">✓ Đã hoàn thành</span>`
                      : ex.completionStatus === 'IN_PROGRESS'
                      ? `<span class="badge badge-info">⏳ Đang làm dở</span>`
                      : `<span class="badge badge-neutral">Chưa làm</span>`;

                  return `
                    <div class="card p-5 flex flex-col justify-between hover:border-blue-400 transition">
                      <div>
                        <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                          <span class="px-2.5 py-0.5 rounded-md text-xs font-bold ${
                            ex.exam_type === 'PRACTICE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }">
                            ${ex.exam_type === 'PRACTICE' ? 'Bộ bài tập' : 'Đề kiểm tra'}
                          </span>
                          ${statusBadge}
                        </div>

                        <h3 class="text-lg font-bold text-slate-900">${ex.title}</h3>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-2">${ex.description || ''}</p>

                        <div class="mt-3 text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div><strong>Chương:</strong> ${ex.chapter_name || 'Toán học 12'}</div>
                          ${ex.lesson_name ? `<div><strong>Bài học:</strong> ${ex.lesson_name}</div>` : ''}
                          <div class="grid grid-cols-2 gap-2 pt-1.5 mt-1.5 border-t border-slate-200/70">
                            <div>Số lượng câu hỏi: <strong>${ex.question_count} câu</strong></div>
                            <div>Thời gian mặc định: <strong>${ex.default_duration_minutes} phút</strong></div>
                            <div>Điểm tối đa: <strong>${ex.total_points || 10} điểm</strong></div>
                            <div>Số lượt đã làm: <strong>${ex.myAttemptCount} lượt</strong></div>
                          </div>
                          ${
                            ex.myBestScore !== null
                              ? `<div class="pt-1 text-emerald-700 font-semibold">Điểm cao nhất của bạn: ${ex.myBestScore} / 10</div>`
                              : ''
                          }
                        </div>
                      </div>

                      <div class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                          ${
                            ex.pdf_document_id
                              ? `<a href="/api/storage/pdfs/${ex.pdf_document_id}/download" target="_blank" class="btn btn-secondary text-xs">
                                   📥 Tải tài liệu PDF gốc
                                 </a>
                                 <a href="/api/storage/pdfs/${ex.pdf_document_id}/view" target="_blank" class="btn btn-secondary text-xs">
                                   👁️ Xem PDF
                                 </a>`
                              : `<span class="text-xs text-slate-400">Không đính kèm PDF</span>`
                          }
                        </div>
                        <button onclick="window.SpaceXApp.openStartExamModal(${ex.id})" class="btn btn-primary text-xs">
                          ${ex.completionStatus === 'IN_PROGRESS' ? 'Tiếp tục làm bài →' : 'Chọn thời gian & Làm bài →'}
                        </button>
                      </div>
                    </div>
                  `;
                })
                .join('')}
             </div>`
      }
    </div>
  `;
}

/**
 * 5. GIAO DIỆN LÀM BÀI THI TRỰC TUYẾN (#/student/exam-take/:attemptId)
 */
export function renderStudentExamTakeView(takeState, currentQuestionIdx = 0) {
  const { attempt, exam, questions } = takeState;
  const totalQ = questions.length;
  const safeIdx = Math.max(0, Math.min(currentQuestionIdx, totalQ - 1));
  const currentQ = questions[safeIdx];

  const answeredCount = questions.filter((q) => isQuestionAnsweredInDraft(q)).length;
  const progressPercent = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;

  return `
    <div class="space-y-4">
      <!-- Thanh Header Cố định khi làm bài: Tên đề, Đồng hồ đếm ngược, Tải PDF gốc, Nút Nộp bài -->
      <div class="card p-4 sticky top-2 z-20 bg-white/95 backdrop-blur border-blue-200 shadow-md">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="badge badge-info">${exam.examType === 'PRACTICE' ? 'Luyện tập' : 'Đề kiểm tra'}</span>
              <span class="text-xs text-slate-500">Mã lượt thi #${attempt.id}</span>
            </div>
            <h2 class="text-base sm:text-lg font-bold text-slate-900 mt-0.5">${exam.title}</h2>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            ${
              exam.pdfDocumentId
                ? `<a href="/api/storage/pdfs/${exam.pdfDocumentId}/download" target="_blank" class="btn btn-secondary text-xs">
                     📥 Tải tài liệu PDF gốc
                   </a>`
                : ''
            }

            <!-- Đồng hồ đếm ngược kiểm soát từ Server -->
            <div class="px-4 py-2 rounded-xl border-2 border-blue-600 bg-blue-50 flex items-center gap-2">
              <span class="text-xs font-semibold text-blue-800 uppercase">Thời gian:</span>
              <span id="exam-countdown-display" class="text-lg font-mono font-extrabold text-blue-900">
                ${formatRemainingTime(attempt.remainingSeconds)}
              </span>
            </div>

            <button onclick="window.SpaceXApp.confirmSubmitExam()" class="btn btn-primary font-bold">
              ✓ Nộp bài (${answeredCount}/${totalQ})
            </button>
          </div>
        </div>

        <!-- Thanh tiến độ hoàn thành -->
        <div class="mt-3 flex items-center gap-3">
          <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500 transition-all duration-300" style="width: ${progressPercent}%"></div>
          </div>
          <span class="text-xs font-semibold text-slate-600 shrink-0">
            Tiến độ: ${answeredCount}/${totalQ} câu (${progressPercent}%)
          </span>
        </div>
      </div>

      <!-- Khung làm bài chính: Bên trái là Nội dung câu hỏi, Bên phải là Bảng điều hướng câu hỏi -->
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Khu vực hiển thị câu hỏi hiện tại -->
        <div class="lg:col-span-3 card p-6 flex flex-col justify-between min-h-[440px]">
          ${
            !currentQ
              ? `<p class="text-slate-500">Đề thi chưa có câu hỏi.</p>`
              : `
            <div>
              <!-- Header câu hỏi -->
              <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                  <span class="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-sm">
                    Câu ${currentQ.questionNumber} / ${totalQ}
                  </span>
                  <span class="badge badge-neutral">
                    ${
                      currentQ.questionType === 'MULTIPLE_CHOICE'
                        ? 'Trắc nghiệm 4 đáp án (A, B, C, D)'
                        : currentQ.questionType === 'TRUE_FALSE'
                        ? 'Trắc nghiệm Đúng / Sai (a, b, c, d)'
                        : 'Câu hỏi Trả lời ngắn'
                    }
                  </span>
                  <span class="text-xs text-slate-500">(${currentQ.points} điểm • Trang ${currentQ.sourcePage || 1} PDF)</span>
                </div>

                <button
                  onclick="window.SpaceXApp.toggleFlagCurrentQuestion(${safeIdx})"
                  class="btn text-xs ${
                    currentQ.studentDraft?.isFlagged
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'btn-secondary'
                  }"
                >
                  🚩 ${currentQ.studentDraft?.isFlagged ? 'Đã đánh dấu xem lại' : 'Đánh dấu câu này'}
                </button>
              </div>

              <!-- Nội dung đề bài (Render công thức LaTeX) -->
              <div class="mt-5 text-base sm:text-lg text-slate-900 leading-relaxed font-medium">
                ${renderMathText(currentQ.content)}
              </div>

              <!-- Hình ảnh, Đồ thị hoặc Bảng biến thiên của câu hỏi -->
              ${
                currentQ.svgDiagram
                  ? `<div class="my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 max-w-xl mx-auto">
                       ${currentQ.svgDiagram}
                     </div>`
                  : ''
              }
              ${
                currentQ.imageUrl
                  ? `<div class="my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                       <img src="${currentQ.imageUrl}" alt="Hình minh họa câu ${currentQ.questionNumber}" class="max-h-72 mx-auto rounded" />
                     </div>`
                  : ''
              }

              <!-- Khu vực chọn/nhập đáp án tùy theo dạng câu hỏi -->
              <div class="mt-6">
                ${renderQuestionInputArea(currentQ, safeIdx)}
              </div>
            </div>

            <!-- Thanh điều hướng Câu trước / Câu tiếp theo -->
            <div class="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onclick="window.SpaceXApp.switchExamQuestion(${safeIdx - 1})"
                class="btn btn-secondary"
                ${safeIdx === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}
              >
                ← Câu trước
              </button>
              <span class="text-xs text-slate-400">Hệ thống tự động lưu đáp án theo thời gian thực</span>
              ${
                safeIdx < totalQ - 1
                  ? `<button onclick="window.SpaceXApp.switchExamQuestion(${safeIdx + 1})" class="btn btn-primary">
                       Câu tiếp theo →
                     </button>`
                  : `<button onclick="window.SpaceXApp.confirmSubmitExam()" class="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                       ✓ Hoàn thành & Nộp bài
                     </button>`
              }
            </div>
          `
          }
        </div>

        <!-- Bảng danh sách câu hỏi (Question Palette) -->
        <div class="card p-5 h-fit">
          <h3 class="text-sm font-bold text-slate-900 mb-3">Danh sách câu hỏi</h3>
          <div class="grid grid-cols-5 gap-2 mb-4">
            ${questions
              .map((q, idx) => {
                const answered = isQuestionAnsweredInDraft(q);
                const flagged = q.studentDraft?.isFlagged;
                const isCurrent = idx === safeIdx;
                let btnCls = 'bg-slate-100 text-slate-700 border-slate-200';
                if (answered) btnCls = 'bg-emerald-600 text-white border-emerald-600';
                if (flagged) btnCls = 'bg-amber-400 text-slate-950 border-amber-500';
                if (isCurrent) btnCls += ' ring-2 ring-blue-600 ring-offset-2';

                return `
                  <button
                    onclick="window.SpaceXApp.switchExamQuestion(${idx})"
                    class="h-10 rounded-lg border font-bold text-xs flex items-center justify-center transition ${btnCls}"
                  >
                    ${q.questionNumber}
                  </button>
                `;
              })
              .join('')}
          </div>

          <div class="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded bg-emerald-600 inline-block"></span>
              <span>Đã làm (${answeredCount} câu)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded bg-slate-200 inline-block"></span>
              <span>Chưa làm (${totalQ - answeredCount} câu)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3.5 rounded bg-amber-400 inline-block"></span>
              <span>Đánh dấu xem lại</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderQuestionInputArea(q, qIdx) {
  const qType = q.questionType;
  const draft = q.studentDraft || {};

  if (qType === 'MULTIPLE_CHOICE') {
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        ${(q.options || [])
          .map((opt) => {
            const selected = draft.selectedOption === opt.option_key;
            return `
              <button
                type="button"
                onclick="window.SpaceXApp.selectMultipleChoiceOption(${qIdx}, '${opt.option_key}')"
                class="p-4 rounded-xl border-2 text-left transition flex items-start gap-3 ${
                  selected
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-sm'
                    : 'border-slate-200 hover:border-blue-300 bg-white text-slate-800'
                }"
              >
                <span class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                  selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }">
                  ${opt.option_key}
                </span>
                <div class="text-base pt-0.5 leading-relaxed">${renderMathText(opt.content)}</div>
              </button>
            `;
          })
          .join('')}
      </div>
    `;
  }

  if (qType === 'TRUE_FALSE') {
    const tfAnswers = draft.tfAnswers || {};
    return `
      <div class="space-y-3">
        <div class="text-xs font-semibold text-slate-500 mb-2">
          Chọn <strong>Đúng</strong> hoặc <strong>Sai</strong> cho từng mệnh đề a), b), c), d):
        </div>
        ${(q.options || [])
          .map((opt) => {
            const curVal = tfAnswers[opt.option_key];
            const isTrue = curVal === true || curVal === 'true';
            const isFalse = curVal === false || curVal === 'false';
            return `
              <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-start gap-2.5 flex-1 min-w-[220px]">
                  <span class="font-bold text-blue-700">${opt.option_key})</span>
                  <div class="text-sm sm:text-base text-slate-900">${renderMathText(opt.content)}</div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onclick="window.SpaceXApp.selectTrueFalseStatement(${qIdx}, '${opt.option_key}', true)"
                    class="px-4 py-1.5 rounded-lg font-bold text-xs border transition ${
                      isTrue
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400'
                    }"
                  >
                    Đúng
                  </button>
                  <button
                    type="button"
                    onclick="window.SpaceXApp.selectTrueFalseStatement(${qIdx}, '${opt.option_key}', false)"
                    class="px-4 py-1.5 rounded-lg font-bold text-xs border transition ${
                      isFalse
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-red-400'
                    }"
                  >
                    Sai
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  // SHORT_ANSWER
  return `
    <div class="p-5 rounded-xl bg-slate-50 border border-slate-200 max-w-md">
      <label class="block text-sm font-bold text-slate-800 mb-2">
        Nhập kết quả câu trả lời ngắn của bạn:
      </label>
      <input
        type="text"
        value="${draft.shortAnswer || ''}"
        oninput="window.SpaceXApp.inputShortAnswer(${qIdx}, this.value)"
        placeholder="Ví dụ: 24 hoặc 0,5 hoặc 0.5"
        class="input text-lg font-mono font-bold text-blue-900"
      />
      <p class="text-xs text-slate-500 mt-2">
        Hệ thống tự động chấp nhận cả dấu chấm (<code>0.5</code>), dấu phẩy (<code>0,5</code>) và phân số tương đương.
      </p>
    </div>
  `;
}

export function isQuestionAnsweredInDraft(q) {
  const d = q.studentDraft || {};
  if (q.questionType === 'MULTIPLE_CHOICE') {
    return Boolean(d.selectedOption);
  }
  if (q.questionType === 'TRUE_FALSE') {
    const tf = d.tfAnswers || {};
    return ['a', 'b', 'c', 'd'].some((k) => tf[k] === true || tf[k] === false);
  }
  if (q.questionType === 'SHORT_ANSWER') {
    return Boolean(d.shortAnswer && String(d.shortAnswer).trim().length > 0);
  }
  return false;
}

export function formatRemainingTime(seconds) {
  if (seconds === null || seconds === undefined) return '∞ Không giới hạn';
  const sec = Math.max(0, Number(seconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 6. TRANG KẾT QUẢ & ĐÁP ÁN CHI TIẾT (#/student/result/:attemptId)
 */
export function renderStudentResultView(resultData) {
  const { attempt, exam, questions } = resultData;

  return `
    <div class="space-y-6">
      <!-- Bảng điểm tổng kết -->
      <div class="card p-6 border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50/40">
        <div class="flex flex-wrap items-center justify-between gap-6">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="badge ${attempt.status === 'AUTO_SUBMITTED' ? 'badge-warning' : 'badge-success'}">
                ${attempt.status === 'AUTO_SUBMITTED' ? '⏰ Tự động nộp khi hết giờ' : '✓ Nộp bài thành công'}
              </span>
              <span class="text-xs text-slate-500">Nộp lúc: ${attempt.submittedAt ? attempt.submittedAt.replace('T', ' ').slice(0, 19) : ''}</span>
            </div>
            <h1 class="text-2xl font-bold text-slate-900">${exam.title}</h1>
            <p class="text-sm text-slate-600">
              Học sinh: <strong>${attempt.studentName || ''}</strong> • Thời gian hoàn thành: <strong>${Math.max(1, Math.round(attempt.durationSpentSeconds / 60))} phút (${attempt.durationSpentSeconds}s)</strong>
            </p>
          </div>

          <div class="flex items-center gap-4">
            <div class="px-6 py-4 rounded-2xl bg-blue-600 text-white text-center shadow">
              <div class="text-xs uppercase font-semibold text-blue-100">Tổng điểm</div>
              <div class="text-3xl font-extrabold">${attempt.totalScore}<span class="text-base font-normal text-blue-200">/10</span></div>
            </div>
          </div>
        </div>

        <!-- Thống kê Đúng / Sai / Bỏ trống -->
        <div class="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-200/80">
          <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <div class="text-xs text-emerald-700 font-medium">Số câu Đúng</div>
            <div class="text-2xl font-bold text-emerald-700 mt-0.5">${attempt.correctCount}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-center">
            <div class="text-xs text-red-700 font-medium">Số câu Sai</div>
            <div class="text-2xl font-bold text-red-700 mt-0.5">${attempt.wrongCount}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-center">
            <div class="text-xs text-slate-600 font-medium">Số câu Bỏ trống</div>
            <div class="text-2xl font-bold text-slate-700 mt-0.5">${attempt.blankCount}</div>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            ${
              exam.pdfDocumentId
                ? `<a href="/api/storage/pdfs/${exam.pdfDocumentId}/download" target="_blank" class="btn btn-secondary text-xs">
                     📥 Tải tài liệu PDF gốc
                   </a>`
                : ''
            }
            <button onclick="window.SpaceXApp.openStartExamModal(${exam.id})" class="btn btn-primary text-xs">
              🔄 Làm lại đề này
            </button>
          </div>
          <button onclick="window.SpaceXApp.navigate('#/student/dashboard')" class="btn btn-secondary text-xs">
            Về Trang chủ Học sinh →
          </button>
        </div>
      </div>

      <!-- Chi tiết từng câu hỏi & Đối chiếu đáp án -->
      <div class="space-y-4">
        <h3 class="text-lg font-bold text-slate-900">Chi tiết kết quả từng câu hỏi</h3>
        ${questions
          .map((q) => {
            const statusBorder = !q.isAnswered
              ? 'border-slate-300'
              : q.isCorrect
              ? 'border-emerald-300'
              : 'border-red-300';

            return `
              <div class="card p-5 border-2 ${statusBorder}">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-bold">
                      Câu ${q.questionNumber}
                    </span>
                    ${
                      !q.isAnswered
                        ? `<span class="badge badge-neutral">Bỏ trống (0 đ)</span>`
                        : q.isCorrect
                        ? `<span class="badge badge-success">✓ Chính xác (+${q.earnedPoints} đ)</span>`
                        : `<span class="badge badge-danger">✗ Chưa chính xác (+${q.earnedPoints} đ)</span>`
                    }
                  </div>
                  <span class="text-xs text-slate-400">Trang ${q.sourcePage || 1} PDF</span>
                </div>

                <div class="mt-3 text-base text-slate-900 font-medium">
                  ${renderMathText(q.content)}
                </div>

                ${q.svgDiagram ? `<div class="my-3 max-w-lg">${q.svgDiagram}</div>` : ''}
                ${
                  q.imageUrl
                    ? `<div class="my-3"><img src="${q.imageUrl}" class="max-h-60 rounded border" alt="Hình câu hỏi" /></div>`
                    : ''
                }

                ${renderQuestionReviewComparison(q)}
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderQuestionReviewComparison(q) {
  const ca = q.correctAnswer;
  const sa = q.studentAnswer || {};

  if (q.questionType === 'MULTIPLE_CHOICE') {
    return `
      <div class="mt-4 space-y-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${(q.options || [])
            .map((opt) => {
              const isStudentChoice = sa.selectedOption === opt.option_key;
              const isCorrectChoice = ca && ca.answerKey === opt.option_key;
              let boxCls = 'border-slate-200 bg-slate-50';
              if (isCorrectChoice) boxCls = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold';
              else if (isStudentChoice && !isCorrectChoice)
                boxCls = 'border-red-500 bg-red-50 text-red-950';

              return `
                <div class="p-3 rounded-lg border ${boxCls} flex items-center justify-between gap-2 text-sm">
                  <div><strong>${opt.option_key}.</strong> ${renderMathText(opt.content)}</div>
                  <div class="text-xs shrink-0">
                    ${isCorrectChoice ? '<span class="text-emerald-700 font-bold">✓ Đáp án đúng</span>' : ''}
                    ${isStudentChoice && !isCorrectChoice ? '<span class="text-red-600 font-bold">✗ Bạn chọn</span>' : ''}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
        ${
          ca?.explanation
            ? `<div class="mt-3 p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs sm:text-sm text-blue-950">
                 <strong>Lời giải chi tiết:</strong> ${renderMathText(ca.explanation)}
               </div>`
            : ''
        }
      </div>
    `;
  }

  if (q.questionType === 'TRUE_FALSE') {
    const studentTf = sa.tfAnswers || {};
    const correctTf = (ca && ca.answerKey) || {};
    return `
      <div class="mt-4 space-y-2">
        ${(q.options || [])
          .map((opt) => {
            const sVal = studentTf[opt.option_key];
            const cVal = correctTf[opt.option_key];
            const sText = sVal === true ? 'Đúng' : sVal === false ? 'Sai' : 'Bỏ trống';
            const cText = cVal === true ? 'Đúng' : cVal === false ? 'Sai' : '?';
            const match = sVal !== undefined && sVal !== null && sVal === cVal;

            return `
              <div class="p-3 rounded-lg border ${
                match ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'
              } flex flex-wrap items-center justify-between gap-2 text-sm">
                <div><strong>${opt.option_key})</strong> ${renderMathText(opt.content)}</div>
                <div class="text-xs flex items-center gap-3">
                  <span>Bạn chọn: <strong>${sText}</strong></span>
                  ${
                    ca
                      ? `<span class="text-emerald-700">Đáp án chuẩn: <strong>${cText}</strong></span>`
                      : ''
                  }
                </div>
              </div>
            `;
          })
          .join('')}
        ${
          ca?.explanation
            ? `<div class="mt-3 p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs sm:text-sm text-blue-950">
                 <strong>Lời giải chi tiết:</strong> ${renderMathText(ca.explanation)}
               </div>`
            : ''
        }
      </div>
    `;
  }

  // SHORT_ANSWER
  return `
    <div class="mt-4 space-y-2 text-sm">
      <div class="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <div>Câu trả lời của bạn: <strong class="${q.isCorrect ? 'text-emerald-700' : 'text-red-600'}">${
    sa.shortAnswer || '(Bỏ trống)'
  }</strong></div>
        ${
          ca
            ? `<div>Đáp án chính xác: <strong class="text-emerald-700">${ca.shortAnswerValue}</strong> ${
                ca.equivalentAnswers?.length > 1
                  ? `<span class="text-xs text-slate-500">(Chấp nhận: ${ca.equivalentAnswers.join(' ; ')})</span>`
                  : ''
              }</div>`
            : ''
        }
      </div>
      ${
        ca?.explanation
          ? `<div class="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs sm:text-sm text-blue-950">
               <strong>Lời giải chi tiết:</strong> ${renderMathText(ca.explanation)}
             </div>`
          : ''
      }
    </div>
  `;
}

/**
 * 7. TRANG LỊCH SỬ LÀM BÀI (#/student/history)
 */
export function renderStudentHistoryView(history = []) {
  return `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Lịch sử làm bài của bạn</h1>
        <p class="text-sm text-slate-500 mt-1">Theo dõi toàn bộ các bài tập và đề kiểm tra bạn đã nộp cùng kết quả chi tiết.</p>
      </div>

      ${
        history.length === 0
          ? `<div class="card p-10 text-center text-slate-500">
               Bạn chưa có lượt nộp bài nào. Hãy chọn một đề thi để bắt đầu luyện tập!
             </div>`
          : `
        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th class="p-4">Đề thi / Bộ bài tập</th>
                  <th class="p-4">Thời gian nộp</th>
                  <th class="p-4">Điểm số</th>
                  <th class="p-4">Đúng / Sai / Trống</th>
                  <th class="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${history
                  .map(
                    (h) => `
                  <tr class="hover:bg-slate-50/80">
                    <td class="p-4">
                      <div class="font-bold text-slate-900">${h.exam_title}</div>
                      <div class="text-xs text-slate-500">${h.chapter_name || 'Toán 12'}</div>
                    </td>
                    <td class="p-4 text-xs text-slate-600">
                      ${(h.submitted_at || '').replace('T', ' ').slice(0, 19)}
                    </td>
                    <td class="p-4">
                      <span class="font-extrabold text-base text-blue-600">${h.total_score}</span>
                      <span class="text-xs text-slate-400">/10</span>
                    </td>
                    <td class="p-4 text-xs">
                      <span class="text-emerald-600 font-bold">${h.correct_count} đúng</span> •
                      <span class="text-red-600 font-bold">${h.wrong_count} sai</span> •
                      <span class="text-slate-500">${h.blank_count} trống</span>
                    </td>
                    <td class="p-4 text-right space-x-2">
                      ${
                        h.pdf_document_id
                          ? `<a href="/api/storage/pdfs/${h.pdf_document_id}/download" target="_blank" class="btn btn-secondary text-xs">
                               📥 PDF gốc
                             </a>`
                          : ''
                      }
                      <button onclick="window.SpaceXApp.navigate('#/student/result/${h.id}')" class="btn btn-primary text-xs">
                        Xem lại bài làm →
                      </button>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      }
    </div>
  `;
}

/**
 * 8. TRANG BẢNG XẾP HẠNG HỌC SINH (#/student/leaderboard)
 */
export function renderStudentLeaderboardView(lbData) {
  const { periodType, displayDate, entries, message } = lbData;

  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Bảng xếp hạng Học sinh Space X Math</h1>
          <p class="text-sm text-slate-500 mt-1">
            Chỉ tính điểm của các bài thi đã được nộp hợp lệ. Tạo động lực chinh phục đỉnh cao Toán THPT!
          </p>
        </div>

        <div class="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onclick="window.SpaceXApp.loadLeaderboardView('ALL_TIME')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition ${
              periodType === 'ALL_TIME' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }"
          >
            🏆 Toàn thời gian
          </button>
          <button
            onclick="window.SpaceXApp.loadLeaderboardView('DAILY')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition ${
              periodType === 'DAILY' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }"
          >
            📅 Bảng xếp hạng Hôm nay (${displayDate})
          </button>
        </div>
      </div>

      ${
        message
          ? `<div class="card p-8 text-center text-slate-600">${message}</div>`
          : entries.length === 0
          ? `<div class="card p-8 text-center text-slate-500">Chưa có lượt nộp bài hợp lệ nào trong kỳ xếp hạng này.</div>`
          : `
        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th class="p-4">Hạng</th>
                  <th class="p-4">Học sinh</th>
                  <th class="p-4">Lớp</th>
                  <th class="p-4">Tổng điểm</th>
                  <th class="p-4">Số bài đã nộp</th>
                  <th class="p-4">Điểm trung bình</th>
                  <th class="p-4">Điểm cao nhất</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${entries
                  .map(
                    (e) => `
                  <tr class="${e.rank <= 3 ? 'bg-amber-50/30' : ''} hover:bg-slate-50">
                    <td class="p-4 font-bold">
                      <span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-extrabold ${
                        e.rank === 1
                          ? 'bg-amber-400 text-slate-950'
                          : e.rank === 2
                          ? 'bg-slate-300 text-slate-900'
                          : e.rank === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }">
                        Hạng ${e.rank}
                      </span>
                    </td>
                    <td class="p-4 font-bold text-slate-900">${e.displayName}</td>
                    <td class="p-4 text-slate-600">${e.className}</td>
                    <td class="p-4 font-extrabold text-blue-600 text-base">${e.totalScore} điểm</td>
                    <td class="p-4 font-semibold text-slate-700">${e.submissionCount} bài</td>
                    <td class="p-4 text-slate-700">${e.averageScore} / 10</td>
                    <td class="p-4 font-bold text-emerald-600">${e.highestScore} / 10</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      }
    </div>
  `;
}

