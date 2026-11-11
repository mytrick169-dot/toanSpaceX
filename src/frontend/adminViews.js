import { renderMathText } from './mathRenderer.js';
import { renderGithubContributionGraphHtml } from './studentViews.js';

/**
 * 11. TRANG QUẢN TRỊ ADMIN DASHBOARD (#/admin/dashboard)
 */
export function renderAdminDashboardView(data) {
  const { metrics, activityChart, topStudents, mostPopularExams } = data;
  const maxSub = Math.max(1, ...activityChart.map((d) => d.submissions));

  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Bảng điều khiển Quản trị (Admin Dashboard)</h1>
          <p class="text-sm text-slate-500 mt-1">
            Tổng quan hoạt động giảng dạy, luyện thi Toán THPT và xử lý đề thi bằng AI trên toàn hệ thống.
          </p>
        </div>
        <div class="flex items-center gap-2.5">
          <button onclick="window.SpaceXApp.navigate('#/admin/pdf-upload')" class="btn btn-primary">
            ✨ Upload PDF & Tạo đề bằng AI
          </button>
          <button onclick="window.SpaceXApp.navigate('#/admin/students')" class="btn btn-secondary">
            👥 Quản lý Học sinh
          </button>
        </div>
      </div>

      <!-- Khung chia sẻ Đường link Công khai cho Học sinh -->
      <div class="card p-4 border-2 border-blue-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="text-sm font-bold text-blue-950 flex items-center gap-2">
            <span>🌐 Đường link Công khai dành cho Học sinh</span>
            <span class="badge badge-success">Đang mở đăng ký tự do</span>
          </div>
          <p class="text-xs text-slate-600">
            Gửi đường link này cho học sinh qua Zalo / Messenger / Lớp học: bất kỳ học sinh nào có link đều có thể tự tạo tài khoản và vào làm bài ngay.
          </p>
          <div class="text-xs font-mono font-bold text-blue-700 bg-white/90 px-3 py-1.5 rounded-lg border border-blue-200 inline-block mt-1">
            ${window.location.origin}/#/register
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.SpaceXApp.copyShareLink('#/register')" class="btn btn-primary text-xs">
            📋 Sao chép Link Đăng ký cho Học sinh
          </button>
          <button onclick="window.SpaceXApp.copyShareLink('#/login')" class="btn btn-secondary text-xs">
            🔗 Sao chép Link Đăng nhập
          </button>
        </div>
      </div>

      ${
        metrics.needsReviewExamsCount > 0
          ? `<div class="p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-3">
               <div class="text-sm text-amber-900">
                 ⚠️ <strong>Cần kiểm tra:</strong> Hiện có <strong>${metrics.needsReviewExamsCount} đề thi</strong> chứa câu hỏi được AI đánh dấu <code>NEEDS_REVIEW</code> (khuyết đáp án trong PDF gốc) đang chờ Giáo viên xác nhận trước khi công bố.
               </div>
               <button onclick="window.SpaceXApp.navigate('#/admin/questions?needsReview=true')" class="btn bg-amber-600 hover:bg-amber-700 text-white text-xs">
                 Kiểm tra & Xác nhận ngay →
               </button>
             </div>`
          : ''
      }

      <!-- 6 Chỉ số Thống kê Tổng quan -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div class="card p-4">
          <div class="text-xs text-slate-500 font-medium">Tổng số học sinh</div>
          <div class="text-2xl font-bold text-slate-900 mt-1">${metrics.totalStudents}</div>
          <div class="text-xs text-slate-400 mt-1">Toàn trường</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-slate-500 font-medium">Đang hoạt động</div>
          <div class="text-2xl font-bold text-emerald-600 mt-1">${metrics.activeStudents}</div>
          <div class="text-xs text-emerald-600 mt-1">Tài khoản ACTIVE</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-slate-500 font-medium">Tổng số bài tập</div>
          <div class="text-2xl font-bold text-blue-600 mt-1">${metrics.totalPracticeSets}</div>
          <div class="text-xs text-slate-400 mt-1">Bộ luyện tập</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-slate-500 font-medium">Tổng số đề thi</div>
          <div class="text-2xl font-bold text-indigo-600 mt-1">${metrics.totalExams}</div>
          <div class="text-xs text-slate-400 mt-1">Đề kiểm tra</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-slate-500 font-medium">Tổng lượt nộp bài</div>
          <div class="text-2xl font-bold text-slate-900 mt-1">${metrics.totalSubmissions}</div>
          <div class="text-xs text-slate-400 mt-1">Lượt nộp hợp lệ</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-slate-500 font-medium">Làm bài hôm nay</div>
          <div class="text-2xl font-bold text-amber-600 mt-1">${metrics.todaySubmissions}</div>
          <div class="text-xs text-amber-700 mt-1">Trong ngày</div>
        </div>
      </div>

      <!-- Biểu đồ hoạt động học tập theo ngày (14 ngày gần nhất) -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-base font-bold text-slate-900">Biểu đồ hoạt động học tập theo ngày (14 ngày gần nhất)</h3>
            <p class="text-xs text-slate-500">Số lượt học sinh nộp bài thành công mỗi ngày</p>
          </div>
          <button onclick="window.SpaceXApp.navigate('#/admin/statistics')" class="text-xs font-bold text-blue-600 hover:underline">
            Xem báo cáo thống kê chi tiết →
          </button>
        </div>

        <div class="h-48 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-200">
          ${activityChart
            .map((item) => {
              const heightPct = Math.max(6, Math.round((item.submissions / maxSub) * 100));
              return `
                <div class="flex-1 flex flex-col items-center gap-1.5 group">
                  <div class="text-[11px] font-bold text-blue-700">${item.submissions}</div>
                  <div class="w-full max-w-[36px] bg-blue-600 group-hover:bg-blue-700 rounded-t-md transition-all" style="height: ${heightPct}%"></div>
                  <div class="text-[10px] text-slate-500 font-medium">${item.label}</div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- 2 Cột: Học sinh có điểm cao nhất & Bài tập được làm nhiều nhất -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-slate-900">Danh sách học sinh có điểm cao nhất</h3>
            <button onclick="window.SpaceXApp.navigate('#/admin/students')" class="text-xs font-bold text-blue-600 hover:underline">
              Quản lý học sinh →
            </button>
          </div>
          <div class="space-y-3">
            ${
              topStudents.length === 0
                ? `<div class="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                     Chưa có học sinh nào nộp bài. Hãy sao chép đường link công khai phía trên gửi cho học sinh để bắt đầu!
                   </div>`
                : topStudents
                    .map(
                      (st, idx) => `
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    ${idx + 1}
                  </span>
                  <div>
                    <div class="text-sm font-bold text-slate-900">${st.full_name} <span class="text-xs font-normal text-slate-500">(@${st.username})</span></div>
                    <div class="text-xs text-slate-500">Lớp ${st.class_name} • Đã nộp ${st.submission_count} bài</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-extrabold text-emerald-600">Cao nhất: ${st.highest_score}/10</div>
                  <div class="text-xs text-slate-500">Điểm TB: ${st.average_score}/10</div>
                </div>
              </div>
            `
                    )
                    .join('')
            }
          </div>
        </div>

        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-slate-900">Những bài tập & đề thi được làm nhiều nhất</h3>
            <button onclick="window.SpaceXApp.navigate('#/admin/exams')" class="text-xs font-bold text-blue-600 hover:underline">
              Quản lý đề thi →
            </button>
          </div>
          <div class="space-y-3">
            ${mostPopularExams
              .map(
                (ex) => `
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="badge ${ex.exam_type === 'PRACTICE' ? 'badge-success' : 'badge-info'}">
                      ${ex.exam_type === 'PRACTICE' ? 'Bài tập' : 'Đề thi'}
                    </span>
                    <span class="text-xs text-slate-500">${ex.chapter_name || ''}</span>
                  </div>
                  <div class="text-sm font-bold text-slate-900 mt-1">${ex.title}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-extrabold text-blue-600">${ex.attempt_count} lượt làm</div>
                  <div class="text-xs text-slate-500">Điểm TB: ${ex.average_score}/10</div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 12. TRANG QUẢN LÝ HỌC SINH (#/admin/students)
 */
export function renderAdminStudentsView(students = [], filters = {}) {
  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Quản lý Tài khoản Học sinh</h1>
          <p class="text-sm text-slate-500 mt-1">
            Tạo tài khoản, tìm kiếm, xem lịch sử làm bài, khóa/mở khóa và cấp lại mật khẩu khi học sinh quên.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="window.SpaceXApp.openVipCodesModal()" class="btn bg-amber-500 hover:bg-amber-600 text-white">
            🔑 Kho Mã VIP khôi phục mật khẩu
          </button>
          <button onclick="window.SpaceXApp.openCreateStudentModal()" class="btn btn-primary">
            + Tạo tài khoản học sinh
          </button>
        </div>
      </div>

      <!-- Thanh tìm kiếm & lọc -->
      <div class="card p-4 flex flex-wrap items-center gap-3">
        <input
          id="admin-student-search"
          type="text"
          value="${filters.search || ''}"
          placeholder="Tìm theo họ tên, username hoặc lớp..."
          class="input flex-1 min-w-[240px]"
          onkeydown="if(event.key==='Enter') window.SpaceXApp.searchAdminStudents()"
        />
        <select id="admin-student-status" onchange="window.SpaceXApp.searchAdminStudents()" class="input w-48">
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE" ${filters.status === 'ACTIVE' ? 'selected' : ''}>Đang hoạt động (ACTIVE)</option>
          <option value="LOCKED" ${filters.status === 'LOCKED' ? 'selected' : ''}>Đã khóa (LOCKED)</option>
        </select>
        <button onclick="window.SpaceXApp.searchAdminStudents()" class="btn btn-primary">
          🔍 Tìm kiếm
        </button>
      </div>

      <!-- Bảng danh sách học sinh -->
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th class="p-4">Họ và tên</th>
                <th class="p-4">Username</th>
                <th class="p-4">Lớp</th>
                <th class="p-4">Ngày tạo</th>
                <th class="p-4">Lượt nộp / Điểm TB / Cao nhất</th>
                <th class="p-4">Trạng thái</th>
                <th class="p-4 text-right">Thao tác quản trị</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${students
                .map(
                  (s) => `
                <tr class="hover:bg-slate-50">
                  <td class="p-4 font-bold text-slate-900">${s.full_name}</td>
                  <td class="p-4 font-mono text-xs text-blue-700">@${s.username}</td>
                  <td class="p-4 text-slate-600">${s.class_name}</td>
                  <td class="p-4 text-xs text-slate-500">${(s.created_at || '').slice(0, 10)}</td>
                  <td class="p-4 text-xs">
                    <strong>${s.submission_count} lượt</strong> •
                    TB: <strong class="text-blue-600">${s.average_score}</strong> •
                    Max: <strong class="text-emerald-600">${s.highest_score}</strong>
                  </td>
                  <td class="p-4">
                    <span class="badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">
                      ${s.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td class="p-4 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="window.SpaceXApp.viewStudentDetailModal(${s.id})" class="btn btn-secondary text-xs">
                      📊 Lịch sử & Điểm
                    </button>
                    <button onclick="window.SpaceXApp.openResetStudentPasswordModal(${s.id}, '${s.username}', '${s.full_name}')" class="btn btn-secondary text-xs">
                      🔑 Đổi mật khẩu
                    </button>
                    <button onclick="window.SpaceXApp.toggleStudentLockStatus(${s.id}, '${s.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE'}')" class="btn text-xs ${
                    s.status === 'ACTIVE'
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }">
                      ${s.status === 'ACTIVE' ? '🔒 Khóa' : '🔓 Mở khóa'}
                    </button>
                    <button onclick="window.SpaceXApp.deleteStudentAccount(${s.id}, '${s.full_name}')" class="btn bg-red-50 text-red-600 hover:bg-red-100 text-xs">
                      🗑️ Xóa
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
    </div>
  `;
}

function renderGroupedLessonOptionsHtml(rawLessons = [], chapterId = null, selectedLessonId = null) {
  const targetChId = Number(chapterId || 0);
  const filtered = targetChId
    ? rawLessons.filter((l) => Number(l.chapter_id) === targetChId)
    : rawLessons;

  const groups = [];
  const map = new Map();
  for (const les of filtered) {
    const gName = les.description || 'CÁC PHẦN HỌC';
    if (!map.has(gName)) {
      const gObj = { groupName: gName, items: [] };
      map.set(gName, gObj);
      groups.push(gObj);
    }
    map.get(gName).items.push(les);
  }

  return `
    <option value="">-- Chọn Phần / Tiết học --</option>
    ${groups
      .map(
        (grp) => `
      <optgroup label="${grp.groupName.replace(/"/g, '&quot;')}">
        ${grp.items
          .map(
            (l) =>
              `<option value="${l.id}" ${Number(selectedLessonId) === Number(l.id) ? 'selected' : ''}>${l.name}</option>`
          )
          .join('')}
      </optgroup>
    `
      )
      .join('')}
  `;
}

/**
 * 13. TRANG QUẢN LÝ CHƯƠNG & BÀI HỌC (#/admin/curriculum)
 */
export function renderAdminCurriculumView(curriculum) {
  const subjects = curriculum?.subjects || [];

  const groupLessonsBySection = (lessons = []) => {
    const groups = [];
    const map = new Map();
    for (const les of lessons) {
      const gName = les.description || 'DANH SÁCH PHẦN HỌC';
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
          <h1 class="text-2xl font-bold text-slate-900">Lộ trình Chương & Phần học Toán 12 (12 Chương / Chuyên đề)</h1>
          <p class="text-sm text-slate-500 mt-1">
            Nhấn nút <strong>"📤 Upload PDF vào phần này"</strong> tại bất kỳ dòng nào để tải file PDF đề bài & đáp án vào đúng vị trí đó.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="window.SpaceXApp.openAddChapterModal()" class="btn btn-primary">
            + Thêm Chương / Chuyên đề
          </button>
          <button onclick="window.SpaceXApp.openAddLessonModal()" class="btn btn-secondary">
            + Thêm Phần / Tiết học
          </button>
        </div>
      </div>

      ${subjects
        .map(
          (subj) => `
        <div class="space-y-6">
          ${subj.chapters
            .map((ch) => {
              const groups = groupLessonsBySection(ch.lessons);
              return `
              <div class="card overflow-hidden border-2 border-slate-300 shadow-sm">
                <!-- Banner Đỏ: Tên Chương / Chuyên đề -->
                <div class="bg-red-600 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div class="font-extrabold text-sm sm:text-base uppercase tracking-wide text-yellow-200">
                      ${ch.name}
                    </div>
                    <div class="text-xs text-red-100 mt-0.5">${ch.description || ''} (${ch.lessons.length} phần)</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button onclick="window.SpaceXApp.openAddLessonModal(${ch.id})" class="px-3 py-1.5 rounded-lg bg-white text-red-700 font-bold text-xs hover:bg-yellow-50">
                      + Thêm Phần / Tiết
                    </button>
                    <button onclick="window.SpaceXApp.deleteChapter(${ch.id}, '${ch.name.replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white text-xs">
                      Xóa Chương
                    </button>
                  </div>
                </div>

                <!-- Các Nhóm [BÀI 1], [BÀI 2]... màu vàng & Danh sách Tiết học -->
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
                          <div class="px-4 py-2.5 hover:bg-blue-50/50 transition flex flex-wrap items-center justify-between gap-2">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="text-xs sm:text-sm font-semibold text-slate-900">${les.name}</span>
                              ${
                                (les.totalSets || 0) > 0
                                  ? `<span class="badge badge-success">✓ Đã có ${les.totalSets} bộ đề</span>`
                                  : `<span class="text-xs text-slate-400">(Chưa có PDF)</span>`
                              }
                            </div>
                            <div class="flex items-center gap-2">
                              <button
                                onclick="window.SpaceXApp.jumpToUploadForLesson(${ch.id}, ${les.id})"
                                class="btn btn-primary text-xs py-1 px-3"
                              >
                                📤 Upload PDF vào phần này
                              </button>
                              <button
                                onclick="window.SpaceXApp.deleteLesson(${les.id}, '${les.name.replace(/'/g, "\\'")}')"
                                class="text-xs text-red-600 hover:underline font-medium px-2"
                              >
                                Xóa
                              </button>
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
 * 14. TRANG UPLOAD PDF & TỰ ĐỘNG TẠO ĐỀ BẰNG GEMINI AI (#/admin/pdf-upload)
 */
export function renderAdminPdfUploadView(aiStatus, curriculum, existingPdfs = [], prefill = {}) {
  const rawSubjects = curriculum?.rawSubjects || [];
  const rawChapters = curriculum?.rawChapters || [];
  const rawLessons = curriculum?.rawLessons || [];
  const selectedChapterId = prefill.chapterId ? Number(prefill.chapterId) : rawChapters[0]?.id || 1;
  const selectedLessonId = prefill.lessonId ? Number(prefill.lessonId) : null;
  const prefillTitle = prefill.title || '';

  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span class="badge badge-info mb-1">TÍNH NĂNG CỐT LÕI • AI-POWERED PDF TO EXAM</span>
          <h1 class="text-2xl font-bold text-slate-900">Upload PDF & Tự động Chuyển đổi Đề thi bằng Gemini AI</h1>
          <p class="text-sm text-slate-500 mt-1">
            Giáo viên chỉ cần chọn file PDF chứa đề bài và đáp án. AI tự động đọc, trích xuất câu hỏi, công thức LaTeX, hình vẽ và đáp án.
          </p>
        </div>
        <button onclick="window.SpaceXApp.navigate('#/admin/pdfs')" class="btn btn-secondary">
          📁 Quản lý Kho File PDF gốc
        </button>
      </div>

      <!-- Khung cấu hình & trạng thái Gemini AI Engine -->
      <div class="card p-5 border-blue-200 bg-blue-50/40">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1.5 flex-1 min-w-[280px]">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-bold text-slate-900">Cấu hình AI Engine hiện tại:</span>
              <span class="px-2.5 py-0.5 rounded bg-blue-600 text-white text-xs font-mono font-bold">
                Model chính: ${aiStatus?.configuredModel || 'gemini-2.5-pro'}
              </span>
              <span class="px-2.5 py-0.5 rounded bg-slate-200 text-slate-700 text-xs font-mono">
                Dự phòng: ${aiStatus?.fallbackModel || 'gemini-2.5-flash'}
              </span>
              <span class="badge ${aiStatus?.isConfigured ? 'badge-success' : 'badge-warning'}">
                ${
                  aiStatus?.isConfigured
                    ? `✓ Đã cấu hình API Key (${aiStatus.maskedApiKey})`
                    : '⚠️ Chưa nhập GEMINI_API_KEY trong .env (Đang dùng PDF Stream Parser nội bộ)'
                }
              </span>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed">
              <strong>Thông báo kỹ thuật về Gemini 4:</strong> ${aiStatus?.gemini4Notice || ''}
            </p>
          </div>
          <button onclick="window.SpaceXApp.toggleAiConfigPanel()" class="btn btn-secondary text-xs shrink-0">
            ⚙️ Cấu hình Gemini API Key & Model (.env)
          </button>
        </div>

        <!-- Form cập nhật biến môi trường .env ở Backend -->
        <div id="ai-config-Collapse" class="${aiStatus?.isConfigured ? 'hidden' : ''} mt-4 pt-4 border-t border-blue-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div class="flex flex-wrap items-center justify-between gap-1 mb-1">
              <label class="block text-xs font-bold text-slate-700">Google Gemini API Key (Lưu ở Backend .env)</label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[11px] font-bold text-blue-600 hover:underline"
              >
                🔑 Lấy mã miễn phí tại đây ↗
              </a>
            </div>
            <input
              id="cfg-gemini-key"
              type="password"
              placeholder="${aiStatus?.isConfigured ? 'Đã lưu (Nhập mới nếu muốn thay đổi)' : 'Dán AIzaSy... từ Google AI Studio'}"
              class="input text-xs font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Model Gemini xử lý PDF (GEMINI_MODEL)</label>
            <select id="cfg-gemini-model" class="input text-xs font-mono">
              ${(aiStatus?.availableOfficialModels || [])
                .map(
                  (m) => `
                <option value="${m.id}" ${aiStatus?.configuredModel === m.id ? 'selected' : ''}>
                  ${m.id} — ${m.name}
                </option>
              `
                )
                .join('')}
            </select>
          </div>
          <div class="flex items-end">
            <button onclick="window.SpaceXApp.saveAiConfig()" class="btn btn-primary w-full text-xs">
              💾 Lưu vào Backend (.env)
            </button>
          </div>
        </div>
      </div>

      <!-- Khung Upload PDF & Tùy chọn Phân loại Tự động -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 card p-6 space-y-5">
          <h3 class="text-lg font-bold text-slate-900">1. Chọn File PDF Đề thi & Cấu hình Phân loại</h3>

          <!-- Khu vực chọn file PDF -->
          <div class="border-2 border-dashed border-blue-300 rounded-2xl p-6 text-center bg-blue-50/30 hover:bg-blue-50/60 transition">
            <input
              id="pdf-upload-input"
              type="file"
              accept="application/pdf,.pdf"
              onchange="window.SpaceXApp.handlePdfFileSelected(this)"
              class="hidden"
            />
            <div class="text-3xl mb-2">📄</div>
            <div id="selected-pdf-label" class="text-sm font-bold text-slate-800">
              Nhấn để chọn file PDF đề thi Toán từ máy tính của bạn
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Hỗ trợ PDF nhiều trang, công thức LaTeX, bảng biến thiên, đồ thị và bảng đáp án cuối tài liệu.
            </p>
            <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onclick="document.getElementById('pdf-upload-input').click()"
                class="btn btn-primary text-xs"
              >
                📂 Chọn file PDF từ máy tính
              </button>
            </div>
          </div>

          <!-- Thông tin phân loại vào Chương & Bài học -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 mb-1">Tên Đề thi / Bộ bài tập (Để trống AI sẽ tự lấy theo tiêu đề PDF)</label>
              <input id="upload-exam-title" type="text" value="${prefillTitle.replace(/"/g, '&quot;')}" placeholder="Ví dụ: Đề kiểm tra Chương 1 - Ứng dụng đạo hàm" class="input text-sm" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Môn học & Khối lớp</label>
              <select id="upload-subject-id" class="input text-sm">
                ${rawSubjects.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Phân loại Hình thức</label>
              <select id="upload-exam-type" class="input text-sm">
                <option value="PRACTICE" selected>Bộ bài tập luyện tập (BTVN)</option>
                <option value="EXAM">Đề kiểm tra định kỳ</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Chương / Chuyên đề lớn</label>
              <select
                id="upload-chapter-id"
                onchange="window.SpaceXApp.onUploadChapterChange(this.value)"
                class="input text-sm"
              >
                ${rawChapters
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${Number(selectedChapterId) === Number(c.id) ? 'selected' : ''}>${c.name}</option>`
                  )
                  .join('')}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Phần / Tiết học (Tự lọc theo Chương)</label>
              <select id="upload-lesson-id" class="input text-sm">
                ${renderGroupedLessonOptionsHtml(rawLessons, selectedChapterId, selectedLessonId)}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Thời gian làm bài mặc định (phút)</label>
              <input id="upload-duration" type="number" value="45" min="5" max="180" class="input text-sm" />
            </div>

            <div class="flex flex-col justify-end space-y-2">
              <label class="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input id="upload-unlimited" type="checkbox" checked class="rounded text-blue-600" />
                Cho phép học sinh chọn "Không giới hạn thời gian"
              </label>
              <label class="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input id="upload-allow-review" type="checkbox" checked class="rounded text-blue-600" />
                Cho phép học sinh xem đáp án & lời giải sau khi nộp
              </label>
            </div>
          </div>

          <button
            id="btn-start-ai-parse"
            onclick="window.SpaceXApp.executePdfUploadAndAiParse()"
            class="btn btn-primary w-full py-3 text-base font-bold shadow"
          >
            🚀 Bắt đầu Phân tích PDF & Tự động Tạo Đề thi bằng AI
          </button>
        </div>

        <!-- Cột phải: Tiến trình 10 bước xử lý AI thời gian thực -->
        <div class="card p-6 space-y-4">
          <h3 class="text-base font-bold text-slate-900">Quy trình 10 bước AI Chuyển đổi PDF</h3>
          <div id="ai-step-progress-list" class="space-y-2.5 text-xs">
            ${[
              'Bước 1: Đọc & Lưu trữ file PDF gốc vào hệ thống',
              'Bước 2: Giải mã cấu trúc trang & gửi tài liệu đến Gemini API',
              'Bước 3: Gemini đọc và phân tích bố cục toán học đa phương thức',
              'Bước 4: Nhận diện nguyên vẹn toàn bộ câu hỏi trong tài liệu',
              'Bước 5: Đối chiếu & nhận diện đáp án chính xác từ bảng đáp án gốc',
              'Bước 6: Nhận diện công thức LaTeX, bảng biến thiên & hình vẽ',
              'Bước 7: Phân loại Trắc nghiệm (A/B/C/D), Đúng/Sai (a/b/c/d), Trả lời ngắn',
              'Bước 8: Chuyển đổi sang JSON cấu trúc chuẩn & gắn cờ NEEDS_REVIEW nếu khuyết đáp án',
              'Bước 9: Lưu câu hỏi, phương án và đáp án vào Cơ sở dữ liệu',
              'Bước 10: Mở Bản xem trước (Review Studio) để Giáo viên xác nhận & Xuất bản',
            ]
              .map(
                (stepText, i) => `
              <div id="ai-step-item-${i + 1}" class="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 flex items-center gap-2.5">
                <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  ${i + 1}
                </span>
                <span>${stepText}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 15. TRANG QUẢN LÝ FILE PDF GỐC (#/admin/pdfs)
 */
export function renderAdminPdfsView(pdfs = [], exams = []) {
  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Quản lý Kho Tài liệu PDF gốc</h1>
          <p class="text-sm text-slate-500 mt-1">
            Xem trực tiếp, tải xuống, thay thế file PDF, gắn PDF với chương/bài học hoặc gắn với nhiều bộ đề thi.
          </p>
        </div>
        <button onclick="window.SpaceXApp.navigate('#/admin/pdf-upload')" class="btn btn-primary">
          + Upload PDF mới
        </button>
      </div>

      <div class="grid grid-cols-1 gap-4">
        ${pdfs
          .map(
            (p) => `
          <div class="card p-5 flex flex-wrap items-center justify-between gap-4">
            <div class="space-y-1 flex-1 min-w-[260px]">
              <div class="flex flex-wrap items-center gap-2">
                <span class="badge ${p.parse_status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}">
                  ${p.parse_status === 'COMPLETED' ? '✓ Đã xác nhận' : '⚠️ Có câu cần duyệt (NEEDS_REVIEW)'}
                </span>
                <span class="text-xs font-mono text-slate-500">${p.file_name}</span>
                <span class="text-xs text-slate-400">(${Math.max(1, Math.round(p.file_size / 1024))} KB • ${p.page_count} trang)</span>
              </div>
              <h3 class="text-base font-bold text-slate-900">${p.title}</h3>
              <div class="text-xs text-slate-500">
                Chương: <strong>${p.chapter_name || 'Chưa gắn'}</strong> • Bài: <strong>${p.lesson_name || 'Chưa gắn'}</strong> • AI Engine: <code>${p.ai_model_used || 'gemini-2.5-pro'}</code>
              </div>
              <div class="text-xs text-blue-700 pt-1">
                Đề thi liên kết (${p.linkedExams.length}):
                ${
                  p.linkedExams.length === 0
                    ? '<span class="text-slate-400">Chưa gắn với đề thi nào</span>'
                    : p.linkedExams
                        .map(
                          (ex) =>
                            `<button onclick="window.SpaceXApp.navigate('#/admin/exam-detail/${ex.id}')" class="underline font-semibold mr-2">${ex.title}</button>`
                        )
                        .join('')
                }
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <a href="/api/storage/pdfs/${p.id}/view" target="_blank" class="btn btn-secondary text-xs">
                👁️ Xem PDF
              </a>
              <a href="/api/storage/pdfs/${p.id}/download" target="_blank" class="btn btn-secondary text-xs">
                📥 Tải xuống
              </a>
              <button onclick="window.SpaceXApp.openLinkPdfExamsModal(${p.id})" class="btn btn-secondary text-xs">
                🔗 Gắn vào các Bộ đề
              </button>
              <button onclick="window.SpaceXApp.triggerReplacePdf(${p.id})" class="btn btn-secondary text-xs">
                🔄 Thay thế PDF
              </button>
              <button onclick="window.SpaceXApp.deletePdfDocument(${p.id}, '${p.title}')" class="btn bg-red-50 text-red-600 hover:bg-red-100 text-xs">
                🗑️ Xóa
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
 * 16. TRANG QUẢN LÝ ĐỀ THI (#/admin/exams)
 */
export function renderAdminExamsView(exams = []) {
  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Quản lý Đề thi & Bộ bài tập</h1>
          <p class="text-sm text-slate-500 mt-1">
            Kiểm duyệt câu hỏi AI trích xuất, chỉnh sửa đáp án, thiết lập điểm số, ẩn/công khai đề thi và xem thống kê.
          </p>
        </div>
        <button onclick="window.SpaceXApp.navigate('#/admin/pdf-upload')" class="btn btn-primary">
          + Tạo đề mới từ PDF bằng AI
        </button>
      </div>

      <div class="grid grid-cols-1 gap-4">
        ${exams
          .map((ex) => {
            const statusBadge =
              ex.status === 'PUBLISHED'
                ? `<span class="badge badge-success">🌐 Đang công khai (PUBLISHED)</span>`
                : ex.status === 'DRAFT'
                ? `<span class="badge badge-warning">📝 Bản nháp / Chờ xác nhận (DRAFT)</span>`
                : `<span class="badge badge-neutral">🙈 Đang ẩn (HIDDEN)</span>`;

            return `
              <div class="card p-5 flex flex-wrap items-center justify-between gap-4 ${
                ex.needs_review_count > 0 ? 'border-amber-400 bg-amber-50/20' : ''
              }">
                <div class="space-y-1.5 flex-1 min-w-[260px]">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="badge ${ex.exam_type === 'PRACTICE' ? 'badge-info' : 'badge-neutral'}">
                      ${ex.exam_type === 'PRACTICE' ? 'Bộ bài tập' : 'Đề kiểm tra'}
                    </span>
                    ${statusBadge}
                    ${
                      ex.needs_review_count > 0
                        ? `<span class="badge badge-danger">⚠️ ${ex.needs_review_count} câu NEEDS_REVIEW (Chặn xuất bản)</span>`
                        : `<span class="badge badge-success">✓ 100% câu hỏi đã xác nhận</span>`
                    }
                  </div>
                  <h3 class="text-lg font-bold text-slate-900">${ex.title}</h3>
                  <div class="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                    <span>Chương: <strong>${ex.chapter_name || 'Chưa phân loại'}</strong></span>
                    <span>•</span>
                    <span>Số câu: <strong>${ex.question_count} câu</strong></span>
                    <span>•</span>
                    <span>Thời gian: <strong>${ex.default_duration_minutes} phút</strong></span>
                    <span>•</span>
                    <span>Lượt nộp: <strong>${ex.submission_count} lượt</strong> (Điểm TB: <strong>${ex.average_score}/10</strong>)</span>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <button onclick="window.SpaceXApp.navigate('#/admin/exam-detail/${ex.id}')" class="btn btn-primary text-xs">
                    ✏️ Xem trước / Chỉnh sửa câu hỏi & Đáp án
                  </button>
                  ${
                    ex.status !== 'PUBLISHED'
                      ? `<button onclick="window.SpaceXApp.publishExamStatus(${ex.id}, 'PUBLISHED')" class="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                           🌐 Xuất bản công khai
                         </button>`
                      : `<button onclick="window.SpaceXApp.publishExamStatus(${ex.id}, 'HIDDEN')" class="btn btn-secondary text-xs">
                           🙈 Tạm ẩn đề
                         </button>`
                  }
                  <button onclick="window.SpaceXApp.deleteExam(${ex.id}, '${ex.title}')" class="btn bg-red-50 text-red-600 hover:bg-red-100 text-xs">
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

/**
 * TRANG CHI TIẾT ĐỀ THI & BẢN XEM TRƯỚC KIỂM DUYỆT AI (AI REVIEW STUDIO: #/admin/exam-detail/:id)
 */
export function renderAdminExamDetailStudioView(examDetail, attempts = [], curriculum = {}) {
  const { questions, needsReviewCount, canPublish } = examDetail;
  const rawChapters = curriculum?.rawChapters || [];
  const rawLessons = curriculum?.rawLessons || [];

  return `
    <div class="space-y-6">
      <!-- Thanh điều hướng & Xuất bản Đề thi -->
      <div class="card p-5 border-2 ${
        needsReviewCount > 0 ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-300 bg-emerald-50/20'
      }">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <button onclick="window.SpaceXApp.navigate('#/admin/exams')" class="text-xs font-bold text-blue-600 hover:underline">
                ← Quay lại Danh sách Đề thi
              </button>
              <span>•</span>
              <span class="badge ${examDetail.status === 'PUBLISHED' ? 'badge-success' : 'badge-warning'}">
                Trạng thái: ${examDetail.status}
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold text-slate-900">${examDetail.title}</h1>
            <p class="text-xs text-slate-600 mt-1">
              ${
                needsReviewCount > 0
                  ? `⚠️ Hiện còn <strong>${needsReviewCount} câu hỏi</strong> được AI gắn cờ <code>NEEDS_REVIEW</code>. Theo quy tắc an toàn, hệ thống khóa xuất bản cho đến khi Giáo viên kiểm tra và nhấn "Xác nhận câu hỏi".`
                  : `✅ Toàn bộ <strong>${questions.length} câu hỏi</strong> và đáp án đã được đối chiếu xác nhận (verified). Đề thi sẵn sàng xuất bản!`
              }
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            ${
              examDetail.pdf_document_id
                ? `<button onclick="window.SpaceXApp.reparseExamFromPdf(${examDetail.id})" class="btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                     🔄 Phân tích lại từ PDF gốc bằng AI
                   </button>
                   <a href="/api/storage/pdfs/${examDetail.pdf_document_id}/view" target="_blank" class="btn btn-secondary text-xs">
                     📄 Mở PDF gốc ở tab mới
                   </a>`
                : ''
            }
            <button onclick="window.SpaceXApp.openAddQuestionModal(${examDetail.id})" class="btn btn-secondary text-xs">
              + Thêm câu hỏi thủ công
            </button>
            ${
              examDetail.status !== 'PUBLISHED'
                ? `<button
                     onclick="window.SpaceXApp.publishExamStatus(${examDetail.id}, 'PUBLISHED')"
                     class="btn ${
                       canPublish
                         ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                         : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                     } font-bold"
                   >
                     🌐 Xác nhận & Xuất bản Đề thi
                   </button>`
                : `<button onclick="window.SpaceXApp.publishExamStatus(${examDetail.id}, 'HIDDEN')" class="btn btn-secondary text-xs">
                     🙈 Ẩn đề thi
                   </button>`
            }
          </div>
        </div>
      </div>

      <!-- Khung chỉnh sửa thông tin chung của Đề thi -->
      <div class="card p-5">
        <h3 class="text-sm font-bold text-slate-900 mb-3">Thông tin cấu hình Đề thi</h3>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-600 mb-1">Tên đề thi / Bộ bài tập</label>
            <input id="edit-exam-title" type="text" value="${examDetail.title}" class="input text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Chương học</label>
            <select
              id="edit-exam-chapter"
              onchange="window.SpaceXApp.onEditExamChapterChange(this.value)"
              class="input text-sm"
            >
              ${rawChapters
                .map(
                  (c) =>
                    `<option value="${c.id}" ${examDetail.chapter_id === c.id ? 'selected' : ''}>${c.name}</option>`
                )
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Phần / Tiết học</label>
            <select id="edit-exam-lesson" class="input text-sm">
              ${renderGroupedLessonOptionsHtml(rawLessons, examDetail.chapter_id || rawChapters[0]?.id, examDetail.lesson_id)}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Loại đề</label>
            <select id="edit-exam-type" class="input text-sm">
              <option value="EXAM" ${examDetail.exam_type === 'EXAM' ? 'selected' : ''}>Đề kiểm tra</option>
              <option value="PRACTICE" ${examDetail.exam_type === 'PRACTICE' ? 'selected' : ''}>Bộ bài tập</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Thời gian mặc định (phút)</label>
            <input id="edit-exam-duration" type="number" value="${examDetail.default_duration_minutes}" class="input text-sm" />
          </div>
          <div class="flex flex-col justify-center space-y-1 pt-2">
            <label class="flex items-center gap-2 text-xs text-slate-700">
              <input id="edit-exam-unlimited" type="checkbox" ${examDetail.allowUnlimitedTime ? 'checked' : ''} />
              Cho phép chọn Không giới hạn giờ
            </label>
            <label class="flex items-center gap-2 text-xs text-slate-700">
              <input id="edit-exam-review" type="checkbox" ${examDetail.allowReview ? 'checked' : ''} />
              Cho phép xem đáp án sau khi nộp
            </label>
          </div>
          <div class="flex items-end">
            <button onclick="window.SpaceXApp.saveExamMetadata(${examDetail.id})" class="btn btn-primary w-full text-xs">
              💾 Lưu cấu hình đề
            </button>
          </div>
        </div>
      </div>

      <!-- Khung Split-Screen: Xem PDF Gốc (Nếu có) & Danh sách Câu hỏi + Đáp án -->
      <div class="grid grid-cols-1 ${examDetail.pdf_document_id ? 'xl:grid-cols-12' : ''} gap-6">
        ${
          examDetail.pdf_document_id
            ? `
          <div class="xl:col-span-5 card p-4 h-fit xl:sticky xl:top-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-slate-700">📄 Tài liệu PDF gốc đối chiếu (${examDetail.pdf_file_name})</span>
              <a href="/api/storage/pdfs/${examDetail.pdf_document_id}/download" target="_blank" class="text-xs font-semibold text-blue-600 hover:underline">
                📥 Tải xuống
              </a>
            </div>
            <iframe
              src="/api/storage/pdfs/${examDetail.pdf_document_id}/view"
              class="w-full h-[640px] rounded-lg border border-slate-200 bg-slate-100"
              title="PDF Viewer"
            ></iframe>
          </div>
        `
            : ''
        }

        <div class="${examDetail.pdf_document_id ? 'xl:col-span-7' : ''} space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900">
              Danh sách Câu hỏi & Đáp án trích xuất (${questions.length} câu)
            </h3>
            ${
              examDetail.pdf_document_id
                ? `<button onclick="window.SpaceXApp.reparseExamFromPdf(${examDetail.id})" class="btn btn-secondary text-xs">
                     🔄 Trích xuất lại từ PDF
                   </button>`
                : ''
            }
          </div>

          ${
            questions.length === 0
              ? `
            <div class="card p-6 border-2 border-amber-300 bg-amber-50/40 space-y-3">
              <div class="text-base font-bold text-amber-900">
                ⚠️ Chưa có câu hỏi nào được trích xuất cho đề thi này (0 câu)
              </div>
              <p class="text-xs text-slate-700 leading-relaxed">
                Nguyên nhân thường gặp: File PDF vừa tải lên là <strong>bản quét ảnh (Scanned Image PDF)</strong> hoặc sử dụng bảng mã font đặc biệt khi chưa điền <code>GEMINI_API_KEY</code>.
                Bạn có thể nhấn nút <strong>"🔄 Phân tích lại từ PDF gốc bằng AI"</strong> bên dưới để hệ thống trích xuất lại câu hỏi, hình vẽ và bảng đáp án từ file PDF gốc, hoặc cấu hình <code>GEMINI_API_KEY</code> tại mục Upload PDF.
              </p>
              <div class="flex flex-wrap items-center gap-2 pt-1">
                ${
                  examDetail.pdf_document_id
                    ? `<button onclick="window.SpaceXApp.reparseExamFromPdf(${examDetail.id})" class="btn btn-primary text-xs">
                         🔄 Phân tích & Trích xuất lại từ PDF gốc ngay
                       </button>`
                    : ''
                }
                <button onclick="window.SpaceXApp.navigate('#/admin/pdf-upload')" class="btn btn-secondary text-xs">
                  🔑 Cấu hình Gemini API Key
                </button>
              </div>
            </div>
          `
              : ''
          }

          ${questions
            .map(
              (q, idx) => `
            <div class="card p-5 border-2 ${
              q.needsReview ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'
            }">
              <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-bold">
                    Câu ${q.questionNumber}
                  </span>
                  <span class="badge badge-neutral">${q.questionType}</span>
                  <span class="text-xs text-slate-500">
                    Điểm: <strong>${q.points}đ</strong> • Trang <strong>${q.sourcePage}</strong> PDF • Độ tin cậy AI: <strong>${Math.round(
                (q.confidence || 0.98) * 100
              )}%</strong>
                  </span>
                  ${
                    q.needsReview
                      ? `<span class="badge badge-danger">⚠️ NEEDS_REVIEW</span>`
                      : `<span class="badge badge-success">✓ verified</span>`
                  }
                </div>

                <!-- Nút di chuyển thứ tự Lên / Xuống & Sửa / Xóa -->
                <div class="flex items-center gap-1.5">
                  <button
                    onclick="window.SpaceXApp.moveQuestionOrder(${examDetail.id}, ${idx}, -1)"
                    class="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100"
                    title="Chuyển lên"
                    ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}
                  >↑</button>
                  <button
                    onclick="window.SpaceXApp.moveQuestionOrder(${examDetail.id}, ${idx}, 1)"
                    class="px-2 py-1 rounded border border-slate-200 text-xs hover:bg-slate-100"
                    title="Chuyển xuống"
                    ${idx === questions.length - 1 ? 'disabled style="opacity:0.3"' : ''}
                  >↓</button>
                  <button
                    onclick="window.SpaceXApp.openEditQuestionModal(${q.id})"
                    class="btn ${q.needsReview ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'btn-secondary'} text-xs"
                  >
                    ${q.needsReview ? '✏️ Kiểm tra & Xác nhận đáp án' : '✏️ Sửa câu hỏi / Đáp án'}
                  </button>
                  <button
                    onclick="window.SpaceXApp.deleteQuestionItem(${q.id}, ${q.questionNumber})"
                    class="btn bg-red-50 text-red-600 text-xs"
                  >🗑️</button>
                </div>
              </div>

              ${
                q.needsReview && q.reviewReason
                  ? `<div class="mt-3 p-3 rounded-lg bg-amber-100/80 border border-amber-300 text-xs text-amber-950">
                       <strong>Lý do AI đánh dấu NEEDS_REVIEW:</strong> ${q.reviewReason}
                     </div>`
                  : ''
              }

              <div class="mt-3 text-base text-slate-900 font-medium">
                ${renderMathText(q.content)}
              </div>

              ${q.svgDiagram ? `<div class="my-3 max-w-lg">${q.svgDiagram}</div>` : ''}
              ${
                q.imageUrl
                  ? `<div class="my-3"><img src="${q.imageUrl}" class="max-h-56 rounded border" alt="Hình câu hỏi" /></div>`
                  : ''
              }

              <!-- Hiển thị Phương án & Đáp án chuẩn -->
              <div class="mt-4 pt-3 border-t border-slate-100 text-sm">
                ${renderAdminQuestionAnswerPreview(q)}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderAdminQuestionAnswerPreview(q) {
  if (q.questionType === 'MULTIPLE_CHOICE') {
    const opts = q.options || {};
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        ${['A', 'B', 'C', 'D']
          .map((k) => {
            const isCorrect = q.correctAnswer === k;
            return `
              <div class="p-2.5 rounded-lg border ${
                isCorrect
                  ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-950'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }">
                <span>${k}. ${renderMathText(opts[k] || '')}</span>
                ${isCorrect ? '<span class="ml-2 text-xs text-emerald-700">(✓ Đáp án đúng)</span>' : ''}
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  if (q.questionType === 'TRUE_FALSE') {
    const stmts = q.statements || {};
    return `
      <div class="space-y-1.5">
        ${['a', 'b', 'c', 'd']
          .map((k) => {
            const item = stmts[k] || {};
            const badge =
              item.correct === true
                ? '<span class="badge badge-success">Đúng</span>'
                : item.correct === false
                ? '<span class="badge badge-danger">Sai</span>'
                : '<span class="badge badge-warning">Chưa xác định</span>';
            return `
              <div class="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <span><strong>${k})</strong> ${renderMathText(item.content || '')}</span>
                ${badge}
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  return `
    <div class="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
      Đáp án trả lời ngắn chuẩn: <strong>${q.correctAnswer || '(Chưa có - Cần xác nhận)'}</strong>
      ${
        q.equivalentAnswers?.length > 0
          ? `<span class="text-xs text-slate-600 ml-2">(Tương đương: ${q.equivalentAnswers.join(' ; ')})</span>`
          : ''
      }
    </div>
  `;
}

/**
 * 17. TRANG QUẢN LÝ NGÂN HÀNG CÂU HỎI (#/admin/questions)
 */
export function renderAdminQuestionsView(questions = [], onlyNeedsReview = false) {
  return `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Ngân hàng Câu hỏi & Duyệt câu hỏi AI</h1>
          <p class="text-sm text-slate-500 mt-1">
            Quản lý toàn bộ câu hỏi Toán THPT, công thức LaTeX và rà soát các câu hỏi được AI đánh dấu cần kiểm tra.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick="window.SpaceXApp.navigate('#/admin/questions')"
            class="btn ${!onlyNeedsReview ? 'btn-primary' : 'btn-secondary'} text-xs"
          >
            Tất cả câu hỏi
          </button>
          <button
            onclick="window.SpaceXApp.navigate('#/admin/questions?needsReview=true')"
            class="btn ${onlyNeedsReview ? 'bg-amber-600 text-white' : 'btn-secondary'} text-xs"
          >
            ⚠️ Chỉ hiện câu NEEDS_REVIEW
          </button>
        </div>
      </div>

      ${
        questions.length === 0
          ? `<div class="card p-10 text-center text-slate-500">Không có câu hỏi nào trong danh mục lọc này.</div>`
          : `<div class="space-y-4">
              ${questions
                .map(
                  (q) => `
                <div class="card p-5 border ${q.needsReview ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'}">
                  <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                      <span class="badge badge-info">${q.exam_title}</span>
                      <span class="font-bold text-sm">Câu ${q.question_number}</span>
                      <span class="badge badge-neutral">${q.question_type}</span>
                      ${
                        q.needsReview
                          ? `<span class="badge badge-danger">⚠️ NEEDS_REVIEW</span>`
                          : `<span class="badge badge-success">✓ verified</span>`
                      }
                    </div>
                    <button onclick="window.SpaceXApp.navigate('#/admin/exam-detail/${q.exam_id}')" class="btn btn-primary text-xs">
                      Mở trong Đề thi & Chỉnh sửa →
                    </button>
                  </div>
                  <div class="mt-3 text-sm sm:text-base text-slate-900">${renderMathText(q.content)}</div>
                  ${
                    q.review_reason
                      ? `<div class="mt-2 text-xs text-amber-800 font-medium">Lý do cần kiểm tra: ${q.review_reason}</div>`
                      : ''
                  }
                </div>
              `
                )
                .join('')}
             </div>`
      }
    </div>
  `;
}

/**
 * 18. TRANG THỐNG KÊ, CẤU HÌNH BẢNG XẾP HẠNG & NHẬT KÝ AI (#/admin/statistics)
 */
export function renderAdminStatisticsView(statsData, lbData, aiStatus) {
  const { scoreDistribution, examStats, chapterStats } = statsData;
  const maxDistCount = Math.max(1, ...scoreDistribution.map((d) => d.count));

  return `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Thống kê Kết quả Học tập & Quản trị Hệ thống</h1>
        <p class="text-sm text-slate-500 mt-1">
          Phân tích phổ điểm toàn trường, thống kê theo đề thi, điều khiển Bảng xếp hạng và theo dõi Nhật ký xử lý Gemini AI.
        </p>
      </div>

      <!-- Cấu hình Bảng xếp hạng (Leaderboard Controls) -->
      <div class="card p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 class="text-base font-bold text-slate-900">Quản lý Quyền hiển thị Bảng xếp hạng Học sinh</h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Giáo viên có toàn quyền bật/tắt bảng xếp hạng, ẩn/công khai và cho phép học sinh dùng biệt danh thay vì tên thật.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input id="lb-cfg-enabled" type="checkbox" ${lbData.enabled ? 'checked' : ''} />
              Bật Bảng xếp hạng
            </label>
            <label class="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input id="lb-cfg-public" type="checkbox" ${lbData.isPublic ? 'checked' : ''} />
              Công khai cho Học sinh
            </label>
            <label class="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input id="lb-cfg-nickname" type="checkbox" ${lbData.allowNickname ? 'checked' : ''} />
              Sử dụng Biệt danh (Nickname)
            </label>
            <button onclick="window.SpaceXApp.saveLeaderboardSettings()" class="btn btn-primary text-xs">
              💾 Lưu cấu hình Bảng xếp hạng
            </button>
          </div>
        </div>
      </div>

      <!-- Phổ điểm & Thống kê theo Chương -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card p-6">
          <h3 class="text-base font-bold text-slate-900 mb-4">Phổ điểm các lượt làm bài</h3>
          <div class="space-y-3">
            ${scoreDistribution
              .map((d) => {
                const pct = Math.round((d.count / maxDistCount) * 100);
                return `
                  <div>
                    <div class="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>${d.range}</span>
                      <span>${d.count} bài nộp</span>
                    </div>
                    <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full bg-blue-600 rounded-full" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="card p-6">
          <h3 class="text-base font-bold text-slate-900 mb-4">Thống kê kết quả theo Chương học</h3>
          <div class="space-y-2.5">
            ${chapterStats
              .map(
                (c) => `
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div class="font-bold text-slate-900">${c.name}</div>
                  <div class="text-slate-500">${c.exam_count} bộ đề • ${c.submission_count} lượt nộp</div>
                </div>
                <div class="text-sm font-extrabold text-blue-600">TB: ${c.avg_score}/10</div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>

      <!-- Thống kê chi tiết từng Đề thi -->
      <div class="card overflow-hidden">
        <div class="p-5 border-b border-slate-200">
          <h3 class="text-base font-bold text-slate-900">Thống kê kết quả theo từng Đề thi & Bộ bài tập</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th class="p-4">Tên Đề thi</th>
                <th class="p-4">Số câu</th>
                <th class="p-4">Số lượt nộp</th>
                <th class="p-4">Điểm TB</th>
                <th class="p-4">Cao nhất / Thấp nhất</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${examStats
                .map(
                  (es) => `
                <tr>
                  <td class="p-4 font-bold text-slate-900">${es.title}</td>
                  <td class="p-4">${es.question_count} câu</td>
                  <td class="p-4 font-semibold text-blue-600">${es.submission_count} lượt</td>
                  <td class="p-4 font-bold">${es.avg_score} / 10</td>
                  <td class="p-4 text-xs">
                    <span class="text-emerald-600 font-bold">Max: ${es.max_score}</span> •
                    <span class="text-slate-500">Min: ${es.min_score}</span>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Nhật ký gọi Gemini AI API (AI Processing Logs) -->
      <div class="card overflow-hidden">
        <div class="p-5 border-b border-slate-200">
          <h3 class="text-base font-bold text-slate-900">Nhật ký Xử lý PDF bằng Gemini AI Engine (Audit Logs)</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 uppercase text-slate-500">
                <th class="p-3">Thời gian</th>
                <th class="p-3">File PDF</th>
                <th class="p-3">Model cấu hình</th>
                <th class="p-3">Model thực thi</th>
                <th class="p-3">Số câu / Cần duyệt</th>
                <th class="p-3">Thời gian xử lý</th>
                <th class="p-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${(aiStatus?.recentLogs || [])
                .map(
                  (log) => `
                <tr>
                  <td class="p-3 text-slate-500">${log.created_at}</td>
                  <td class="p-3 font-medium text-slate-900">${log.file_name}</td>
                  <td class="p-3 font-mono">${log.model_requested}</td>
                  <td class="p-3 font-mono text-blue-700">${log.model_used}</td>
                  <td class="p-3">${log.questions_count} câu (${log.needs_review_count} cần duyệt)</td>
                  <td class="p-3">${log.duration_ms} ms (Retry: ${log.retry_count})</td>
                  <td class="p-3">
                    <span class="badge ${log.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}">
                      ${log.status}
                    </span>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

