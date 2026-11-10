import { getDb } from './database.mjs';
import { hashPassword } from '../services/authService.mjs';
import { ensureStorageDirs } from '../services/storageService.mjs';

/**
 * Toàn bộ Cấu trúc Chương trình Toán 12 (12 Chương / Chuyên đề lớn & 148 Phần / Tiết học)
 * theo đúng sơ đồ lộ trình giảng dạy của Giáo viên.
 */
export const TOAN_12_CURRICULUM_DATA = [
  {
    name: 'CHƯƠNG I. ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ CỦA HÀM SỐ',
    description: 'Tính đơn điệu, Cực trị, GTLN-GTNN, Ứng dụng thực tiễn, Đường tiệm cận và Đồ thị hàm số',
    groups: [
      {
        groupName: 'HƯỚNG DẪN CÁCH HỌC',
        items: ['HƯỚNG DẪN HỌC 2009'],
      },
      {
        groupName: '[BÀI 1] TÍNH ĐƠN ĐIỆU CỦA HÀM SỐ',
        items: [
          '[TIẾT 1] Tìm khoảng Đồng biến, Nghịch biến',
          '[TIẾT 2] Các bài toán thực tế tính đơn điệu',
          'LUYỆN TẬP TRẮC NGHIỆM ĐÚNG SAI',
          '[TIẾT 3] Biện luận tính đơn điệu của hàm số (Buổi 1)',
          'Biện luận tính đơn điệu của hàm số (Buổi 2)',
          'Biện luận tính đơn điệu của hàm số (Buổi 3)',
          'TỔNG ÔN TÍNH ĐƠN ĐIỆU HÀM SỐ',
        ],
      },
      {
        groupName: '[BÀI 2] CỰC TRỊ HÀM SỐ',
        items: [
          '[TIẾT 1] Xác định cực trị (Cực đại, cực tiểu)',
          '[TIẾT 2] Khảo sát hàm số Mũ, Logarit, Lượng giác',
          'LUYỆN TẬP DẠNG BÀI “ĐÚNG SAI - TRẢ LỜI NGẮN”',
          'LUYỆN TẬP THÊM CỰC TRỊ HÀM SỐ',
          '[TIẾT 3] Biện luận cực trị hàm số Bậc 3',
          '[TIẾT 4] Biện luận cực trị hàm số bậc 2 trên bậc 1',
        ],
      },
      {
        groupName: '[BÀI 3] GTLN - GTNN CỦA HÀM SỐ',
        items: [
          '[TIẾT 1] Tìm GTLN, GTNN của hàm số trên đoạn',
          '[TIẾT 2] Tìm GTLN, GTNN của hàm số trên khoảng, đặt ẩn phụ',
          'LUYỆN TẬP DẠNG BÀI “ĐÚNG SAI” GTLN - GTNN CỦA HÀM SỐ',
          '[TIẾT 3] Tìm m để hàm số đạt GTLN, GTNN',
        ],
      },
      {
        groupName: '[BÀI 4] ỨNG DỤNG THỰC TIỄN CỦA ĐẠO HÀM',
        items: [
          '[TIẾT 1]: Ứng dụng đạo hàm tìm GTLN, GTNN - Bài toán liên quan đến thực tế',
          'BẤM MÁY TÍNH FX580 GIẢI ĐẠO HÀM',
          '[TIẾT 2]: Ứng dụng đạo hàm tìm GTLN, GTNN - Khối đa diện',
          '[TIẾT 3]: Ứng dụng đạo hàm tìm GTLN, GTNN - Khối tròn xoay',
          '[TIẾT 4]: Các bài toán tối ưu lợi nhuận',
          '[TIẾT 5]: Bài toán tăng giảm giá (Hàm cầu)',
          'LUYỆN TẬP TRẮC NGHIỆM BÀI TOÁN THỰC TẾ',
          'LUYỆN TẬP THÊM ĐÚNG SAI BÀI TOÁN THỰC TẾ KHÁC',
        ],
      },
      {
        groupName: '[BÀI 5] ĐƯỜNG TIỆM CẬN',
        items: [
          '[TIẾT 1] Xác định đường tiệm cận đứng, đường tiệm cận ngang',
          '[TIẾT 2] Biện luận đường tiệm cận đứng, tiệm cận ngang',
          '[TIẾT 3] Tiệm cận xiên',
        ],
      },
      {
        groupName: '[BÀI 6] ĐỒ THỊ HÀM SỐ',
        items: [
          '[TIẾT 1] KHẢO SÁT ĐỒ THỊ HÀM SỐ BẬC 3',
          '[TIẾT 2] KHẢO SÁT ĐỒ THỊ HÀM SỐ PHÂN THỨC BẬC NHẤT/BẬC NHẤT',
          '[TIẾT 3] KHẢO SÁT ĐỒ THỊ PHÂN THỨC BẬC 2 TRÊN BẬC 1',
          '[TIẾT 4] BÀI TOÁN THỰC TẾ ĐỒ THỊ',
          '[TIẾT 5] CÁC DẠNG ĐỒ THỊ HÀM SỐ ĐẶC BIỆT',
          '[TIẾT 6] ĐẾM SỐ NGHIỆM & BIỆN LUẬN PHƯƠNG TRÌNH DỰA VÀO ĐỒ THỊ',
          '[TIẾT 7] CÁC BÀI TOÁN TÌM M HÀM BẬC 3, PHÂN THỨC',
        ],
      },
      {
        groupName: 'ÔN TẬP TỔNG HỢP DẠNG CÂU ĐÚNG SAI',
        items: [
          'LUYỆN TẬP DẠNG BÀI "ĐÚNG SAI" ĐỒ THỊ HÀM SỐ',
          'LUYỆN TẬP DẠNG BÀI "ĐÚNG SAI" TƯƠNG GIAO ĐỒ THỊ',
          'LUYỆN TẬP ĐÚNG SAI HÀM SỐ BẬC 3 - HÀM PHÂN THỨC BẬC NHẤT',
          'LUYỆN TẬP ĐÚNG SAI HÀM PHÂN THỨC BẬC HAI TRÊN BẬC NHẤT',
        ],
      },
    ],
  },
  {
    name: 'THÍ SINH THI ĐGNL NÊN HỌC THÊM CÁC DẠNG BÀI SAU',
    description: 'Đơn điệu hàm hợp, Cực trị hàm hợp, Min-Max hàm hợp, Tương giao hàm hợp & Hàm trị tuyệt đối',
    groups: [
      {
        groupName: '[BÀI 1] ĐƠN ĐIỆU HÀM HỢP',
        items: [
          '[TIẾT 1] Tính đơn điệu của hàm hợp (Phần 1)',
          'Tính đơn điệu của hàm hợp (Phần 2)',
          '[TIẾT 2] Biện luận đơn điệu hàm hợp',
          '[TIẾT 3] Luyện tập thêm',
        ],
      },
      {
        groupName: '[BÀI 2] CỰC TRỊ HÀM HỢP',
        items: [
          '[TIẾT 1] Cực trị hàm hợp (Buổi 1)',
          'Cực trị hàm hợp (Buổi 2)',
          '[TIẾT 2] Luyện tập thêm',
        ],
      },
      {
        groupName: '[BÀI 3] MIN MAX HÀM HỢP',
        items: ['Minmax hàm hợp'],
      },
      {
        groupName: '[BÀI 4] TƯƠNG GIAO HÀM HỢP',
        items: [
          'Tiết 1: Đếm số nghiệm hàm hợp',
          'Tiết 2: Biện luận số nghiệm hàm hợp',
          'Tiết 3: Phương pháp ghép trục',
          'Tiết 4: Luyện tập thêm',
        ],
      },
      {
        groupName: '[BÀI 5] CỰC TRỊ HÀM SỐ CHỨA DẤU GIÁ TRỊ TUYỆT ĐỐI',
        items: ['Tiết 1: Cực trị hàm y=|f(x)|', 'Tiết 2: Cực trị hàm y=f(|x|)'],
      },
      {
        groupName: '[BÀI 6] MIN-MAX HÀM SỐ CHỨA DẤU GIÁ TRỊ TUYỆT ĐỐI',
        items: ['MIN-MAX HÀM SỐ CHỨA DẤU GIÁ TRỊ TUYỆT ĐỐI'],
      },
    ],
  },
  {
    name: 'CHƯƠNG II. VECTƠ VÀ HỆ TOẠ ĐỘ TRONG KHÔNG GIAN',
    description: 'Các phép toán vectơ, Góc & Tích vô hướng 2 vectơ, Công thức tọa độ Oxyz và Ứng dụng thực tế',
    groups: [
      {
        groupName: '[BÀI 1] CÁC PHÉP TOÁN VECTƠ TRONG KHÔNG GIAN',
        items: [
          'KHÁI NIỆM VÀ QUY TẮC VECTƠ TRONG KHÔNG GIAN',
          'PHÉP TOÁN VECTƠ TRONG HÌNH HỘP, LĂNG TRỤ',
          'LUYỆN TẬP THÊM',
          'BÀI TOÁN THỰC TẾ TỔNG HỢP LỰC',
        ],
      },
      {
        groupName: '[BÀI 2] GÓC GIỮA 2 VECTƠ - TÍCH VÔ HƯỚNG 2 VECTƠ',
        items: [
          'GÓC GIỮA 2 VECTƠ - TÍCH VÔ HƯỚNG 2 VECTƠ',
          'ĐỀ LUYỆN TẬP (CẤU TRÚC MỚI): GÓC GIỮA 2 VECTƠ - TÍCH VÔ HƯỚNG 2 VECTƠ',
        ],
      },
      {
        groupName: '[BÀI 3] CÔNG THỨC TỌA ĐỘ VECTƠ TRONG KHÔNG GIAN',
        items: [
          '[TIẾT 1] TỌA ĐỘ ĐIỂM - CÁC CÔNG THỨC VECTƠ',
          '[TIẾT 2] TÌM ĐIỂM THỎA MÃN ĐẲNG THỨC VECTƠ',
          '[TIẾT 3] TÍCH CÓ HƯỚNG CỦA VECTƠ VÀ ỨNG DỤNG',
          'HƯỚNG DẪN BẤM MÁY TÍNH TÍCH CÓ HƯỚNG',
          'HƯỚNG DẪN BẤM MÁY TÍNH TỌA ĐỘ VECTƠ TRONG KHÔNG GIAN (OXYZ)',
        ],
      },
      {
        groupName: '[BÀI 4] ỨNG DỤNG THỰC TẾ GẮN HỆ TRỤC OXYZ',
        items: [
          '[TIẾT 1] BÀI TOÁN THỰC TẾ XÁC ĐỊNH TỌA ĐỘ ĐIỂM TRONG KHÔNG GIAN',
          '[TIẾT 2] BÀI TOÁN THỰC TẾ XÁC ĐỊNH TỌA ĐỘ ĐIỂM TRONG KHÔNG GIAN',
          '[TIẾT 3] BÀI TOÁN THỰC TẾ XÁC ĐỊNH TỌA ĐỘ ĐIỂM TRONG KHÔNG GIAN',
        ],
      },
    ],
  },
  {
    name: 'ÔN TẬP GIỮA HỌC KÌ I',
    description: 'Hệ thống 12 Đề thi Ôn tập Giữa Học kì 1 Toán 12',
    groups: [
      {
        groupName: 'ÔN TẬP GIỮA HỌC KÌ I',
        items: Array.from({ length: 12 }, (_, i) => `ĐỀ THI GIỮA HỌC KÌ 1 - ĐỀ SỐ ${i + 1}`),
      },
    ],
  },
  {
    name: 'CHƯƠNG III. MẪU SỐ LIỆU GHÉP NHÓM',
    description: 'Khoảng tứ phân vị, Khoảng biến thiên, Phương sai, Độ lệch chuẩn và Ứng dụng thực tế',
    groups: [
      {
        groupName: '[BÀI 1] KHOẢNG TỨ PHÂN VỊ, KHOẢNG BIẾN THIÊN',
        items: ['KHOẢNG TỨ PHÂN VỊ - KHOẢNG BIẾN THIÊN'],
      },
      {
        groupName: '[BÀI 2] PHƯƠNG SAI VÀ ĐỘ LỆCH CHUẨN',
        items: ['TÍNH SỐ TRUNG BÌNH, PHƯƠNG SAI VÀ ĐỘ LỆCH CHUẨN'],
      },
      {
        groupName: '[BÀI 3] ÔN TẬP THỐNG KÊ L12 - ỨNG DỤNG THỰC TẾ',
        items: ['ÔN TẬP THỐNG KÊ L12 - ỨNG DỤNG THỰC TẾ'],
      },
    ],
  },
  {
    name: 'ÔN TẬP CUỐI HỌC KÌ I',
    description: 'Hệ thống 19 Đề thi Ôn tập Cuối Học kì 1 Toán 12',
    groups: [
      {
        groupName: 'ÔN TẬP CUỐI HỌC KÌ I',
        items: Array.from({ length: 19 }, (_, i) => `ĐỀ THI CUỐI HỌC KÌ 1 - ĐỀ SỐ ${i + 1}`),
      },
    ],
  },
  {
    name: 'CHƯƠNG IV. NGUYÊN HÀM. TÍCH PHÂN',
    description: 'Nguyên hàm, Tích phân và Ứng dụng Tích phân tính diện tích, thể tích, bài toán chuyển động',
    groups: [
      {
        groupName: '[BÀI 1] NGUYÊN HÀM',
        items: [
          '[TIẾT 1]: NGUYÊN HÀM CƠ BẢN',
          '[TIẾT 2]: NGUYÊN HÀM HÀM HỢP',
          '[TIẾT 3]: NGUYÊN HÀM HỮU TỈ',
          '[TIẾT 4]: NGUYÊN HÀM LƯỢNG GIÁC',
          'HƯỚNG DẪN BẤM MÁY TÍNH NGUYÊN HÀM',
          'LUYỆN TẬP THÊM NGUYÊN HÀM',
        ],
      },
      {
        groupName: '[BÀI 2] TÍCH PHÂN',
        items: ['TÍNH TÍCH PHÂN', 'HƯỚNG DẪN BẤM MÁY TÍNH TÍCH PHÂN', 'LUYỆN TẬP THÊM TÍCH PHÂN'],
      },
      {
        groupName: '[BÀI 3] ỨNG DỤNG TÍCH PHÂN',
        items: [
          '[TIẾT 1]: ỨNG DỤNG NGUYÊN HÀM GIẢI BÀI HÀM TỐC ĐỘ',
          '[TIẾT 2]: ỨNG DỤNG CƠ HỌC - BÀI TOÁN CHUYỂN ĐỘNG',
          'BÀI TOÁN CHUYỂN ĐỘNG - DẠNG BÀI ĐÚNG SAI',
          'LUYỆN TẬP THÊM: BÀI TOÁN CHUYỂN ĐỘNG & BÀI HÀM TỐC ĐỘ - DẠNG BÀI ĐÚNG SAI',
          '[TIẾT 3]: ỨNG DỤNG TÍCH PHÂN TÍNH DIỆN TÍCH (KHÔNG CÓ HÌNH VẼ)',
          '[TIẾT 4]: ỨNG DỤNG TÍCH PHÂN TÍNH DIỆN TÍCH (CÓ HÌNH VẼ ĐỒ THỊ)',
          '[TIẾT 5]: BÀI TOÁN THỰC TẾ TÍNH DIỆN TÍCH',
          '[TIẾT 6]: TÍNH THỂ TÍCH KHỐI TRÒN XOAY (KHÔNG CÓ HÌNH VẼ)',
          '[TIẾT 7]: TÍNH THỂ TÍCH KHỐI TRÒN XOAY (CÓ HÌNH VẼ ĐỒ THỊ)',
          'LUYỆN TẬP THÊM: ỨNG DỤNG HÌNH HỌC CỦA TÍCH PHÂN - DẠNG BÀI ĐÚNG SAI',
          '[TIẾT 8]: TÍNH THỂ TÍCH KHỐI TRÒN XOAY QUANH TRỤC TUNG',
          'LUYỆN TẬP THÊM: TỔNG ÔN TẬP NGUYÊN HÀM - TÍCH PHÂN',
          '[TIẾT 9] TÍNH THỂ TÍCH THIẾT DIỆN VUÔNG GÓC VỚI TRỤC HOÀNH',
        ],
      },
    ],
  },
  {
    name: 'CHƯƠNG V. PHƯƠNG TRÌNH MẶT PHẲNG, ĐƯỜNG THẲNG, MẶT CẦU TRONG KHÔNG GIAN',
    description: 'Phương trình mặt phẳng, Phương trình đường thẳng, Phương trình mặt cầu, Điểm và Hệ trục Oxyz',
    groups: [
      {
        groupName: '[BÀI 1] PHƯƠNG TRÌNH MẶT PHẲNG',
        items: [
          '[TIẾT 1]: XÁC ĐỊNH CÁC YẾU TỐ, TÍNH GÓC & TÌM VỊ TRÍ TƯƠNG ĐỐI',
          '[TIẾT 2]: LẬP PHƯƠNG TRÌNH KHI BIẾT VECTƠ PHÁP TUYẾN & ĐIỂM',
          '[TIẾT 3]: LẬP PHƯƠNG TRÌNH CÓ YẾU TỐ KHOẢNG CÁCH',
          'LUYỆN TẬP THÊM PHƯƠNG TRÌNH MẶT PHẲNG',
          '[TIẾT 4] CÁC BÀI TOÁN ỨNG DỤNG THỰC TẾ MẶT PHẲNG',
        ],
      },
      {
        groupName: '[BÀI 2] PHƯƠNG TRÌNH ĐƯỜNG THẲNG',
        items: [
          '[TIẾT 1]: XÁC ĐỊNH CÁC YẾU TỐ, TÌM VỊ TRÍ TƯƠNG ĐỐI, TÍNH KHOẢNG CÁCH',
          '[TIẾT 2]: LẬP PHƯƠNG TRÌNH KHI BIẾT VECTƠ CHỈ PHƯƠNG & ĐIỂM',
          '[TIẾT 3]: LẬP PHƯƠNG TRÌNH CÓ YẾU TỐ GIAO ĐIỂM',
          'LUYỆN TẬP THÊM PHƯƠNG TRÌNH ĐƯỜNG THẲNG',
          '[TIẾT 4]: TÌM ĐIỂM THUỘC ĐƯỜNG THẲNG',
          '[TIẾT 5]: BÀI TOÁN THỰC TẾ CHUYỂN ĐỘNG THẲNG – DẠNG BÀI ĐÚNG SAI',
        ],
      },
      {
        groupName: '[BÀI 3] PHƯƠNG TRÌNH MẶT CẦU',
        items: [
          '[TIẾT 1]: XÁC ĐỊNH CÁC YẾU TỐ, LẬP PHƯƠNG TRÌNH MẶT CẦU',
          '[TIẾT 2]: BÀI TOÁN VỊ TRÍ TƯƠNG ĐỐI TRONG MẶT CẦU',
          '[TIẾT 3]: ÔN TẬP PHƯƠNG TRÌNH MẶT CẦU - DẠNG BÀI ĐÚNG SAI',
          '[TIẾT 4]: ỨNG DỤNG THỰC TẾ MẶT CẦU',
          '[TIẾT 5]: BÀI TOÁN THỰC TẾ MẶT CẦU - DẠNG BÀI ĐÚNG SAI',
        ],
      },
      {
        groupName: '[BÀI 4] ĐIỂM TRONG KHÔNG GIAN',
        items: [
          '[TIẾT 1]: TÌM HÌNH CHIẾU & ĐIỂM ĐỐI XỨNG',
          '[TIẾT 2]: BÀI TOÁN MINMAX LIÊN QUAN ĐẾN HÌNH CHIẾU CỦA ĐIỂM',
          '[TIẾT 3]: ĐIỂM & ĐƯỜNG ĐẶC BIỆT TRONG TAM GIÁC',
        ],
      },
      {
        groupName: '[BÀI 5] BÀI TOÁN GẮN HỆ TRỤC OXYZ',
        items: [
          'PHẦN 1: BÀI TOÁN TÍNH GÓC',
          'PHẦN 2: BÀI TOÁN TÍNH KHOẢNG CÁCH',
          'PHẦN 3: GẮN HỆ TRỤC VÀO HÌNH LĂNG TRỤ XIÊN, HÌNH HỘP',
        ],
      },
    ],
  },
  {
    name: 'ÔN TẬP GIỮA HỌC KÌ II',
    description: 'Hệ thống 14 Đề thi Ôn tập Giữa Học kì 2 Toán 12',
    groups: [
      {
        groupName: 'ÔN TẬP GIỮA HỌC KÌ II',
        items: Array.from({ length: 14 }, (_, i) => `ĐỀ SỐ ${i + 1}`),
      },
    ],
  },
  {
    name: 'CHƯƠNG VI. XÁC SUẤT CÓ ĐIỀU KIỆN',
    description: 'Xác suất có điều kiện, Công thức xác suất toàn phần, Công thức Bayes và Sơ đồ hình cây',
    groups: [
      {
        groupName: '[BÀI MỞ ĐẦU]',
        items: ['ÔN TẬP XÁC SUẤT LỚP 11'],
      },
      {
        groupName: '[BÀI 1] XÁC SUẤT CÓ ĐIỀU KIỆN',
        items: [
          '[TIẾT 1]: CÔNG THỨC TÍNH XÁC SUẤT CÓ ĐIỀU KIỆN',
          '[TIẾT 2]: TÍNH XÁC SUẤT KHI BIẾT TRƯỚC XÁC SUẤT THÀNH PHẦN',
          '[TIẾT 3]: TÍNH XÁC SUẤT CÓ ĐIỀU KIỆN THEO CÔNG THỨC CỔ ĐIỂN',
          '[TIẾT 4]: TÍNH XÁC SUẤT CÓ ĐIỀU KIỆN - BÀI TOÁN ĐẾM HAI LẦN LIÊN TIẾP',
          '[TIẾT 5]: TÍNH XÁC SUẤT CÓ ĐIỀU KIỆN - BÀI TOÁN CHUYỂN BI HAI HỘP',
        ],
      },
      {
        groupName: '[BÀI 2] CÔNG THỨC XÁC SUẤT TOÀN PHẦN. CÔNG THỨC BAYES',
        items: ['[TIẾT 1]: CÔNG THỨC XÁC SUẤT TOÀN PHẦN', '[TIẾT 2]: CÔNG THỨC BAYES'],
      },
      {
        groupName: '[BÀI 3] SƠ ĐỒ HÌNH CÂY',
        items: ['LUYỆN TẬP SƠ ĐỒ HÌNH CÂY (PHẦN 1)', 'LUYỆN TẬP SƠ ĐỒ HÌNH CÂY (PHẦN 2)'],
      },
      {
        groupName: '[BÀI 4] LUYỆN TẬP THÊM',
        items: [
          'LUYỆN TẬP XÁC SUẤT CÓ ĐIỀU KIỆN (BUỔI 1)',
          'LUYỆN TẬP XÁC SUẤT CÓ ĐIỀU KIỆN (BUỔI 2)',
        ],
      },
    ],
  },
  {
    name: 'ÔN TẬP CUỐI HỌC KÌ II',
    description: 'Hệ thống 6 Đề thi Ôn tập Cuối Học kì 2 Toán 12',
    groups: [
      {
        groupName: 'ÔN TẬP CUỐI HỌC KÌ II',
        items: Array.from({ length: 6 }, (_, i) => `ĐỀ THI CUỐI HỌC KÌ 2 - ĐỀ SỐ ${i + 1}`),
      },
    ],
  },
  {
    name: 'MỘT SỐ CHUYÊN ĐỀ ĐÁNG CHÚ Ý TRONG ĐỀ THI THPTQG',
    description: 'Cấp số cộng, Cấp số nhân, Phương trình lượng giác, Đường đi tối ưu, Quy hoạch tuyến tính & Lãi suất',
    groups: [
      {
        groupName: '[BÀI 1] CẤP SỐ CỘNG',
        items: ['CẤP SỐ CỘNG'],
      },
      {
        groupName: '[BÀI 2] CẤP SỐ NHÂN',
        items: ['CẤP SỐ NHÂN'],
      },
      {
        groupName: '[BÀI 3] PHƯƠNG TRÌNH LƯỢNG GIÁC CƠ BẢN',
        items: ['PHƯƠNG TRÌNH LƯỢNG GIÁC CƠ BẢN'],
      },
      {
        groupName: '[BÀI 4] BÀI TOÁN TÌM ĐƯỜNG ĐI TỐI ƯU',
        items: ['BÀI TOÁN TÌM ĐƯỜNG ĐI TỐI ƯU'],
      },
      {
        groupName: '[BÀI 5] BÀI TOÁN QUY HOẠCH TUYẾN TÍNH',
        items: ['BÀI TOÁN QUY HOẠCH TUYẾN TÍNH'],
      },
      {
        groupName: '[BÀI 6] CHUYÊN ĐỀ TIỀN TỆ & LÃI SUẤT',
        items: [
          'PHẦN 1: BÀI TOÁN LÃI KÉP - GỬI TIỀN MỘT LẦN',
          'PHẦN 2: BÀI TOÁN LÃI KÉP - GỬI TIỀN ĐỀU ĐẶN & VAY TIỀN-TRẢ NỢ',
        ],
      },
    ],
  },
];

