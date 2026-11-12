/**
 * Cấu trúc Chương trình Toán 11 THPT chuẩn hóa theo 6 bảng phân phối chương trình của Giáo viên
 * Bao gồm 13 Chương / Chuyên đề lớn và đầy đủ các nhóm bài học & tiết học chi tiết.
 */
export const TOAN_11_CURRICULUM_DATA = [
  {
    name: 'CHƯƠNG I: HÀM SỐ LƯỢNG GIÁC VÀ PHƯƠNG TRÌNH LƯỢNG GIÁC',
    description: 'Góc lượng giác, giá trị lượng giác, hàm số lượng giác và phương trình lượng giác cơ bản',
    groups: [
      {
        groupName: '[BÀI 1]: GÓC LƯỢNG GIÁC, GIÁ TRỊ LƯỢNG GIÁC',
        items: [
          '[TIẾT 1] Cung và góc lượng giác',
          '[TIẾT 2] Giá trị lượng giác của góc lượng giác (Phần 1)',
          'Giá trị lượng giác (Phần 2): Công thức nhân đôi, công thức cộng',
          'Giá trị lượng giác (Phần 3): Công thức Tổng → Tích',
          '[TIẾT 3] Giá trị lượng giác của các góc đặc biệt',
          '[TIẾT 4] Bấm máy tính giá trị lượng giác - Rút gọn biểu thức - Kiểm tra công thức',
          '[TIẾT 5] Bài toán thực tế góc lượng giác',
          'BÀI TẬP LÀM THÊM',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: GÓC VÀ GIÁ TRỊ LƯỢNG GIÁC',
        ],
      },
      {
        groupName: '[BÀI 2]: HÀM SỐ LƯỢNG GIÁC',
        items: [
          '[TIẾT 1] Phương trình cơ bản',
          '[TIẾT 2] Tìm Tập xác định và Chu kì',
          '[TIẾT 3] Tập giá trị và Tính chẵn lẻ',
          '[TIẾT 4] Tính biến thiên và Đồ thị',
          '[TIẾT 5] Bấm máy tính Tìm GTLN GTNN - Tính Đơn Điệu - Tìm TXD - Tính Chẵn Lẻ của hàm số',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: HÀM SỐ LƯỢNG GIÁC',
        ],
      },
      {
        groupName: '[BÀI 3]: PHƯƠNG TRÌNH LƯỢNG GIÁC CƠ BẢN',
        items: [
          '[TIẾT 1] Phương trình cơ bản (Buổi 1)',
          '[TIẾT 2] Phương trình cơ bản (Buổi 2)',
          '[TIẾT 3] Biện luận nghiệm phương trình cơ bản',
          '[TIẾT 4] Bấm máy tính: Giải PT lượng giác (Tìm nghiệm + Đếm số nghiệm thuộc đoạn)',
          '[TIẾT 5] BÀI TOÁN THỰC TẾ HÀM SỐ LƯỢNG GIÁC - PHƯƠNG TRÌNH LƯỢNG GIÁC',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: PHƯƠNG TRÌNH LƯỢNG GIÁC',
        ],
      },
      {
        groupName: '[BÀI 4]: ÔN TẬP CHƯƠNG LƯỢNG GIÁC',
        items: [
          '[TIẾT 1] Tổng hợp các kỹ năng bấm máy tính lượng giác',
          '[TIẾT 2] Đề ôn tập các kĩ năng trắc nghiệm',
        ],
      },
      {
        groupName: 'PHẦN THAM KHẢO ( KHÔNG BẮT BUỘC )',
        items: [
          'Phần 1: Phương trình bậc cao một ẩn',
          'Phần 2: Phương trình đẳng cấp sin, cos',
          'Phần 3: Phương trình bậc nhất sin, cos',
          'Phần 4: Phương trình tích',
        ],
      },
    ],
  },
  {
    name: 'CHƯƠNG II: DÃY SỐ. CẤP SỐ CỘNG VÀ CẤP SỐ NHÂN.',
    description: 'Dãy số, Cấp số cộng, Cấp số nhân và bài toán thực tế',
    groups: [
      {
        groupName: '[BÀI 1]: DÃY SỐ',
        items: [
          'DÃY SỐ',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: DÃY SỐ',
        ],
      },
      {
        groupName: '[BÀI 2]: CẤP SỐ CỘNG',
        items: [
          'CẤP SỐ CỘNG',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: CẤP SỐ CỘNG',
        ],
      },
      {
        groupName: '[BÀI 3]: CẤP SỐ NHÂN',
        items: [
          'CẤP SỐ NHÂN',
          'ỨNG DỤNG THỰC TẾ CẤP SỐ NHÂN',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: CẤP SỐ NHÂN',
          'BÀI TẬP ĐIỀN ĐÁP ÁN: TOÁN THỰC TẾ CẤP SỐ NHÂN',
        ],
      },
    ],
  },
  {
    name: 'CHƯƠNG III: CÁC SỐ ĐẶC TRƯNG ĐO XU THẾ TRUNG TÂM CHO MẪU SỐ LIỆU GHÉP NHÓM',
    description: 'Số trung bình, mốt, tứ phân vị cho mẫu số liệu ghép nhóm',
    groups: [
      {
        groupName: 'ÔN TẬP LỚP 10 (CÓ THỂ BỎ QUA)',
        items: [
          'CÁC SỐ ĐẶC TRƯNG ĐO XU THẾ TRUNG TÂM + ĐỘ PHÂN TÁN',
        ],
      },
      {
        groupName: 'LỚP 11: MẪU SỐ LIỆU GHÉP NHÓM',
        items: [
          '[BÀI 1] KHÁI NIỆM - SỐ TRUNG BÌNH - MỐT',
          '[BÀI 2] TỨ PHÂN VỊ',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: MẪU SỐ LIỆU GHÉP NHÓM',
        ],
      },
    ],
  },
  {
    name: 'CHƯƠNG IV: HÌNH KHÔNG GIAN. QUAN HỆ SONG SONG TRONG KHÔNG GIAN',
    description: 'Đường thẳng và mặt phẳng, quan hệ song song trong không gian, phép chiếu song song',
    groups: [
      {
        groupName: '[BÀI 1]: ĐƯỜNG THẲNG VÀ MẶT PHẲNG TRONG KHÔNG GIAN',
        items: [
          'PHẦN 1: TÌM GIAO TUYẾN CỦA HAI MẶT PHẲNG',
          'PHẦN 2: TÌM GIAO ĐIỂM ĐƯỜNG THẲNG VÀ MẶT PHẲNG',
          'PHẦN 3: BÀI TOÁN TÍNH TỈ SỐ ĐOẠN THẲNG',
          'TRẮC NGHIỆM: GIAO TUYẾN - GIAO ĐIỂM - TỈ SỐ',
          'PHẦN 4: LÝ THUYẾT HÌNH KHÔNG GIAN',
          'PHẦN 5: THIẾT DIỆN',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: ĐƯỜNG THẲNG VÀ MẶT PHẲNG',
        ],
      },
      {
        groupName: '[BÀI 2]: HAI ĐƯỜNG THẲNG SONG SONG, ĐƯỜNG THẲNG & MẶT PHẲNG SONG SONG',
        items: [
          'PHẦN 1: CHỨNG MINH SONG SONG',
          'PHẦN 2: GIAO TUYẾN SONG SONG VÀ THIẾT DIỆN',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: ĐƯỜNG THẲNG & MẶT PHẲNG SONG SONG',
        ],
      },
      {
        groupName: '[BÀI 3&4]: HAI MẶT PHẲNG SONG SONG, HÌNH LĂNG TRỤ, HÌNH HỘP',
        items: [
          'HAI MẶT PHẲNG SONG SONG',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: HAI MẶT PHẲNG SONG SONG',
        ],
      },
      {
        groupName: '[BÀI 5] PHÉP CHIẾU SONG SONG',
        items: [
          'PHÉP CHIẾU SONG SONG',
        ],
      },
      {
        groupName: 'ÔN TẬP TRẮC NGHIỆM HÌNH KHÔNG GIAN',
        items: [
          'ÔN TẬP TRẮC NGHIỆM HÌNH KHÔNG GIAN',
          'ĐỀ ÔN TẬP CUỐI HỌC KÌ I HÌNH KHÔNG GIAN',
        ],
      },
    ],
  },
  {
    name: 'ĐỀ ÔN TẬP GIỮA HỌC KÌ I',
    description: 'Hệ thống 10 Đề thi Ôn tập Giữa Học kì I Toán 11',
    groups: [
      {
        groupName: 'ĐỀ ÔN TẬP GIỮA HỌC KÌ I',
        items: Array.from({ length: 10 }, (_, i) => `ĐỀ SỐ ${i + 1}`),
      },
    ],
  },
  {
    name: 'CHƯƠNG V: GIỚI HẠN. HÀM SỐ LIÊN TỤC.',
    description: 'Giới hạn dãy số, giới hạn hàm số và hàm số liên tục',
    groups: [
      {
        groupName: '[BÀI 1]: GIỚI HẠN DÃY SỐ',
        items: [
          'GIỚI HẠN DÃY SỐ',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: GIỚI HẠN DÃY SỐ',
        ],
      },
      {
        groupName: '[BÀI 2]: GIỚI HẠN HÀM SỐ',
        items: [
          'GIỚI HẠN HÀM SỐ (BUỔI 1)',
          'GIỚI HẠN HÀM SỐ (BUỔI 2)',
          'GIỚI HẠN MỘT BÊN',
          'BÀI TẬP TRẮC NGHIỆM ĐÚNG SAI: GIỚI HẠN HÀM SỐ',
        ],
      },
      {
        groupName: 'BẤM MÁY TÍNH GIỚI HẠN',
        items: [
          'BẤM MÁY TÍNH GIỚI HẠN',
        ],
      },
      {
        groupName: '[BÀI 3]: GIỚI HẠN CHỨA THAM SỐ',
        items: [
          'GIỚI HẠN CHỨA THAM SỐ',
          'BÀI TẬP ĐIỀN ĐÁP ÁN: GIỚI HẠN CHỨA THAM SỐ',
        ],
      },
      {
        groupName: '[BÀI 4]: HÀM SỐ LIÊN TỤC',
        items: [
          'HÀM SỐ LIÊN TỤC (BUỔI 1)',
          'HÀM SỐ LIÊN TỤC (BUỔI 2)',
          'BÀI TẬP ĐIỀN ĐÁP ÁN: TOÁN THỰC TẾ HÀM SỐ LIÊN TỤC',
        ],
      },
    ],
  },
  {
    name: 'ĐỀ ÔN TẬP HỌC KÌ I',
    description: 'Hệ thống 13 Đề thi Ôn tập Cuối Học kì I Toán 11 (Cấu trúc mới)',
    groups: [
      {
        groupName: 'ĐỀ ÔN TẬP HỌC KÌ I (CẤU TRÚC MỚI)',
        items: Array.from({ length: 13 }, (_, i) => `ĐỀ SỐ ${i + 1} (CẤU TRÚC MỚI)`),
      },
    ],
  },
  {
    name: 'CHƯƠNG VI: HÀM SỐ MŨ VÀ HÀM SỐ LÔGARIT.',
    description: 'Công thức mũ, logarit, hàm số, phương trình và bất phương trình mũ & logarit',
    groups: [
      {
        groupName: '[BÀI 1]: CÔNG THỨC MŨ',
        items: [
          'CÔNG THỨC MŨ',
        ],
      },
      {
        groupName: '[BÀI 2]: CÔNG THỨC LOGARIT',
        items: [
          'CÔNG THỨC LOGARIT (BUỔI 1)',
          'CÔNG THỨC LOGARIT (BUỔI 2)',
          'BIỂU DIỄN LOGARIT',
        ],
      },
      {
        groupName: '[BÀI 3]: HÀM SỐ MŨ, HÀM SỐ LOGARIT',
        items: [
          'TẬP XÁC ĐỊNH',
          'TÍNH ĐƠN ĐIỆU',
          'ĐỒ THỊ',
        ],
      },
      {
        groupName: '[BÀI 4]: PHƯƠNG TRÌNH, BẤT PHƯƠNG TRÌNH MŨ & LOGARIT',
        items: [
          'GIẢI PHƯƠNG TRÌNH MŨ',
          'GIẢI PHƯƠNG TRÌNH LOGARIT',
          'GIẢI PHƯƠNG TRÌNH THEO NHỮNG PHƯƠNG PHÁP ĐẶC BIỆT',
          'GIẢI BẤT PHƯƠNG TRÌNH MŨ VÀ LOGARIT',
        ],
      },
      {
        groupName: '[BÀI 5]: BIỆN LUẬN PHƯƠNG TRÌNH & BẤT PHƯƠNG TRÌNH',
        items: [
          'BIỆN LUẬN NGHIỆM PHƯƠNG TRÌNH MŨ',
          'BIỆN LUẬN NGHIỆM PHƯƠNG TRÌNH & BẤT PHƯƠNG TRÌNH LOGARIT',
        ],
      },
      {
        groupName: '[BÀI 6]: ỨNG DỤNG MŨ VÀ LOGARIT',
        items: [
          'BÀI TOÁN LÃI SUẤT DẠNG 1',
          'BÀI TOÁN LÃI SUẤT DẠNG 2, DẠNG 3',
          'BÀI TOÁN THỰC TẾ TÌM THỜI GIAN',
          'CÁC BÀI TOÁN THỰC TẾ KHÁC',
        ],
      },
      {
        groupName: 'BẤM MÁY TÍNH MŨ LOGARIT',
        items: [
          'BẤM MÁY TÍNH MŨ LOGARIT (PHẦN 1)',
          'BẤM MÁY TÍNH MŨ LOGARIT (PHẦN 2)',
        ],
      },
    ],
  },
  {
    name: 'CHƯƠNG VII: QUAN HỆ VUÔNG GÓC TRONG KHÔNG GIAN.',
    description: 'Đường thẳng vuông góc mặt phẳng, hai mặt phẳng vuông góc, góc nhị diện, khoảng cách và thể tích khối đa diện',
    groups: [
      {
        groupName: '[BÀI 1]: HAI ĐƯỜNG THẲNG VUÔNG GÓC',
        items: [
          'Góc giữa hai đường thẳng chéo nhau',
        ],
      },
      {
        groupName: '[BÀI 2]: ĐƯỜNG THẲNG VUÔNG GÓC MẶT PHẲNG',
        items: [
          'Đường thẳng vuông góc mặt phẳng',
          'Góc giữa đường thẳng và mặt phẳng',
          'Góc giữa cạnh bên và mặt phẳng bên',
        ],
      },
      {
        groupName: '[BÀI 3]: GÓC NHỊ DIỆN',
        items: [
          'Góc nhị diện',
        ],
      },
      {
        groupName: '[BÀI 4]: HAI MẶT PHẲNG VUÔNG GÓC',
        items: [
          'Định nghĩa & Chứng minh hai mặt phẳng vuông góc',
          'Giới thiệu Hình Lăng trụ đứng, Hình hộp chữ nhật, Lập phương',
          'Góc giữa hai mặt phẳng (Dạng 1)',
          'Góc giữa hai mặt phẳng (Dạng 2)',
        ],
      },
      {
        groupName: '[BÀI 5]: KHOẢNG CÁCH',
        items: [
          'A - KHOẢNG CÁCH TỪ ĐIỂM TỚI MỘT MẶT PHẲNG - Phần 1: Khoảng cách từ điểm tới mặt phẳng chứa đường cao',
          'A - KHOẢNG CÁCH TỪ ĐIỂM TỚI MỘT MẶT PHẲNG - Phần 2: Khoảng cách từ chân đường cao tới mặt phẳng bất kỳ',
          'A - KHOẢNG CÁCH TỪ ĐIỂM TỚI MỘT MẶT PHẲNG - Phần 3: Khoảng cách từ điểm bất kỳ tới mặt phẳng bất kỳ',
          'Luyện tập Khoảng cách từ điểm tới mặt phẳng',
          'B - KHOẢNG CÁCH GIỮA HAI ĐƯỜNG THẲNG CHÉO NHAU - Phần 1: Phương pháp dựng mặt phẳng song song',
          'B - KHOẢNG CÁCH GIỮA HAI ĐƯỜNG THẲNG CHÉO NHAU - Phần 2: Phương pháp dựng mặt phẳng vuông góc',
          'Luyện tập Khoảng cách giữa hai đường thẳng chéo nhau',
        ],
      },
      {
        groupName: '[BÀI 6]: LĂNG TRỤ ĐỨNG, CHÓP ĐỀU, THỂ TÍCH MỘT SỐ HÌNH KHỐI',
        items: [
          'A - THỂ TÍCH HÌNH CHÓP - PHẦN 1: THỂ TÍCH CHÓP CHO CẠNH BÊN VUÔNG ĐÁY',
          'A - THỂ TÍCH HÌNH CHÓP - PHẦN 2: THỂ TÍCH CHÓP ĐỀU',
          'A - THỂ TÍCH HÌNH CHÓP - PHẦN 3: THỂ TÍCH CHÓP CHO MỘT MẶT BÊN VUÔNG ĐÁY',
          'A - THỂ TÍCH HÌNH CHÓP - PHẦN 4: THỂ TÍCH CHÓP CHO TRƯỚC CHIỀU CAO',
          'A - THỂ TÍCH HÌNH CHÓP - PHẦN 5: THỂ TÍCH KHỐI CHÓP CỤT',
          'B - THỂ TÍCH LĂNG TRỤ - PHẦN 1: THỂ TÍCH KHỐI LĂNG TRỤ',
          'B - THỂ TÍCH LĂNG TRỤ - PHẦN 2: THỂ TÍCH KHỐI ĐA DIỆN TRONG LĂNG TRỤ',
        ],
      },
    ],
  },
  {
    name: 'ĐỀ ÔN TẬP GIỮA HỌC KÌ II',
    description: 'Hệ thống 16 Đề thi Ôn tập Giữa Học kì II Toán 11 & Học sớm 12',
    groups: [
      {
        groupName: 'ĐỀ ÔN TẬP GIỮA HỌC KÌ II',
        items: [
          'HỌC SỚM KIẾN THỨC LỚP 12',
          ...Array.from({ length: 16 }, (_, i) => `ĐỀ THI GIỮA HỌC KÌ 2 - ĐỀ ${i + 1}`),
        ],
      },
    ],
  },
  {
    name: 'CHƯƠNG VIII: XÁC SUẤT.',
    description: 'Biến cố, công thức cộng, công thức nhân xác suất và xác suất liệt kê',
    groups: [
      {
        groupName: '[BÀI 0]: ÔN TẬP LỚP 10',
        items: [
          'BIẾN CỐ & XÁC SUẤT CỦA BIẾN CỐ',
        ],
      },
      {
        groupName: '[BÀI 1]: BIẾN CỐ',
        items: [
          'BIẾN CỐ',
        ],
      },
      {
        groupName: '[BÀI 2]: CÔNG THỨC NHÂN XÁC SUẤT',
        items: [
          'CÔNG THỨC NHÂN XÁC SUẤT',
        ],
      },
      {
        groupName: '[BÀI 3]: CÔNG THỨC CỘNG XÁC SUẤT',
        items: [
          'Phần 1: Biến cố ngẫu nhiên',
          'Phần 2: Biến cố xung khắc',
        ],
      },
      {
        groupName: '[BÀI 4]: XÁC SUẤT LIỆT KÊ',
        items: [
          'Bài toán liệt kê gieo xúc xắc và đồng xu',
        ],
      },
    ],
  },
  {
    name: 'CHƯƠNG IX: ĐẠO HÀM.',
    description: 'Định nghĩa, quy tắc tính đạo hàm, đạo hàm cấp hai và phương trình tiếp tuyến',
    groups: [
      {
        groupName: '[BÀI 1]: ĐẠO HÀM THEO ĐỊNH NGHĨA',
        items: [
          'ĐẠO HÀM THEO ĐỊNH NGHĨA',
        ],
      },
      {
        groupName: '[BÀI 2]: CÁC QUY TẮC TÍNH ĐẠO HÀM',
        items: [
          'PHẦN 1: ĐẠO HÀM CƠ BẢN',
          'PHẦN 2: ĐẠO HÀM HÀM HỢP',
          'LUYỆN TẬP ĐẠO HÀM CỦA HÀM HỢP',
          'ĐẠO HÀM HÀM SỐ MŨ & LOGARIT',
        ],
      },
      {
        groupName: '[BÀI 3]: BIỆN LUẬN PT, BPT BẬC 2 CHỨA THAM SỐ',
        items: [
          'BIỆN LUẬN PT, BPT BẬC 2 CHỨA THAM SỐ',
        ],
      },
      {
        groupName: '[BÀI 4]: ĐẠO HÀM CẤP HAI & ỨNG DỤNG',
        items: [
          'ĐẠO HÀM CẤP HAI & ỨNG DỤNG',
        ],
      },
      {
        groupName: 'ÔN TẬP CHƯƠNG ĐẠO HÀM',
        items: [
          'LUYỆN TẬP ĐẠO HÀM CƠ BẢN & HÀM HỢP',
          'LUYỆN TẬP ĐẠO HÀM MŨ & LOGARIT',
        ],
      },
      {
        groupName: '[BÀI 5]: PHƯƠNG TRÌNH TIẾP TUYẾN',
        items: [
          'PHƯƠNG TRÌNH TIẾP TUYẾN TẠI ĐIỂM',
          'PHƯƠNG TRÌNH TIẾP TUYẾN QUA ĐIỂM',
        ],
      },
    ],
  },
  {
    name: 'ĐỀ ÔN TẬP HỌC KÌ II',
    description: 'Hệ thống Đề thi Ôn tập Cuối Học kì II Toán 11 & Luyện tập thêm',
    groups: [
      {
        groupName: 'ĐỀ ÔN TẬP HỌC KÌ II',
        items: [
          'HỌC SỚM KIẾN THỨC LỚP 12',
          'VIDEO ÔN TẬP TỔNG HỢP',
          ...Array.from({ length: 15 }, (_, i) => `ĐỀ THI CUỐI HỌC KÌ 2 - ĐỀ ${i + 1}`),
        ],
      },
      {
        groupName: 'ĐỀ LUYỆN TẬP THÊM',
        items: Array.from({ length: 9 }, (_, i) => `ĐỀ THI CUỐI HỌC KÌ 2 - ĐỀ ${i + 1}`),
      },
    ],
  },
];

