import { renderMathText } from './mathRenderer.js';
import {
  renderStudentDashboardView,
  renderStudentSubjectsView,
  renderStudentChaptersView,
  renderStudentExamsView,
  renderStudentExamTakeView,
  renderStudentResultView,
  renderStudentHistoryView,
  renderStudentLeaderboardView,
  formatRemainingTime,
  renderGithubContributionGraphHtml,
} from './studentViews.js';
import {
  renderAdminDashboardView,
  renderAdminStudentsView,
  renderAdminCurriculumView,
  renderAdminPdfUploadView,
  renderAdminPdfsView,
  renderAdminExamsView,
  renderAdminExamDetailStudioView,
  renderAdminQuestionsView,
  renderAdminStatisticsView,
} from './adminViews.js';

const AppState = {
  token: localStorage.getItem('spacex_math_token') || '',
  user: JSON.parse(localStorage.getItem('spacex_math_user') || 'null'),
  curriculum: null,
  activeExamTake: null,
  currentQuestionIdx: 0,
  countdownInterval: null,
  selectedPdfBase64: null,
  selectedPdfName: '',
  currentAdminExamDetail: null,
  allExamsCache: [],
};

/**
 * Gọi REST API Backend kèm JWT Authorization Header
 */
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (AppState.token) {
    headers['Authorization'] = `Bearer ${AppState.token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      logout(false);
    }
    throw new Error(data.error || `Lỗi kết nối máy chủ (${res.status})`);
  }
  return data;
}

/**
 * Hiển thị thông báo trạng thái (Toast Notification)
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  const bgCls =
    type === 'error'
      ? 'bg-red-600 text-white'
      : type === 'warning'
      ? 'bg-amber-500 text-slate-950'
      : 'bg-slate-900 text-white';
  el.className = `px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 transition-all ${bgCls}`;
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : '✓'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 4200);
}

function showModal(htmlContent) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
        <button onclick="window.SpaceXApp.closeModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
          ✕
        </button>
        ${htmlContent}
      </div>
    </div>
  `;
}

function closeModal() {
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) modalRoot.innerHTML = '';
}

function stopExamCountdown() {
  if (AppState.countdownInterval) {
    clearInterval(AppState.countdownInterval);
    AppState.countdownInterval = null;
  }
}

function logout(redirect = true) {
  stopExamCountdown();
  AppState.token = '';
  AppState.user = null;
  localStorage.removeItem('spacex_math_token');
  localStorage.removeItem('spacex_math_user');
  if (redirect) {
    navigate('#/login');
  }
}

function navigate(hash) {
  if (window.location.hash === hash) {
    handleRouteChange();
  } else {
    window.location.hash = hash;
  }
}

/**
 * Render Trang Quên mật khẩu (#/forgot-password) - Khôi phục bằng Mã VIP do Giáo viên cấp
 * Bước 1: Nhập Username + Mã VIP  ->  Bước 2: Hiện ô tạo mật khẩu mới
 */