/**
 * Khởi tạo dữ liệu nền tảng chuẩn (Tài khoản Admin mặc định + Cấu trúc 12 Chương/Chuyên đề Toán 12)
 */
export function ensureSeedData() {
  const db = getDb();
  ensureStorageDirs();

  // 1. Đảm bảo có tài khoản Giáo viên Quản trị (Admin)
  const adminExisting = db.prepare('SELECT id FROM users WHERE role_id = 1 LIMIT 1').get();
  if (!adminExisting) {
    const adminHash = hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'admin123');
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, nickname, class_name, role_id, status)
      VALUES ('admin', ?, 'Giáo viên Quản trị', 'Giáo viên', 'GV-THPT', 1, 'ACTIVE')
    `).run(adminHash);
  }

  // 2. Đảm bảo cây chương trình Toán 12 chuẩn 12 Chương / Chuyên đề & 186 Phần học đã được nạp
  const chCount = db.prepare('SELECT COUNT(*) as c FROM chapters').get().c;
  const lessonCount = db.prepare('SELECT COUNT(*) as c FROM lessons').get().c;
  if (chCount < 12 || lessonCount < 180) {
    rebuildToan12Curriculum();
  }
}

/**
 * Nạp lại toàn bộ 12 Chương/Chuyên đề và 148 Phần/Tiết học của Toán 12
 * đồng thời giữ nguyên và gắn lại các đề thi đã upload (như Đề Tích vô hướng 2 vectơ).
 */
export function rebuildToan12Curriculum() {
  const db = getDb();

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('DELETE FROM lessons;');
    db.exec('DELETE FROM chapters;');
    db.exec('DELETE FROM subjects;');

    db.prepare(`
      INSERT INTO subjects (id, name, grade, description, order_index)
      VALUES (1, 'Toán học 12', 12, 'Chương trình Toán lớp 12 THPT & Luyện thi Tốt nghiệp THPT Quốc gia - ĐGNL', 1)
    `).run();

    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, subject_id, name, description, order_index)
      VALUES (?, 1, ?, ?, ?)
    `);

    const insertLesson = db.prepare(`
      INSERT INTO lessons (id, chapter_id, name, description, order_index)
      VALUES (?, ?, ?, ?, ?)
    `);

    let lessonIdCounter = 1;
    let vectorDotProductChapterId = 3;
    let vectorDotProductLessonId = null;

    TOAN_12_CURRICULUM_DATA.forEach((ch, chIdx) => {
      const chapterId = chIdx + 1;
      insertChapter.run(chapterId, ch.name, ch.description, chapterId);

      let orderInChapter = 1;
      for (const grp of ch.groups) {
        for (const itemTitle of grp.items) {
          const currentLessonId = lessonIdCounter++;
          insertLesson.run(
            currentLessonId,
            chapterId,
            itemTitle,
            grp.groupName,
            orderInChapter++
          );

          if (itemTitle === 'GÓC GIỮA 2 VECTƠ - TÍCH VÔ HƯỚNG 2 VECTƠ') {
            vectorDotProductChapterId = chapterId;
            vectorDotProductLessonId = currentLessonId;
          }
        }
      }
    });

    // Gắn đề BTVN Tích vô hướng của 2 vectơ (id = 5) vào đúng bài "[BÀI 2] GÓC GIỮA 2 VECTƠ - TÍCH VÔ HƯỚNG 2 VECTƠ"
    if (vectorDotProductLessonId) {
      db.prepare('UPDATE exams SET subject_id = 1, chapter_id = ?, lesson_id = ? WHERE id = 5').run(
        vectorDotProductChapterId,
        vectorDotProductLessonId
      );
      db.prepare('UPDATE pdf_documents SET subject_id = 1, chapter_id = ?, lesson_id = ? WHERE id = 5').run(
        vectorDotProductChapterId,
        vectorDotProductLessonId
      );
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}
