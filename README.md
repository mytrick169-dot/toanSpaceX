# 🚀 SPACE X MATH – AI-POWERED EXAM & LEARNING PLATFORM

Nền tảng học tập và luyện thi Toán THPT trực tuyến ứng dụng Trí tuệ Nhân tạo (**Google Gemini API**), cho phép Giáo viên chỉ cần upload file PDF chứa đề bài và đáp án để hệ thống tự động nhận diện câu hỏi, công thức Toán học (LaTeX), bảng biến thiên/đồ thị và đáp án thành đề thi trực tuyến.

---

## 1. Cách khởi chạy Hệ thống

Yêu cầu: **Node.js >= 22.5 (Đang chạy trên Node.js v24.13.1)**. Không cần cài đặt dịch vụ phụ thuộc bên ngoài phức tạp.

```bash
# Khởi chạy ứng dụng tại http://localhost:3000
npm run dev

# Hoặc chạy bộ kiểm thử tự động toàn diện (E2E Verification Suite)
npm test
```

Sau khi chạy `npm run dev`, truy cập: **`http://localhost:3000`**

### Tài khoản mặc định để đăng nhập kiểm thử:
| Vai trò | Username | Password | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Giáo viên / Admin** | `admin` | `admin123` | Toàn quyền quản trị, Upload PDF AI, Quản lý học sinh, Đề thi, Thống kê |
| **Học sinh mẫu** | `hocsinh1` | `123456` | Học sinh lớp 12A1 (Nguyễn Văn An) – Đã có dữ liệu chuỗi học tập & lịch sử thi |
| **Học sinh khác** | `hocsinh2` .. `hocsinh5` | `123456` | Dữ liệu học sinh trên Bảng xếp hạng |

---

## 2. Cấu hình Gemini AI Engine (`.env`)

Mọi cấu hình AI được quản lý tập trung tại file [`.env`](file:///c:/Users/ADMIN/webAItoan12/.env) và module [`src/backend/config/env.mjs`](file:///c:/Users/ADMIN/webAItoan12/src/backend/config/env.mjs) (Tuyệt đối không lộ API Key ra Frontend):

```env
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-2.5-pro
GEMINI_FALLBACK_MODEL=gemini-2.5-flash
GEMINI_REQUESTED_TARGET=gemini-4-argon
```

- **Thông báo kỹ thuật minh bạch về Gemini 4**:
  - Thế hệ Gemini 4 có mã định danh `gemini-4-argon` (Gemini 4 Argon). Tuy nhiên trên cổng REST API công khai (`generativelanguage.googleapis.com`) cho API Key tiêu chuẩn, model chính thức ổn định nhất hỗ trợ xử lý tài liệu PDF Multimodal (`application/pdf`) hiện tại là **`gemini-2.5-pro`** và **`gemini-2.5-flash`** (cùng **`gemini-3.1-pro-preview`**).
  - Bạn có thể đổi `GEMINI_MODEL` trực tiếp trong file `.env` hoặc ngay trên giao diện **Admin → Upload PDF & AI Tạo đề → Cấu hình Gemini API Key & Model**.
  - Hỗ trợ xử lý PDF dung lượng lớn thông qua **Google Gemini Files API** (`upload/v1beta/files`), cơ chế **Retry** (Exponential Backoff), **Rate Limiting** và **Audit Logging** (`logs/gemini-ai.log` & bảng `ai_processing_logs`).
- **Cổng an toàn `NEEDS_REVIEW`**:
  - Nếu một câu hỏi trong PDF bị khuyết đáp án hoặc độ tin cậy thấp (`confidence < 0.85`), hệ thống tự động đánh dấu `NEEDS_REVIEW` và **chặn không cho phép xuất bản đề thi (`PUBLISHED`)** cho đến khi Giáo viên kiểm tra và nhấn xác nhận (`verified`).