function renderForgotPasswordPage() {
  const appRoot = document.getElementById('app-root');
  const lastUsername = (localStorage.getItem('spacex_last_username') || '').replace(/"/g, '&quot;');

  appRoot.innerHTML = `
    <div class="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4">
      <div class="max-w-md w-full mx-auto">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 text-white font-extrabold text-xl shadow-md mb-3">
            🔑
          </div>
          <h1 class="text-2xl font-extrabold text-slate-900">Khôi phục Mật khẩu</h1>
          <p class="text-sm text-slate-500 mt-1">
            Nhập tên đăng nhập và <strong>Mã VIP</strong> do Giáo viên cấp để tạo mật khẩu mới.
          </p>
        </div>

        <div class="card p-6 sm:p-8 shadow-lg border-slate-200">
          <!-- BƯỚC 1: Xác thực Mã VIP -->
          <form id="forgot-step1" onsubmit="window.SpaceXApp.submitForgotVerify(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Tên đăng nhập (Username)</label>
              <input
                id="forgot-username"
                type="text"
                autocomplete="username"
                value="${lastUsername}"
                required
                placeholder="Nhập username của bạn (VD: an12a1)"
                class="input"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-amber-700 mb-1">Mã VIP (do Giáo viên cấp)</label>
              <input
                id="forgot-vipcode"
                type="text"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                required
                placeholder="VD: VIP-AB12-CD34"
                class="input font-mono tracking-wider uppercase border-amber-300"
              />
            </div>
            <button id="forgot-step1-btn" type="submit" class="btn w-full py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white">
              Xác nhận Mã VIP →
            </button>
          </form>

          <!-- BƯỚC 2: Tạo mật khẩu mới (chỉ hiện khi Mã VIP hợp lệ) -->
          <form id="forgot-step2" onsubmit="window.SpaceXApp.submitForgotReset(event)" class="space-y-4 hidden">
            <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              ✓ Mã VIP hợp lệ! Tạo mật khẩu mới cho tài khoản
              <strong id="forgot-verified-name"></strong>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-bold text-blue-700">Mật khẩu mới (Tối thiểu 6 ký tự)</label>
                <button
                  type="button"
                  onclick="window.SpaceXApp.togglePasswordField('forgot-newpwd', this)"
                  class="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  👁️ Hiện mật khẩu
                </button>
              </div>
              <input
                id="forgot-newpwd"
                type="password"
                autocomplete="new-password"
                required
                minlength="6"
                placeholder="Nhập mật khẩu mới"
                class="input border-blue-300"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-blue-700 mb-1">Nhập lại mật khẩu mới</label>
              <input
                id="forgot-confirmpwd"
                type="password"
                autocomplete="new-password"
                required
                minlength="6"
                placeholder="Nhập lại mật khẩu mới"
                class="input border-blue-300"
              />
            </div>
            <button id="forgot-step2-btn" type="submit" class="btn btn-primary w-full py-2.5 text-sm font-bold">
              Lưu mật khẩu mới & Đăng nhập →
            </button>
            <button
              type="button"
              onclick="window.SpaceXApp.navigate('#/forgot-password')"
              class="w-full text-xs font-semibold text-slate-500 hover:underline"
            >
              ← Nhập lại Username / Mã VIP khác
            </button>
          </form>

          <div class="mt-6 pt-5 border-t border-slate-100 text-center space-y-2">
            <p class="text-[11px] text-slate-500">
              Chưa có Mã VIP? Vui lòng liên hệ trực tiếp <strong>Giáo viên</strong> để được cấp.
            </p>
            <button
              type="button"
              onclick="window.SpaceXApp.navigate('#/login')"
              class="btn btn-secondary w-full py-2.5 text-xs font-bold"
            >
              ← Quay lại Đăng nhập
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Trang Đăng nhập (#/login) và Đăng ký (#/register)
 */
function renderAuthPage(mode = 'login') {
  const appRoot = document.getElementById('app-root');
  const isLogin = mode === 'login';
  const lastUsername = localStorage.getItem('spacex_last_username') || '';

  appRoot.innerHTML = `
    <div class="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4">
      <div class="max-w-md w-full mx-auto">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold text-xl shadow-md mb-3">
            SX
          </div>
          <h1 class="text-2xl font-extrabold text-slate-900">SPACE X MATH</h1>
          <p class="text-sm text-slate-500 mt-1">
            Nền tảng Học tập & Luyện thi Toán THPT Trực tuyến ứng dụng Trí tuệ Nhân tạo (AI)
          </p>
        </div>

        <div class="card p-6 sm:p-8 shadow-lg border-slate-200">
          <!-- Chuyển đổi Đăng nhập / Đăng ký -->
          <div class="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              onclick="window.SpaceXApp.navigate('#/login')"
              class="py-2 rounded-lg text-sm font-bold transition ${
                isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
              }"
            >
              Đăng nhập
            </button>
            <button
              onclick="window.SpaceXApp.navigate('#/register')"
              class="py-2 rounded-lg text-sm font-bold transition ${
                !isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
              }"
            >
              Đăng ký Học sinh
            </button>
          </div>

          ${
            isLogin
              ? `
            <form onsubmit="window.SpaceXApp.submitLogin(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Tên đăng nhập (Username hoặc Họ tên)</label>
                <input
                  id="auth-username"
                  name="username"
                  type="text"
                  autocomplete="username"
                  value="${lastUsername.replace(/"/g, '&quot;')}"
                  required
                  placeholder="Nhập username của bạn (VD: an12a1)"
                  class="input"
                />
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-slate-700">Mật khẩu</label>
                  <button
                    type="button"
                    onclick="window.SpaceXApp.togglePasswordField('auth-password', this)"
                    class="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    👁️ Hiện mật khẩu
                  </button>
                </div>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  placeholder="Nhập mật khẩu"
                  class="input"
                />
              </div>
              <button type="submit" class="btn btn-primary w-full py-2.5 text-sm font-bold">
                Đăng nhập vào Hệ thống →
              </button>
              <div class="text-center">
                <button
                  type="button"
                  onclick="window.SpaceXApp.navigate('#/forgot-password')"
                  class="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline"
                >
                  🔑 Quên mật khẩu? Khôi phục bằng Mã VIP
                </button>
              </div>
            </form>

            <!-- Gợi ý cho Học sinh mới chưa có tài khoản -->
            <div class="mt-6 pt-5 border-t border-slate-100 text-center">
              <div class="text-xs font-medium text-slate-600 mb-2.5">
                Học sinh mới chưa có tài khoản học tập?
              </div>
              <button
                type="button"
                onclick="window.SpaceXApp.navigate('#/register')"
                class="btn btn-secondary w-full py-2.5 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                🎓 Nhấn vào đây để Tạo tài khoản Học sinh mới →
              </button>
            </div>
          `
              : `
            <form onsubmit="window.SpaceXApp.submitRegister(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Họ và tên học sinh</label>
                <input
                  id="reg-fullname"
                  type="text"
                  autocomplete="off"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  class="input"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Lớp</label>
                  <input
                    id="reg-classname"
                    type="text"
                    autocomplete="off"
                    value="12A1"
                    required
                    placeholder="12A1"
                    class="input"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Biệt danh (Tùy chọn)</label>
                  <input
                    id="reg-nickname"
                    type="text"
                    autocomplete="off"
                    placeholder="VD: An MathPro"
                    class="input"
                  />
                </div>
              </div>
              <div class="pt-2 border-t border-slate-100">
                <label class="block text-xs font-bold text-blue-700 mb-1">Tên đăng nhập (Username dùng để đăng nhập)</label>
                <input
                  id="reg-username"
                  name="username"
                  type="text"
                  autocomplete="username"
                  required
                  placeholder="Ví dụ: an12a1 (chữ không dấu & số)"
                  class="input border-blue-300"
                />
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-blue-700">Mật khẩu (Tối thiểu 6 ký tự)</label>
                  <button
                    type="button"
                    onclick="window.SpaceXApp.togglePasswordField('reg-password', this)"
                    class="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    👁️ Hiện mật khẩu
                  </button>
                </div>
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="6"
                  placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
                  class="input border-blue-300"
                />
              </div>
              <p class="text-xs text-slate-500">
                ✓ Không yêu cầu Email hay OTP. Bạn có thể đăng nhập bằng <strong>Username</strong> (hoặc <strong>Họ tên</strong>) ngay sau khi tạo tài khoản.
              </p>
              <button type="submit" class="btn btn-primary w-full py-2.5 text-sm font-bold">
                Tạo tài khoản Học sinh →
              </button>
            </form>
          `
          }
        </div>
      </div>
    </div>
  `;
}

/**
 * Khung giao diện chính (Header + Thanh điều hướng cho Admin hoặc Học sinh + Main Content)
 */
function renderAppShell(contentHtml, activeRoute = '') {
  const appRoot = document.getElementById('app-root');
  const user = AppState.user;
  const isAdmin = user?.role === 'ADMIN';

  const navItems = isAdmin
    ? [
        { hash: '#/admin/dashboard', label: '📊 Dashboard' },
        { hash: '#/admin/pdf-upload', label: '✨ Upload PDF & AI Tạo đề' },
        { hash: '#/admin/exams', label: '📝 Quản lý Đề thi' },
        { hash: '#/admin/questions', label: '❓ Quản lý Câu hỏi' },
        { hash: '#/admin/pdfs', label: '📁 Kho PDF gốc' },
        { hash: '#/admin/curriculum', label: '📚 Chương & Bài học' },
        { hash: '#/admin/students', label: '👥 Quản lý Học sinh' },
        { hash: '#/admin/statistics', label: '📈 Thống kê & AI Logs' },
      ]
    : [
        { hash: '#/student/dashboard', label: '🏠 Trang chủ' },
        { hash: '#/student/subjects', label: '📘 Môn học' },
        { hash: '#/student/chapters', label: '📂 Chương & Bài học' },
        { hash: '#/student/exams', label: '✍️ Danh sách Bài tập & Đề thi' },
        { hash: '#/student/history', label: '🕒 Lịch sử làm bài' },
        { hash: '#/student/leaderboard', label: '🏆 Bảng xếp hạng' },
      ];

  appRoot.innerHTML = `
    <div class="min-h-screen flex flex-col bg-slate-50">
      <!-- Top Header -->
      <header class="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 cursor-pointer" onclick="window.SpaceXApp.navigate('${
            isAdmin ? '#/admin/dashboard' : '#/student/dashboard'
          }')">
            <div class="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
              SX
            </div>
            <div>
              <div class="font-extrabold text-slate-900 text-base leading-none flex items-center gap-2">
                SPACE X MATH
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isAdmin ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                }">
                  ${isAdmin ? 'Giáo viên / Admin' : 'Học sinh THPT'}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5">AI-Powered Exam & Learning Platform</div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="hidden sm:block text-right">
              <div class="text-xs font-bold text-slate-900">${user?.fullName || ''}</div>
              <div class="text-[11px] text-slate-500">@${user?.username || ''} • ${user?.className || ''}</div>
            </div>
            <button onclick="window.SpaceXApp.openProfileModal()" class="btn btn-secondary text-xs">
              🔑 Tài khoản
            </button>
            <button onclick="window.SpaceXApp.logout()" class="btn bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 text-xs">
              Đăng xuất
            </button>
          </div>
        </div>

        <!-- Sub-navigation Bar -->
        <div class="bg-slate-50/80 border-t border-slate-200/80">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-1.5">
            ${navItems
              .map((item) => {
                const isActive = activeRoute.startsWith(item.hash.split('?')[0]);
                return `
                  <button
                    onclick="window.SpaceXApp.navigate('${item.hash}')"
                    class="px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }"
                  >
                    ${item.label}
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      </header>

      <!-- Main View Content -->
      <main id="main-view-container" class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        ${contentHtml}
      </main>

      <!-- Footer -->
      <footer class="bg-white border-t border-slate-200 py-4 mt-10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div><strong>Space X Math</strong> — Nền tảng Học tập & Luyện thi Toán THPT tự động hóa bằng Gemini AI</div>
          <div>Bảo mật JWT • Chấm điểm tự động 3 dạng thức • GitHub Learning Activity</div>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Bộ điều phối Route (Client Router kết nối trực tiếp với Backend API)
 */
async function handleRouteChange() {
  stopExamCountdown();
  const rawHash = window.location.hash || '';

  if (!AppState.token || !AppState.user) {
    if (rawHash === '#/register') {
      renderAuthPage('register');
    } else if (rawHash === '#/forgot-password') {
      renderForgotPasswordPage();
    } else {
      renderAuthPage('login');
    }
    return;
  }

  const isAdmin = AppState.user.role === 'ADMIN';
  if (
    !rawHash ||
    rawHash === '#/' ||
    rawHash === '#/login' ||
    rawHash === '#/register' ||
    rawHash === '#/forgot-password'
  ) {
    navigate(isAdmin ? '#/admin/dashboard' : '#/student/dashboard');
    return;
  }

  const [routePath, queryString] = rawHash.split('?');
  const queryParams = new URLSearchParams(queryString || '');

  // Đảm bảo đã tải cây chương trình học
  if (!AppState.curriculum) {
    try {
      AppState.curriculum = await apiFetch('/api/curriculum');
    } catch {
      AppState.curriculum = { subjects: [], rawSubjects: [], rawChapters: [], rawLessons: [] };
    }
  }

  try {
    // ---------------- STUDENT ROUTES ----------------
    if (routePath === '#/student/dashboard') {
      const data = await apiFetch('/api/student/dashboard');
      renderAppShell(renderStudentDashboardView(data), routePath);
      return;
    }

    if (routePath === '#/student/subjects') {
      AppState.curriculum = await apiFetch('/api/curriculum');
      renderAppShell(renderStudentSubjectsView(AppState.curriculum), routePath);
      return;
    }

    if (routePath === '#/student/chapters') {
      AppState.curriculum = await apiFetch('/api/curriculum');
      renderAppShell(
        renderStudentChaptersView(AppState.curriculum, queryParams.get('subjectId')),
        routePath
      );
      return;
    }

    if (routePath === '#/student/exams') {
      const filters = {
        chapterId: queryParams.get('chapterId') || '',
        lessonId: queryParams.get('lessonId') || '',
        examType: queryParams.get('examType') || '',
      };
      const qs = new URLSearchParams();
      if (filters.chapterId) qs.set('chapterId', filters.chapterId);
      if (filters.lessonId) qs.set('lessonId', filters.lessonId);
      if (filters.examType) qs.set('examType', filters.examType);
      const { exams } = await apiFetch(`/api/student/exams?${qs.toString()}`);
      AppState.allExamsCache = exams;
      renderAppShell(renderStudentExamsView(exams, AppState.curriculum, filters), routePath);
      return;
    }

    const examTakeMatch = routePath.match(/^#\/student\/exam-take\/(\d+)$/);
    if (examTakeMatch) {
      const attemptId = Number(examTakeMatch[1]);
      const takeState = await apiFetch(`/api/student/attempts/${attemptId}/take`);
      if (takeState.attempt.status !== 'IN_PROGRESS') {
        navigate(`#/student/result/${attemptId}`);
        return;
      }
      AppState.activeExamTake = takeState;
      AppState.currentQuestionIdx = 0;
      renderAppShell(renderStudentExamTakeView(takeState, 0), '#/student/exams');
      startClientSyncedCountdown();
      return;
    }

    const resultMatch = routePath.match(/^#\/student\/result\/(\d+)$/);
    if (resultMatch) {
      const attemptId = Number(resultMatch[1]);
      const resData = await apiFetch(`/api/student/attempts/${attemptId}/result`);
      renderAppShell(renderStudentResultView(resData), '#/student/history');
      return;
    }

    if (routePath === '#/student/history') {
      const { history } = await apiFetch('/api/student/history');
      renderAppShell(renderStudentHistoryView(history), routePath);
      return;
    }

    if (routePath === '#/student/leaderboard') {
      const periodType = queryParams.get('periodType') || 'ALL_TIME';
      const lbData = await apiFetch(`/api/leaderboard?periodType=${periodType}`);
      renderAppShell(renderStudentLeaderboardView(lbData), routePath);
      return;
    }

    // ---------------- ADMIN ROUTES ----------------
    if (routePath === '#/admin/dashboard') {
      const data = await apiFetch('/api/admin/dashboard');
      renderAppShell(renderAdminDashboardView(data), routePath);
      return;
    }

    if (routePath === '#/admin/students') {
      const search = queryParams.get('search') || '';
      const status = queryParams.get('status') || '';
      const { students } = await apiFetch(
        `/api/admin/students?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`
      );
      renderAppShell(renderAdminStudentsView(students, { search, status }), routePath);
      return;
    }

    if (routePath === '#/admin/curriculum') {
      AppState.curriculum = await apiFetch('/api/curriculum');
      renderAppShell(renderAdminCurriculumView(AppState.curriculum), routePath);
      return;
    }

    if (routePath === '#/admin/pdf-upload') {
      const [aiStatus, curr, pdfsRes] = await Promise.all([
        apiFetch('/api/admin/ai/status'),
        apiFetch('/api/curriculum'),
        apiFetch('/api/admin/pdfs'),
      ]);
      AppState.curriculum = curr;
      const qChapterId = queryParams.get('chapterId') || '';
      const qLessonId = queryParams.get('lessonId') || '';
      const foundLesson = qLessonId
        ? (curr.rawLessons || []).find((l) => Number(l.id) === Number(qLessonId))
        : null;
      const prefill = {
        chapterId: qChapterId || foundLesson?.chapter_id || '',
        lessonId: qLessonId,
        title: foundLesson ? `BTVN - ${foundLesson.name}` : '',
      };
      renderAppShell(renderAdminPdfUploadView(aiStatus, curr, pdfsRes.pdfs, prefill), routePath);
      return;
    }

    if (routePath === '#/admin/pdfs') {
      const [pdfsRes, examsRes] = await Promise.all([
        apiFetch('/api/admin/pdfs'),
        apiFetch('/api/admin/exams'),
      ]);
      AppState.allExamsCache = examsRes.exams;
      renderAppShell(renderAdminPdfsView(pdfsRes.pdfs, examsRes.exams), routePath);
      return;
    }

    if (routePath === '#/admin/exams') {
      const { exams } = await apiFetch('/api/admin/exams');
      AppState.allExamsCache = exams;
      renderAppShell(renderAdminExamsView(exams), routePath);
      return;
    }

    const adminExamDetailMatch = routePath.match(/^#\/admin\/exam-detail\/(\d+)$/);
    if (adminExamDetailMatch) {
      const examId = Number(adminExamDetailMatch[1]);
      const [{ exam, attempts }, curr] = await Promise.all([
        apiFetch(`/api/admin/exams/${examId}`),
        apiFetch('/api/curriculum'),
      ]);
      AppState.currentAdminExamDetail = exam;
      AppState.curriculum = curr;
      renderAppShell(renderAdminExamDetailStudioView(exam, attempts, curr), '#/admin/exams');
      return;
    }

    if (routePath === '#/admin/questions') {
      const onlyNeedsReview = queryParams.get('needsReview') === 'true';
      const { questions } = await apiFetch(
        `/api/admin/questions${onlyNeedsReview ? '?needsReview=true' : ''}`
      );
      renderAppShell(renderAdminQuestionsView(questions, onlyNeedsReview), routePath);
      return;
    }

    if (routePath === '#/admin/statistics') {
      const [statsData, lbData, aiStatus] = await Promise.all([
        apiFetch('/api/admin/statistics'),
        apiFetch('/api/leaderboard?periodType=ALL_TIME'),
        apiFetch('/api/admin/ai/status'),
      ]);
      renderAppShell(renderAdminStatisticsView(statsData, lbData, aiStatus), routePath);
      return;
    }

    // Fallback
    navigate(isAdmin ? '#/admin/dashboard' : '#/student/dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Đồng hồ đếm ngược kiểm soát chặt chẽ từ thời gian hết hạn trên Backend
 * Khi hết thời gian: Tự động khóa giao diện, tự động gửi bài làm và chuyển sang màn hình kết quả
 */
function startClientSyncedCountdown() {
  stopExamCountdown();
  const attempt = AppState.activeExamTake?.attempt;
  if (!attempt || attempt.remainingSeconds === null || attempt.remainingSeconds === undefined) {
    return;
  }

  let remaining = Number(attempt.remainingSeconds);
  AppState.countdownInterval = setInterval(async () => {
    remaining = Math.max(0, remaining - 1);
    if (AppState.activeExamTake?.attempt) {
      AppState.activeExamTake.attempt.remainingSeconds = remaining;
    }
    const el = document.getElementById('exam-countdown-display');
    if (el) {
      el.textContent = formatRemainingTime(remaining);
      if (remaining <= 60) {
        el.classList.add('text-red-600');
      }
    }

    if (remaining <= 0) {
      stopExamCountdown();
      showToast('Đã hết thời gian làm bài! Hệ thống đang tự động khóa và nộp bài của bạn...', 'warning');
      await executeSubmitExam(true);
    }
  }, 1000);
}

/**
 * Thu thập toàn bộ câu trả lời nháp hiện tại để gửi lưu hoặc chấm điểm
 */
function collectCurrentDraftAnswersPayload() {
  const questions = AppState.activeExamTake?.questions || [];
  return questions.map((q) => ({
    questionId: q.id,
    selectedOption: q.studentDraft?.selectedOption || null,
    tfAnswers: q.studentDraft?.tfAnswers || null,
    shortAnswer: q.studentDraft?.shortAnswer ?? null,
    isFlagged: Boolean(q.studentDraft?.isFlagged),
  }));
}

async function syncDraftToBackend() {
  const attemptId = AppState.activeExamTake?.attempt?.id;
  if (!attemptId) return;
  try {
    const res = await apiFetch(`/api/student/attempts/${attemptId}/save`, {
      method: 'PUT',
      body: JSON.stringify({ answers: collectCurrentDraftAnswersPayload() }),
    });
    if (res.expiredOrSubmitted) {
      stopExamCountdown();
      showToast('Thời gian làm bài trên máy chủ đã kết thúc. Chuyển tới trang kết quả!', 'warning');
      navigate(`#/student/result/${attemptId}`);
    }
  } catch {
    // ignore transient network save error
  }
}

async function executeSubmitExam(isAutoSubmitted = false) {
  stopExamCountdown();
  const attemptId = AppState.activeExamTake?.attempt?.id;
  if (!attemptId) return;
  closeModal();

  try {
    await apiFetch(`/api/student/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        isAutoSubmitted,
        answers: collectCurrentDraftAnswersPayload(),
      }),
    });
    showToast(
      isAutoSubmitted
        ? 'Hết giờ! Hệ thống đã tự động nộp bài và chấm điểm hoàn tất.'
        : 'Nộp bài thành công! Hệ thống đã chấm điểm bài thi của bạn.'
    );
    navigate(`#/student/result/${attemptId}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Đối tượng toàn cục gắn với các sự kiện trên giao diện
 */
window.SpaceXApp = {
  navigate,
  closeModal,
  logout,

  showActivityTooltip(text) {
    const banner = document.getElementById('gh-selected-day-banner');
    if (banner) banner.textContent = text;
  },

  togglePasswordField(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (btnEl) btnEl.textContent = '🙈 Ẩn mật khẩu';
    } else {
      input.type = 'password';
      if (btnEl) btnEl.textContent = '👁️ Hiện mật khẩu';
    }
  },

  async submitLogin(e) {
    e.preventDefault();
    const u = document.getElementById('auth-username').value;
    const p = document.getElementById('auth-password').value;
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p }),
      });
      AppState.token = data.token;
      AppState.user = data.user;
      localStorage.setItem('spacex_math_token', data.token);
      localStorage.setItem('spacex_math_user', JSON.stringify(data.user));
      localStorage.setItem('spacex_last_username', data.user.username);
      showToast(`Chào mừng ${data.user.fullName} quay trở lại!`);
      navigate(data.user.role === 'ADMIN' ? '#/admin/dashboard' : '#/student/dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitForgotVerify(e) {
    e.preventDefault();
    const username = document.getElementById('forgot-username').value.trim();
    const vipCode = document.getElementById('forgot-vipcode').value.trim();
    const btn = document.getElementById('forgot-step1-btn');
    if (btn) btn.disabled = true;
    try {
      const data = await apiFetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        body: JSON.stringify({ username, vipCode }),
      });
      AppState.forgotPassword = { username: data.username, vipCode };
      document.getElementById('forgot-verified-name').textContent = `${data.fullName} (@${data.username})`;
      document.getElementById('forgot-step1').classList.add('hidden');
      document.getElementById('forgot-step2').classList.remove('hidden');
      document.getElementById('forgot-newpwd').focus();
      showToast(data.message);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async submitForgotReset(e) {
    e.preventDefault();
    const ctx = AppState.forgotPassword;
    if (!ctx) {
      showToast('Vui lòng xác nhận lại Mã VIP.', 'error');
      navigate('#/forgot-password');
      return;
    }
    const newPassword = document.getElementById('forgot-newpwd').value;
    const confirmPassword = document.getElementById('forgot-confirmpwd').value;
    if (newPassword.trim().length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      showToast('Mật khẩu nhập lại không khớp.', 'error');
      return;
    }
    const btn = document.getElementById('forgot-step2-btn');
    if (btn) btn.disabled = true;
    try {
      const data = await apiFetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({
          username: ctx.username,
          vipCode: ctx.vipCode,
          newPassword,
          confirmPassword,
        }),
      });
      AppState.forgotPassword = null;
      AppState.token = data.token;
      AppState.user = data.user;
      localStorage.setItem('spacex_math_token', data.token);
      localStorage.setItem('spacex_math_user', JSON.stringify(data.user));
      localStorage.setItem('spacex_last_username', data.user.username);
      showToast(data.message);
      navigate('#/student/dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async copyShareLink(hashPath = '#/register') {
    const shareUrl = `${window.location.origin}/${hashPath}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(`Đã sao chép đường link công khai: ${shareUrl}`);
    } catch {
      prompt('Sao chép đường link công khai dưới đây để gửi cho học sinh:', shareUrl);
    }
  },

  async submitRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('reg-fullname').value;
    const username = document.getElementById('reg-username').value;
    const className = document.getElementById('reg-classname').value;
    const nickname = document.getElementById('reg-nickname').value;
    const password = document.getElementById('reg-password').value;
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, username, className, nickname, password }),
      });
      AppState.token = data.token;
      AppState.user = data.user;
      localStorage.setItem('spacex_math_token', data.token);
      localStorage.setItem('spacex_math_user', JSON.stringify(data.user));
      localStorage.setItem('spacex_last_username', data.user.username);
      showToast(`Đăng ký thành công! Tài khoản @${data.user.username} (${data.user.fullName}) đã được lưu.`);
      navigate('#/student/dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openProfileModal() {
    const u = AppState.user || {};
    showModal(`
      <h3 class="text-lg font-bold text-slate-900 mb-4">Cài đặt Tài khoản & Đổi mật khẩu</h3>
      <form onsubmit="window.SpaceXApp.saveOwnProfile(event)" class="space-y-3 pb-5 border-b border-slate-200">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Họ và tên</label>
            <input id="prof-fullname" type="text" value="${u.fullName || ''}" class="input text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Biệt danh (Hiển thị trên Bảng xếp hạng)</label>
            <input id="prof-nickname" type="text" value="${u.nickname || ''}" class="input text-sm" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary text-xs">Lưu thông tin cá nhân</button>
      </form>

      <form onsubmit="window.SpaceXApp.changeOwnPassword(event)" class="space-y-3 pt-4">
        <h4 class="text-sm font-bold text-slate-800">Đổi mật khẩu đăng nhập</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Mật khẩu hiện tại</label>
            <input id="prof-cur-pwd" type="password" required class="input text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới (ít nhất 6 ký tự)</label>
            <input id="prof-new-pwd" type="password" required minlength="6" class="input text-sm" />
          </div>
        </div>
        <button type="submit" class="btn btn-secondary text-xs">Cập nhật mật khẩu</button>
      </form>
    `);
  },

  async saveOwnProfile(e) {
    e.preventDefault();
    try {
      const fullName = document.getElementById('prof-fullname').value;
      const nickname = document.getElementById('prof-nickname').value;
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, nickname }),
      });
      AppState.user = res.user;
      localStorage.setItem('spacex_math_user', JSON.stringify(res.user));
      showToast(res.message);
      closeModal();
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async changeOwnPassword(e) {
    e.preventDefault();
    try {
      const currentPassword = document.getElementById('prof-cur-pwd').value;
      const newPassword = document.getElementById('prof-new-pwd').value;
      const res = await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast(res.message);
      closeModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ---------------- CHỨC NĂNG HỌC SINH ----------------
  applyStudentExamFilter() {
    const ch = document.getElementById('student-filter-chapter')?.value || '';
    const les = document.getElementById('student-filter-lesson')?.value || '';
    const tp = document.getElementById('student-filter-type')?.value || '';
    const qs = new URLSearchParams();
    if (ch) qs.set('chapterId', ch);
    if (les) qs.set('lessonId', les);
    if (tp) qs.set('examType', tp);
    navigate(`#/student/exams${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  openStartExamModal(examId) {
    const durations = [15, 30, 45, 60, 90];
    showModal(`
      <div class="space-y-4">
        <div class="badge badge-info">CHUẨN BỊ LÀM BÀI THI</div>
        <h3 class="text-xl font-bold text-slate-900">Chọn Thời gian Làm bài theo nhu cầu của bạn</h3>
        <p class="text-sm text-slate-600">
          Thời gian được đếm ngược và kiểm soát trực tiếp từ máy chủ Backend. Khi hết giờ, hệ thống sẽ tự động khóa giao diện, nộp bài và chấm điểm.
        </p>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          ${durations
            .map(
              (m) => `
            <label class="cursor-pointer">
              <input type="radio" name="exam_duration_choice" value="${m}" ${
                m === 45 ? 'checked' : ''
              } class="peer sr-only" />
              <div class="p-3.5 rounded-xl border-2 border-slate-200 peer-checked:border-blue-600 peer-checked:bg-blue-50 text-center transition">
                <div class="text-lg font-extrabold text-slate-900">${m} phút</div>
                <div class="text-xs text-slate-500">Đếm ngược</div>
              </div>
            </label>
          `
            )
            .join('')}
          <label class="cursor-pointer">
            <input type="radio" name="exam_duration_choice" value="0" class="peer sr-only" />
            <div class="p-3.5 rounded-xl border-2 border-slate-200 peer-checked:border-blue-600 peer-checked:bg-blue-50 text-center transition">
              <div class="text-lg font-extrabold text-emerald-700">∞ Tự do</div>
              <div class="text-xs text-slate-500">Không giới hạn giờ</div>
            </div>
          </label>
        </div>

        <div class="pt-4 flex items-center justify-end gap-2">
          <button onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary">Hủy</button>
          <button onclick="window.SpaceXApp.startExamNow(${examId})" class="btn btn-primary font-bold">
            🚀 Bắt đầu làm bài ngay
          </button>
        </div>
      </div>
    `);
  },

  async startExamNow(examId) {
    const selectedRadio = document.querySelector('input[name="exam_duration_choice"]:checked');
    const selectedDurationMinutes = selectedRadio ? Number(selectedRadio.value) : 45;
    closeModal();
    try {
      const payload = await apiFetch(`/api/student/exams/${examId}/start`, {
        method: 'POST',
        body: JSON.stringify({ selectedDurationMinutes }),
      });
      navigate(`#/student/exam-take/${payload.attempt.id}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  switchExamQuestion(newIdx) {
    if (!AppState.activeExamTake) return;
    const total = AppState.activeExamTake.questions.length;
    if (newIdx < 0 || newIdx >= total) return;
    AppState.currentQuestionIdx = newIdx;
    const container = document.getElementById('main-view-container');
    if (container) {
      container.innerHTML = renderStudentExamTakeView(AppState.activeExamTake, newIdx);
    }
  },

  selectMultipleChoiceOption(qIdx, optionKey) {
    const q = AppState.activeExamTake?.questions?.[qIdx];
    if (!q) return;
    q.studentDraft = q.studentDraft || {};
    q.studentDraft.selectedOption = optionKey;
    q.studentDraft.isAnswered = true;
    window.SpaceXApp.switchExamQuestion(qIdx);
    syncDraftToBackend();
  },

  selectTrueFalseStatement(qIdx, stmtKey, boolVal) {
    const q = AppState.activeExamTake?.questions?.[qIdx];
    if (!q) return;
    q.studentDraft = q.studentDraft || {};
    q.studentDraft.tfAnswers = q.studentDraft.tfAnswers || {};
    q.studentDraft.tfAnswers[stmtKey] = boolVal;
    q.studentDraft.isAnswered = true;
    window.SpaceXApp.switchExamQuestion(qIdx);
    syncDraftToBackend();
  },

  inputShortAnswer(qIdx, val) {
    const q = AppState.activeExamTake?.questions?.[qIdx];
    if (!q) return;
    q.studentDraft = q.studentDraft || {};
    q.studentDraft.shortAnswer = val;
    q.studentDraft.isAnswered = Boolean(val && String(val).trim().length > 0);
    syncDraftToBackend();
  },

  toggleFlagCurrentQuestion(qIdx) {
    const q = AppState.activeExamTake?.questions?.[qIdx];
    if (!q) return;
    q.studentDraft = q.studentDraft || {};
    q.studentDraft.isFlagged = !q.studentDraft.isFlagged;
    window.SpaceXApp.switchExamQuestion(qIdx);
    syncDraftToBackend();
  },

  confirmSubmitExam() {
    const questions = AppState.activeExamTake?.questions || [];
    const total = questions.length;
    const answered = questions.filter((q) => {
      const d = q.studentDraft || {};
      if (q.questionType === 'MULTIPLE_CHOICE') return Boolean(d.selectedOption);
      if (q.questionType === 'TRUE_FALSE')
        return ['a', 'b', 'c', 'd'].some((k) => d.tfAnswers?.[k] === true || d.tfAnswers?.[k] === false);
      return Boolean(d.shortAnswer && String(d.shortAnswer).trim());
    }).length;

    const unanswered = total - answered;
    showModal(`
      <div class="space-y-4">
        <h3 class="text-xl font-bold text-slate-900">Xác nhận Nộp bài thi</h3>
        <p class="text-sm text-slate-600">
          Bạn đã hoàn thành <strong>${answered} / ${total} câu hỏi</strong>.
          ${
            unanswered > 0
              ? `<span class="text-amber-700 font-semibold">Còn ${unanswered} câu hỏi chưa làm (sẽ được tính 0 điểm nếu bỏ trống).</span>`
              : `<span class="text-emerald-700 font-semibold">Bạn đã trả lời đầy đủ tất cả các câu hỏi!</span>`
          }
        </p>
        <div class="flex justify-end gap-2 pt-3">
          <button onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary">Quay lại kiểm tra</button>
          <button onclick="window.SpaceXApp.submitExamConfirmed()" class="btn btn-primary font-bold">
            ✓ Chắc chắn Nộp bài & Chấm điểm
          </button>
        </div>
      </div>
    `);
  },

  async submitExamConfirmed() {
    await executeSubmitExam(false);
  },

  loadLeaderboardView(periodType) {
    navigate(`#/student/leaderboard?periodType=${periodType}`);
  },

  // ---------------- CHỨC NĂNG QUẢN TRỊ ADMIN ----------------
  searchAdminStudents() {
    const s = document.getElementById('admin-student-search')?.value || '';
    const st = document.getElementById('admin-student-status')?.value || '';
    navigate(`#/admin/students?search=${encodeURIComponent(s)}&status=${encodeURIComponent(st)}`);
  },

  openCreateStudentModal() {
    showModal(`
      <h3 class="text-lg font-bold text-slate-900 mb-4">Tạo tài khoản Học sinh mới</h3>
      <form onsubmit="window.SpaceXApp.createStudentSubmit(event)" class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Họ và tên học sinh</label>
          <input id="adm-st-name" type="text" required placeholder="Ví dụ: Đặng Hoàng Phúc" class="input text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Username đăng nhập</label>
            <input id="adm-st-user" type="text" required placeholder="phuc12a1" class="input text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Lớp</label>
            <input id="adm-st-class" type="text" value="12A1" required class="input text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Mật khẩu khởi tạo (Tối thiểu 6 ký tự)</label>
          <input id="adm-st-pwd" type="password" required minlength="6" placeholder="Nhập mật khẩu" class="input text-sm" />
        </div>
        <div class="pt-3 flex justify-end gap-2">
          <button type="button" onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary text-xs">Hủy</button>
          <button type="submit" class="btn btn-primary text-xs">Tạo tài khoản</button>
        </div>
      </form>
    `);
  },

  async createStudentSubmit(e) {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          fullName: document.getElementById('adm-st-name').value,
          username: document.getElementById('adm-st-user').value,
          className: document.getElementById('adm-st-class').value,
          password: document.getElementById('adm-st-pwd').value,
        }),
      });
      showToast(res.message);
      closeModal();
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async viewStudentDetailModal(studentId) {
    try {
      const { student, attempts, contributionGraph } = await apiFetch(`/api/admin/students/${studentId}`);
      showModal(`
        <div class="space-y-4">
          <div>
            <span class="badge ${student.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${student.status}</span>
            <h3 class="text-xl font-bold text-slate-900 mt-1">${student.full_name} (@${student.username})</h3>
            <p class="text-xs text-slate-500">Lớp: ${student.class_name} • Ngày tạo: ${student.created_at} • Chuỗi học: ${student.streak_days} ngày</p>
          </div>

          ${renderGithubContributionGraphHtml(contributionGraph, 'Biểu đồ Hoạt động của Học sinh')}

          <div>
            <h4 class="text-sm font-bold text-slate-900 mb-2">Lịch sử làm bài (${attempts.length} lượt)</h4>
            ${
              attempts.length === 0
                ? `<p class="text-xs text-slate-500">Học sinh chưa có lượt nộp bài nào.</p>`
                : `<div class="max-h-56 overflow-y-auto space-y-2">
                    ${attempts
                      .map(
                        (a) => `
                      <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <div class="font-bold text-slate-900">${a.exam_title}</div>
                          <div class="text-slate-500">Nộp lúc: ${(a.submitted_at || a.started_at || '').slice(0, 19)} • Đúng ${a.correct_count} / Sai ${a.wrong_count}</div>
                        </div>
                        <div class="font-extrabold text-sm text-blue-600">${a.total_score}/10</div>
                      </div>
                    `
                      )
                      .join('')}
                   </div>`
            }
          </div>
        </div>
      `);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openResetStudentPasswordModal(studentId, username, fullName) {
    showModal(`
      <h3 class="text-lg font-bold text-slate-900 mb-2">Cấp lại Mật khẩu Tạm thời cho Học sinh</h3>
      <p class="text-xs text-slate-500 mb-4">
        Học sinh: <strong>${fullName}</strong> (<code>@${username}</code>). Mật khẩu mới sẽ được mã hóa bảo mật (Scrypt/Argon2).
      </p>
      <form onsubmit="window.SpaceXApp.submitResetStudentPassword(event, ${studentId})" class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Mật khẩu tạm thời mới</label>
          <input id="reset-st-pwd" type="text" value="123456" required minlength="6" class="input text-sm font-mono" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary text-xs">Hủy</button>
          <button type="submit" class="btn btn-primary text-xs">Lưu mật khẩu mới</button>
        </div>
      </form>
    `);
  },

  async submitResetStudentPassword(e, studentId) {
    e.preventDefault();
    try {
      const newPassword = document.getElementById('reset-st-pwd').value;
      const res = await apiFetch(`/api/admin/students/${studentId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      showToast(res.message);
      closeModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async toggleStudentLockStatus(studentId, newStatus) {
    try {
      const res = await apiFetch(`/api/admin/students/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteStudentAccount(studentId, fullName) {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản học sinh "${fullName}" không?`)) return;
    try {
      const res = await apiFetch(`/api/admin/students/${studentId}`, { method: 'DELETE' });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ---------------- KHO MÃ VIP KHÔI PHỤC MẬT KHẨU (ADMIN) ----------------
  async openVipCodesModal() {
    try {
      const data = await apiFetch('/api/admin/vip-codes');
      const codes = data.codes || [];
      const activeCount = codes.filter((c) => c.is_active).length;

      showModal(`
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>🔑</span> Kho Mã VIP Khôi phục Mật khẩu
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Độc quyền dành riêng cho Giáo viên. Cung cấp 1 mã cho học sinh khi các em quên mật khẩu để tự tạo mật khẩu mới.
              </p>
            </div>
            <button
              onclick="window.SpaceXApp.addMoreVipCodes(5)"
              class="btn btn-secondary text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-50 whitespace-nowrap"
            >
              + Sinh thêm 5 mã VIP
            </button>
          </div>

          <div class="flex items-center justify-between text-xs text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
            <div>
              Tổng số mã: <strong>${codes.length} mã</strong> • Đang hoạt động: <strong class="text-emerald-700">${activeCount} mã</strong>
            </div>
            <div class="text-[11px] text-amber-900">
              💡 Bấm <strong>Sao chép</strong> để gửi nhanh mã cho học sinh qua Zalo/Facebook/SMS
            </div>
          </div>

          <div class="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${codes
                .map(
                  (c, idx) => `
                <div class="p-3 rounded-xl border ${
                  c.is_active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'
                } flex flex-col justify-between gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] font-semibold text-slate-400">#${idx + 1}</span>
                    <span class="font-mono text-sm font-extrabold ${
                      c.is_active
                        ? 'text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded'
                        : 'text-slate-500 line-through'
                    }">
                      ${c.code}
                    </span>
                    <span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'} text-[10px] px-1.5 py-0.5">
                      ${c.is_active ? 'Sẵn sàng' : 'Tạm khóa'}
                    </span>
                  </div>

                  <div class="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      Đã dùng: <strong>${c.use_count || 0} lần</strong>
                      ${c.last_used_username ? `(@${c.last_used_username})` : ''}
                    </span>
                    ${
                      c.last_used_at
                        ? `<span class="text-[10px] text-slate-400">${c.last_used_at.slice(0, 16)}</span>`
                        : ''
                    }
                  </div>

                  <div class="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                    <button
                      onclick="window.SpaceXApp.copyVipCode('${c.code}')"
                      class="btn text-xs py-1 px-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold"
                      title="Sao chép mã VIP để gửi cho học sinh"
                    >
                      📋 Sao chép mã
                    </button>
                    <button
                      onclick="window.SpaceXApp.regenerateVipCode(${c.id})"
                      class="btn text-xs py-1 px-2 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      title="Đổi sang mã mới nếu nghi ngờ mã bị lộ"
                    >
                      🔄 Đổi mã
                    </button>
                    <button
                      onclick="window.SpaceXApp.toggleVipCodeActive(${c.id}, ${!c.is_active})"
                      class="btn text-xs py-1 px-2 ${
                        c.is_active
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }"
                      title="${c.is_active ? 'Tạm khóa mã này' : 'Mở khóa mã này'}"
                    >
                      ${c.is_active ? '🔒 Khóa' : '🔓 Mở'}
                    </button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="flex justify-between items-center pt-2 border-t border-slate-200">
            <span class="text-xs text-slate-400">
              Học sinh truy cập: <strong>#/forgot-password</strong>
            </span>
            <button type="button" onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary text-xs font-bold">
              Đóng lại
            </button>
          </div>
        </div>
      `);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async copyVipCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Đã sao chép mã VIP: ${code}`);
    } catch {
      prompt('Mã VIP khôi phục mật khẩu:', code);
    }
  },

  async regenerateVipCode(id) {
    if (!confirm('Bạn có chắc chắn muốn đổi sang mã VIP mới không? Mã cũ sẽ lập tức hết hiệu lực.')) return;
    try {
      const res = await apiFetch(`/api/admin/vip-codes/${id}/regenerate`, { method: 'POST' });
      showToast(res.message);
      this.openVipCodesModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async toggleVipCodeActive(id, newActive) {
    try {
      const res = await apiFetch(`/api/admin/vip-codes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: newActive }),
      });
      showToast(res.message);
      this.openVipCodesModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async addMoreVipCodes(count = 5) {
    try {
      const res = await apiFetch('/api/admin/vip-codes', {
        method: 'POST',
        body: JSON.stringify({ count }),
      });
      showToast(res.message);
      this.openVipCodesModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ---------------- QUẢN LÝ CHƯƠNG & BÀI HỌC ----------------
  openAddChapterModal() {
    const rawSubjects = AppState.curriculum?.rawSubjects || [];
    showModal(`
      <h3 class="text-lg font-bold text-slate-900 mb-4">Thêm Chương học mới</h3>
      <form onsubmit="window.SpaceXApp.submitAddChapter(event)" class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Môn học</label>
          <select id="new-ch-subject" class="input text-sm">
            ${rawSubjects.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Tên Chương</label>
          <input id="new-ch-name" type="text" required placeholder="Ví dụ: Chương 5: Phương trình mặt cầu" class="input text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Mô tả ngắn</label>
          <input id="new-ch-desc" type="text" placeholder="Nội dung trọng tâm của chương" class="input text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Thứ tự hiển thị</label>
          <input id="new-ch-order" type="number" value="5" class="input text-sm" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary text-xs">Hủy</button>
          <button type="submit" class="btn btn-primary text-xs">Lưu Chương mới</button>
        </div>
      </form>
    `);
  },

  async submitAddChapter(e) {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/chapters', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: document.getElementById('new-ch-subject').value,
          name: document.getElementById('new-ch-name').value,
          description: document.getElementById('new-ch-desc').value,
          orderIndex: document.getElementById('new-ch-order').value,
        }),
      });
      showToast(res.message);
      closeModal();
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openAddLessonModal(defaultChapterId = null) {
    const rawChapters = AppState.curriculum?.rawChapters || [];
    showModal(`
      <h3 class="text-lg font-bold text-slate-900 mb-4">Thêm Bài học mới</h3>
      <form onsubmit="window.SpaceXApp.submitAddLesson(event)" class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Thuộc Chương</label>
          <select id="new-les-chapter" class="input text-sm">
            ${rawChapters
              .map(
                (c) =>
                  `<option value="${c.id}" ${defaultChapterId === c.id ? 'selected' : ''}>${c.name}</option>`
              )
              .join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Tên Bài học</label>
          <input id="new-les-name" type="text" required placeholder="Ví dụ: Bài 4: Khảo sát sự biến thiên và vẽ đồ thị hàm số" class="input text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Mô tả bài học</label>
          <input id="new-les-desc" type="text" placeholder="Tóm tắt kiến thức bài học" class="input text-sm" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary text-xs">Hủy</button>
          <button type="submit" class="btn btn-primary text-xs">Lưu Bài học</button>
        </div>
      </form>
    `);
  },

  async submitAddLesson(e) {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/lessons', {
        method: 'POST',
        body: JSON.stringify({
          chapterId: document.getElementById('new-les-chapter').value,
          name: document.getElementById('new-les-name').value,
          description: document.getElementById('new-les-desc').value,
        }),
      });
      showToast(res.message);
      closeModal();
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteChapter(chId, name) {
    if (!confirm(`Xóa chương "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/admin/chapters/${chId}`, { method: 'DELETE' });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteLesson(lId, name) {
    if (!confirm(`Xóa bài học "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/admin/lessons/${lId}`, { method: 'DELETE' });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ---------------- CẤU HÌNH GEMINI AI & UPLOAD PDF TỰ ĐỘNG TẠO ĐỀ ----------------
  jumpToUploadForLesson(chapterId, lessonId) {
    navigate(`#/admin/pdf-upload?chapterId=${chapterId}&lessonId=${lessonId}`);
  },

  onUploadChapterChange(chapterId) {
    const lessonSelect = document.getElementById('upload-lesson-id');
    if (!lessonSelect) return;
    const rawLessons = AppState.curriculum?.rawLessons || [];
    const filtered = rawLessons.filter((l) => Number(l.chapter_id) === Number(chapterId));
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
    lessonSelect.innerHTML =
      `<option value="">-- Chọn Phần / Tiết học --</option>` +
      groups
        .map(
          (grp) =>
            `<optgroup label="${grp.groupName.replace(/"/g, '&quot;')}">${grp.items
              .map((l) => `<option value="${l.id}">${l.name}</option>`)
              .join('')}</optgroup>`
        )
        .join('');
  },

  onEditExamChapterChange(chapterId) {
    const lessonSelect = document.getElementById('edit-exam-lesson');
    if (!lessonSelect) return;
    const rawLessons = AppState.curriculum?.rawLessons || [];
    const filtered = rawLessons.filter((l) => Number(l.chapter_id) === Number(chapterId));
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
    lessonSelect.innerHTML =
      `<option value="">-- Chọn Phần / Tiết học --</option>` +
      groups
        .map(
          (grp) =>
            `<optgroup label="${grp.groupName.replace(/"/g, '&quot;')}">${grp.items
              .map((l) => `<option value="${l.id}">${l.name}</option>`)
              .join('')}</optgroup>`
        )
        .join('');
  },

  toggleAiConfigPanel() {
    const el = document.getElementById('ai-config-Collapse');
    if (el) el.classList.toggle('hidden');
  },

  async saveAiConfig() {
    const keyInput = document.getElementById('cfg-gemini-key')?.value || '';
    const modelInput = document.getElementById('cfg-gemini-model')?.value || 'gemini-2.5-pro';
    try {
      const res = await apiFetch('/api/admin/ai/config', {
        method: 'PUT',
        body: JSON.stringify({
          geminiApiKey: keyInput ? keyInput : '__KEEP__',
          geminiModel: modelInput,
        }),
      });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  handlePdfFileSelected(inputEl) {
    const file = inputEl.files?.[0];
    if (!file) return;
    AppState.selectedPdfExtractedText = '';
    const reader = new FileReader();
    reader.onload = async () => {
      AppState.selectedPdfBase64 = reader.result;
      AppState.selectedPdfName = file.name;
      const lbl = document.getElementById('selected-pdf-label');
      if (lbl) {
        lbl.innerHTML = `<span class="text-emerald-700">✓ Đã chọn file: ${file.name} (${Math.max(
          1,
          Math.round(file.size / 1024)
        )} KB)</span>`;
      }
      const titleInput = document.getElementById('upload-exam-title');
      if (titleInput && !titleInput.value) {
        titleInput.value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
      }

      // Hỗ trợ trích xuất lớp văn bản phía trình duyệt bằng Mozilla PDF.js (nếu có)
      if (window.pdfjsLib) {
        try {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const pageTexts = [];
          for (let p = 1; p <= pdfDoc.numPages; p++) {
            const page = await pdfDoc.getPage(p);
            const textContent = await page.getTextContent();
            const strings = textContent.items.map((item) => item.str || '');
            pageTexts.push(`--- PAGE ${p} ---\n` + strings.join(' '));
          }
          AppState.selectedPdfExtractedText = pageTexts.join('\n\n').trim();
        } catch {
          // Bỏ qua nếu PDF không có lớp text hoặc offline
        }
      }
    };
    reader.readAsDataURL(file);
  },

  async reparseExamFromPdf(examId) {
    try {
      showToast('⏳ Đang phân tích lại file PDF gốc và trích xuất câu hỏi + hình vẽ + bảng đáp án...');
      const res = await apiFetch(`/api/admin/exams/${examId}/reparse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      showToast(res.message || `Đã trích xuất thành công ${res.exam?.questions?.length || 0} câu hỏi!`);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async loadSamplePdfIntoUploader(pdfId, fileName) {
    try {
      showToast(`Đang nạp file PDF mẫu "${fileName}"...`);
      const res = await fetch(`/api/storage/pdfs/${pdfId}/download`);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        AppState.selectedPdfBase64 = reader.result;
        AppState.selectedPdfName = fileName;
        const lbl = document.getElementById('selected-pdf-label');
        if (lbl) {
          lbl.innerHTML = `<span class="text-emerald-700">✓ Đã nạp file PDF mẫu: ${fileName} (${Math.max(
            1,
            Math.round(blob.size / 1024)
          )} KB) — Nhấn nút Bắt đầu Phân tích bên dưới!</span>`;
        }
        const titleInput = document.getElementById('upload-exam-title');
        if (titleInput) {
          titleInput.value = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async executePdfUploadAndAiParse() {
    if (!AppState.selectedPdfBase64) {
      showToast('Vui lòng chọn một file PDF từ máy tính (hoặc nhấn chọn file PDF mẫu) trước khi phân tích!', 'error');
      return;
    }

    const btn = document.getElementById('btn-start-ai-parse');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Đang gửi PDF tới Gemini AI Engine & Trích xuất câu hỏi...';
    }

    // Hiệu ứng cập nhật tiến trình 10 bước trực quan
    const highlightStep = (stepNum) => {
      for (let i = 1; i <= 10; i++) {
        const el = document.getElementById(`ai-step-item-${i}`);
        if (!el) continue;
        if (i < stepNum) {
          el.className =
            'p-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold flex items-center gap-2.5';
        } else if (i === stepNum) {
          el.className =
            'p-2.5 rounded-lg border-2 border-blue-600 bg-blue-50 text-blue-950 font-bold flex items-center gap-2.5 shadow-sm';
        }
      }
    };

    try {
      highlightStep(1);
      await new Promise((r) => setTimeout(r, 250));
      highlightStep(3);
      await new Promise((r) => setTimeout(r, 250));
      highlightStep(6);

      const payload = {
        pdfBase64: AppState.selectedPdfBase64,
        fileName: AppState.selectedPdfName || 'De_Thi_Toan_12.pdf',
        clientExtractedText: AppState.selectedPdfExtractedText || '',
        title: document.getElementById('upload-exam-title')?.value || '',
        subjectId: document.getElementById('upload-subject-id')?.value || 1,
        examType: document.getElementById('upload-exam-type')?.value || 'EXAM',
        chapterId: document.getElementById('upload-chapter-id')?.value || null,
        lessonId: document.getElementById('upload-lesson-id')?.value || null,
        defaultDurationMinutes: document.getElementById('upload-duration')?.value || 45,
        allowUnlimitedTime: document.getElementById('upload-unlimited')?.checked ?? true,
        allowReview: document.getElementById('upload-allow-review')?.checked ?? true,
      };

      const res = await apiFetch('/api/admin/pdfs/upload-and-parse', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      highlightStep(10);
      AppState.selectedPdfBase64 = null;
      AppState.selectedPdfName = '';

      showToast(
        `Chuyển đổi thành công ${res.exam.questions.length} câu hỏi! Đang mở Bản xem trước (AI Review Studio)...`
      );
      navigate(`#/admin/exam-detail/${res.exam.id}`);
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🚀 Bắt đầu Phân tích PDF & Tự động Tạo Đề thi bằng AI';
      }
    }
  },

  // ---------------- QUẢN LÝ FILE PDF GỐC ----------------
  openLinkPdfExamsModal(pdfId) {
    const exams = AppState.allExamsCache || [];
    showModal(`
      <h3 class="text-lg font-bold text-slate-900 mb-2">Gắn Tài liệu PDF gốc với các Bộ bài tập / Đề thi</h3>
      <p class="text-xs text-slate-500 mb-4">
        Bạn có thể gắn một file PDF gốc với nhiều bộ bài tập hoặc đề kiểm tra khác nhau.
      </p>
      <div class="space-y-2 max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-3">
        ${exams
          .map(
            (ex) => `
          <label class="flex items-center gap-2.5 p-2 rounded hover:bg-slate-50 text-sm cursor-pointer">
            <input type="checkbox" name="link_pdf_exam_cb" value="${ex.id}" ${
              ex.pdf_document_id === pdfId ? 'checked' : ''
            } />
            <span class="font-medium text-slate-800">${ex.title}</span>
          </label>
        `
          )
          .join('')}
      </div>
      <div class="flex justify-end gap-2 pt-4">
        <button onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary text-xs">Hủy</button>
        <button onclick="window.SpaceXApp.saveLinkPdfExams(${pdfId})" class="btn btn-primary text-xs">
          💾 Lưu liên kết PDF
        </button>
      </div>
    `);
  },

  async saveLinkPdfExams(pdfId) {
    const checked = Array.from(document.querySelectorAll('input[name="link_pdf_exam_cb"]:checked')).map((el) =>
      Number(el.value)
    );
    try {
      const res = await apiFetch(`/api/admin/pdfs/${pdfId}`, {
        method: 'PUT',
        body: JSON.stringify({ linkedExamIds: checked }),
      });
      showToast(res.message);
      closeModal();
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  triggerReplacePdf(pdfId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await apiFetch(`/api/admin/pdfs/${pdfId}`, {
            method: 'PUT',
            body: JSON.stringify({
              fileName: file.name,
              newPdfBase64: reader.result,
            }),
          });
          showToast(res.message);
          handleRouteChange();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  async deletePdfDocument(pdfId, title) {
    if (!confirm(`Xóa file PDF gốc "${title}"?`)) return;
    try {
      const res = await apiFetch(`/api/admin/pdfs/${pdfId}`, { method: 'DELETE' });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ---------------- QUẢN LÝ ĐỀ THI & CÂU HỎI ----------------
  async saveExamMetadata(examId) {
    try {
      const res = await apiFetch(`/api/admin/exams/${examId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: document.getElementById('edit-exam-title').value,
          chapterId: document.getElementById('edit-exam-chapter').value,
          lessonId: document.getElementById('edit-exam-lesson').value || null,
          examType: document.getElementById('edit-exam-type').value,
          defaultDurationMinutes: document.getElementById('edit-exam-duration').value,
          allowUnlimitedTime: document.getElementById('edit-exam-unlimited').checked,
          allowReview: document.getElementById('edit-exam-review').checked,
        }),
      });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async publishExamStatus(examId, newStatus) {
    try {
      const res = await apiFetch(`/api/admin/exams/${examId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteExam(examId, title) {
    if (!confirm(`Bạn có chắc chắn muốn xóa đề thi "${title}" không?`)) return;
    try {
      const res = await apiFetch(`/api/admin/exams/${examId}`, { method: 'DELETE' });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async moveQuestionOrder(examId, currentIdx, direction) {
    const questions = AppState.currentAdminExamDetail?.questions || [];
    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const ids = questions.map((q) => q.id);
    const temp = ids[currentIdx];
    ids[currentIdx] = ids[targetIdx];
    ids[targetIdx] = temp;

    try {
      await apiFetch(`/api/admin/exams/${examId}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ questionIds: ids }),
      });
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openEditQuestionModal(questionId) {
    const questions = AppState.currentAdminExamDetail?.questions || [];
    const q = questions.find((item) => item.id === Number(questionId));
    if (!q) return;

    const isMC = q.questionType === 'MULTIPLE_CHOICE';
    const isTF = q.questionType === 'TRUE_FALSE';
    const isSA = q.questionType === 'SHORT_ANSWER';

    showModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-900">
            Chỉnh sửa & Xác nhận Câu ${q.questionNumber} (${q.questionType})
          </h3>
          ${
            q.needsReview
              ? `<span class="badge badge-danger">Đang chờ duyệt (NEEDS_REVIEW)</span>`
              : `<span class="badge badge-success">Đã xác nhận (verified)</span>`
          }
        </div>

        <form onsubmit="window.SpaceXApp.saveEditedQuestionSubmit(event, ${q.id}, '${q.questionType}')" class="space-y-3">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Số thứ tự câu</label>
              <input id="eq-num" type="number" value="${q.questionNumber}" class="input text-xs" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Số điểm</label>
              <input id="eq-points" type="number" step="0.05" value="${q.points}" class="input text-xs" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Trang nguồn PDF</label>
              <input id="eq-page" type="number" value="${q.sourcePage || 1}" class="input text-xs" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Nội dung câu hỏi (Hỗ trợ công thức LaTeX $...$)</label>
            <textarea id="eq-content" rows="3" class="input text-sm font-mono" required>${q.content}</textarea>
          </div>

          <!-- Đính kèm / Cập nhật hình ảnh minh họa cho câu hỏi -->
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs text-slate-600">
              🖼️ Hình ảnh / Đồ thị câu hỏi:
              <input id="eq-image-url" type="text" value="${q.imageUrl || ''}" placeholder="URL ảnh hoặc tải ảnh cắt từ máy tính" class="input text-xs mt-1" />
            </div>
            <div>
              <input id="eq-image-file" type="file" accept="image/*" class="hidden" onchange="window.SpaceXApp.uploadQuestionImageFile(this)" />
              <button type="button" onclick="document.getElementById('eq-image-file').click()" class="btn btn-secondary text-xs">
                📤 Tải ảnh đồ thị lên
              </button>
            </div>
          </div>

          ${
            isMC
              ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${['A', 'B', 'C', 'D']
                .map(
                  (k) => `
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Phương án ${k}</label>
                  <input id="eq-opt-${k}" type="text" value="${q.options?.[k] || ''}" required class="input text-xs font-mono" />
                </div>
              `
                )
                .join('')}
            </div>
            <div>
              <label class="block text-xs font-bold text-emerald-700 mb-1">Đáp án chính xác (A, B, C hoặc D)</label>
              <select id="eq-correct-mc" class="input text-sm font-bold text-emerald-800" required>
                <option value="">-- Chọn đáp án đúng --</option>
                ${['A', 'B', 'C', 'D']
                  .map(
                    (k) =>
                      `<option value="${k}" ${q.correctAnswer === k ? 'selected' : ''}>Phương án ${k}</option>`
                  )
                  .join('')}
              </select>
            </div>
          `
              : ''
          }

          ${
            isTF
              ? `
            <div class="space-y-2">
              <div class="text-xs font-bold text-slate-700">Nội dung & Đáp án 4 mệnh đề a, b, c, d:</div>
              ${['a', 'b', 'c', 'd']
                .map((k) => {
                  const st = q.statements?.[k] || {};
                  return `
                    <div class="grid grid-cols-12 gap-2 items-center">
                      <div class="col-span-9">
                        <input id="eq-tf-content-${k}" type="text" value="${st.content || ''}" placeholder="Mệnh đề ${k})" class="input text-xs font-mono" required />
                      </div>
                      <div class="col-span-3">
                        <select id="eq-tf-ans-${k}" class="input text-xs font-bold">
                          <option value="true" ${st.correct === true ? 'selected' : ''}>Đúng</option>
                          <option value="false" ${st.correct === false ? 'selected' : ''}>Sai</option>
                        </select>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
              : ''
          }

          ${
            isSA
              ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-emerald-700 mb-1">Đáp án chuẩn</label>
                <input id="eq-sa-val" type="text" value="${q.correctAnswer || ''}" required placeholder="Ví dụ: 24 hoặc 0.5" class="input text-sm font-bold" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Các cách viết tương đương (cách nhau dấu phẩy)</label>
                <input id="eq-sa-eq" type="text" value="${(q.equivalentAnswers || []).join(', ')}" placeholder="0.5, 0,5, 1/2" class="input text-xs font-mono" />
              </div>
            </div>
          `
              : ''
          }

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Lời giải chi tiết (Hỗ trợ LaTeX)</label>
            <textarea id="eq-explanation" rows="2" class="input text-xs font-mono">${q.explanation || ''}</textarea>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary text-xs">Hủy</button>
            <button type="submit" class="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
              ✓ Lưu & Xác nhận câu hỏi (Verified)
            </button>
          </div>
        </form>
      </div>
    `);
  },

  uploadQuestionImageFile(inputEl) {
    const file = inputEl.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch('/api/admin/figures/upload', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: reader.result, prefix: 'q_fig' }),
        });
        const urlInput = document.getElementById('eq-image-url');
        if (urlInput) urlInput.value = res.imageUrl;
        showToast('Đã tải hình ảnh đồ thị lên thành công!');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  },

  async saveEditedQuestionSubmit(e, questionId, qType) {
    e.preventDefault();
    const payload = {
      questionNumber: document.getElementById('eq-num').value,
      points: document.getElementById('eq-points').value,
      sourcePage: document.getElementById('eq-page').value,
      content: document.getElementById('eq-content').value,
      imageUrl: document.getElementById('eq-image-url').value || null,
      explanation: document.getElementById('eq-explanation').value,
      questionType: qType,
      markVerified: true,
    };

    if (qType === 'MULTIPLE_CHOICE') {
      payload.options = {
        A: document.getElementById('eq-opt-A').value,
        B: document.getElementById('eq-opt-B').value,
        C: document.getElementById('eq-opt-C').value,
        D: document.getElementById('eq-opt-D').value,
      };
      payload.correctAnswer = document.getElementById('eq-correct-mc').value;
      if (!payload.correctAnswer) {
        showToast('Vui lòng chọn đáp án đúng (A, B, C hoặc D)!', 'error');
        return;
      }
    } else if (qType === 'TRUE_FALSE') {
      payload.statements = {};
      payload.correctAnswer = {};
      for (const k of ['a', 'b', 'c', 'd']) {
        const cText = document.getElementById(`eq-tf-content-${k}`).value;
        const cBool = document.getElementById(`eq-tf-ans-${k}`).value === 'true';
        payload.statements[k] = { content: cText, correct: cBool };
        payload.correctAnswer[k] = cBool;
      }
    } else {
      payload.correctAnswer = document.getElementById('eq-sa-val').value;
      payload.equivalentAnswers = document.getElementById('eq-sa-eq').value;
    }

    try {
      const res = await apiFetch(`/api/admin/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast(res.message);
      closeModal();
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openAddQuestionModal(examId) {
    showModal(`
      <h3 class="text-lg font-bold text-slate-900 mb-3">Thêm Câu hỏi mới vào Đề thi</h3>
      <form onsubmit="window.SpaceXApp.submitNewQuestion(event, ${examId})" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Dạng câu hỏi</label>
            <select id="nq-type" class="input text-xs">
              <option value="MULTIPLE_CHOICE">Trắc nghiệm 4 lựa chọn (A, B, C, D)</option>
              <option value="SHORT_ANSWER">Câu hỏi Trả lời ngắn</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Điểm số</label>
            <input id="nq-points" type="number" step="0.25" value="1.0" class="input text-xs" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Nội dung câu hỏi (Hỗ trợ LaTeX $...$)</label>
          <textarea id="nq-content" rows="3" required placeholder="Nhập nội dung câu hỏi..." class="input text-sm font-mono"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input id="nq-opt-A" type="text" placeholder="Phương án A (Nếu trắc nghiệm)" class="input text-xs" />
          <input id="nq-opt-B" type="text" placeholder="Phương án B" class="input text-xs" />
          <input id="nq-opt-C" type="text" placeholder="Phương án C" class="input text-xs" />
          <input id="nq-opt-D" type="text" placeholder="Phương án D" class="input text-xs" />
        </div>
        <div>
          <label class="block text-xs font-bold text-emerald-700 mb-1">Đáp án đúng (A/B/C/D hoặc Giá trị số trả lời ngắn)</label>
          <input id="nq-ans" type="text" required placeholder="Ví dụ: A hoặc 24" class="input text-sm font-bold" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="window.SpaceXApp.closeModal()" class="btn btn-secondary text-xs">Hủy</button>
          <button type="submit" class="btn btn-primary text-xs">Thêm câu hỏi</button>
        </div>
      </form>
    `);
  },

  async submitNewQuestion(e, examId) {
    e.preventDefault();
    const qType = document.getElementById('nq-type').value;
    try {
      const res = await apiFetch('/api/admin/questions', {
        method: 'POST',
        body: JSON.stringify({
          examId,
          questionType: qType,
          points: document.getElementById('nq-points').value,
          content: document.getElementById('nq-content').value,
          options: {
            A: document.getElementById('nq-opt-A').value || 'A',
            B: document.getElementById('nq-opt-B').value || 'B',
            C: document.getElementById('nq-opt-C').value || 'C',
            D: document.getElementById('nq-opt-D').value || 'D',
          },
          correctAnswer: document.getElementById('nq-ans').value,
        }),
      });
      showToast(res.message);
      closeModal();
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteQuestionItem(questionId, qNum) {
    if (!confirm(`Xóa Câu ${qNum} khỏi đề thi?`)) return;
    try {
      const res = await apiFetch(`/api/admin/questions/${questionId}`, { method: 'DELETE' });
      showToast(res.message);
      handleRouteChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async saveLeaderboardSettings() {
    try {
      const enabled = document.getElementById('lb-cfg-enabled')?.checked ?? true;
      const isPublic = document.getElementById('lb-cfg-public')?.checked ?? true;
      const allowNickname = document.getElementById('lb-cfg-nickname')?.checked ?? true;
      const res = await apiFetch('/api/admin/leaderboard/settings', {
        method: 'PUT',
        body: JSON.stringify({ enabled, isPublic, allowNickname }),
      });
      showToast(res.message);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },
};

window.addEventListener('hashchange', handleRouteChange);
window.addEventListener('DOMContentLoaded', handleRouteChange);

