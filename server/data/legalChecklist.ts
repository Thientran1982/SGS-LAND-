export interface LegalCheckItem {
  id: string;
  title: string;
  description: string;
  risk: 'cao' | 'trung_binh' | 'thap';
  required: boolean;
}

export const LEGAL_CHECKLISTS: Record<string, LegalCheckItem[]> = {
  can_ho: [
    {
      id: 'canh_01',
      title: 'Sổ hồng / Giấy chứng nhận quyền sở hữu',
      description:
        'Kiểm tra sổ hồng riêng từng căn hoặc sổ hồng toàn tòa nhà. Xác minh tên chủ sở hữu, số căn, diện tích và tình trạng thế chấp tại văn phòng công chứng.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'canh_02',
      title: 'Quy hoạch & mục đích sử dụng đất',
      description:
        'Tra cứu thông tin quy hoạch 1/500 hoặc 1/2000 của dự án. Đảm bảo đất được quy hoạch đúng mục đích ở/chung cư thương mại, không nằm trong vùng quy hoạch giao thông hay công trình công cộng.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'canh_03',
      title: 'Tình trạng thế chấp / bảo lãnh ngân hàng',
      description:
        'Yêu cầu văn bản bảo lãnh của ngân hàng (theo Luật Kinh doanh BĐS 2023) hoặc xác nhận tòa nhà không đang thế chấp. Kiểm tra tại Sở Tài nguyên – Môi trường.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'canh_04',
      title: 'Tranh chấp pháp lý & khiếu nại',
      description:
        'Tra cứu lịch sử tranh chấp của dự án và chủ đầu tư. Kiểm tra các thông báo từ Sở Xây dựng, cư dân hiện hữu và báo chí về vi phạm xây dựng hoặc chậm bàn giao.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'canh_05',
      title: 'Hợp đồng mua bán & điều khoản phạt',
      description:
        'Đọc kỹ điều khoản phạt chậm bàn giao (tối thiểu 8%/năm theo luật), chính sách hoàn cọc, định nghĩa diện tích thông thủy vs tim tường, phí quản lý và quy định sử dụng.',
      risk: 'trung_binh',
      required: true,
    },
    {
      id: 'canh_06',
      title: 'Nghĩa vụ thuế & phí khi sang tên',
      description:
        'Xác định nghĩa vụ thuế thu nhập cá nhân (2% giá bán) và lệ phí trước bạ (0.5% giá trị). Thỏa thuận rõ ai chịu chi phí này trong hợp đồng.',
      risk: 'trung_binh',
      required: true,
    },
    {
      id: 'canh_07',
      title: 'Phí bảo trì & quỹ bảo trì tòa nhà',
      description:
        'Kiểm tra tỷ lệ phí bảo trì (2% giá trị theo luật), cách thức quản lý quỹ và tình trạng Ban quản trị. Dự án đã bàn giao cần xem xét báo cáo tài chính quỹ bảo trì.',
      risk: 'thap',
      required: false,
    },
  ],

  nha_pho: [
    {
      id: 'nhph_01',
      title: 'Sổ đỏ / Sổ hồng & thông tin thửa đất',
      description:
        'Xác minh sổ đỏ (đất ở) hoặc sổ hồng (gắn với công trình). Kiểm tra diện tích, hình thức sử dụng (lâu dài/có thời hạn), số thửa, tờ bản đồ và không có chú thích thế chấp.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'nhph_02',
      title: 'Quy hoạch đất & lộ giới đường',
      description:
        'Kiểm tra quy hoạch 1/2000 — đặc biệt chú ý lộ giới mở đường (nếu nhà nằm trong quy hoạch mở đường sẽ bị thu hồi bồi thường). Xác nhận mặt tiền đường thực tế so với sổ.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'nhph_03',
      title: 'Giấy phép xây dựng & diện tích sàn',
      description:
        'Yêu cầu giấy phép xây dựng gốc và bản vẽ hoàn công. Kiểm tra số tầng được phép xây, diện tích xây dựng, hệ số sử dụng đất và phần xây dựng có vi phạm không.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'nhph_04',
      title: 'Tranh chấp ranh giới & lối đi',
      description:
        'Xác minh ranh giới thực tế với các thửa đất liền kề. Kiểm tra lối đi chung (nếu nhà hẻm), quyền hạn lối đi và tình trạng tranh chấp với hàng xóm.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'nhph_05',
      title: 'Tình trạng thế chấp & công nợ',
      description:
        'Tra cứu tình trạng thế chấp tại văn phòng đăng ký đất đai. Yêu cầu xác nhận giải chấp từ ngân hàng trước khi ký kết. Kiểm tra thuế đất và phí tồn đọng.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'nhph_06',
      title: 'Thuế chuyển nhượng & lệ phí',
      description:
        'Xác định rõ 2% thuế thu nhập cá nhân (bên bán), 0.5% lệ phí trước bạ (bên mua), phí công chứng và đăng bộ. Ký tại phòng công chứng có thẩm quyền đúng địa bàn.',
      risk: 'trung_binh',
      required: true,
    },
    {
      id: 'nhph_07',
      title: 'Kiểm tra thực địa & tình trạng công trình',
      description:
        'Kiểm tra thực tế chất lượng công trình: nền móng, tường, mái, hệ thống điện nước, thoát nước. Thuê chuyên gia thẩm định kỹ thuật nếu nhà cũ trên 15 năm.',
      risk: 'trung_binh',
      required: false,
    },
  ],

  dat_nen: [
    {
      id: 'datn_01',
      title: 'Sổ đỏ & mục đích sử dụng đất',
      description:
        'Kiểm tra sổ đỏ — mục đích sử dụng phải là "Đất ở tại đô thị" hoặc "Đất ở tại nông thôn". Tuyệt đối không mua đất nông nghiệp (CLN, RSX) chưa được chuyển đổi mục đích.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'datn_02',
      title: 'Quy hoạch phân lô & điều kiện tách thửa',
      description:
        'Xác minh đất nằm trong dự án đã được phê duyệt quy hoạch 1/500. Kiểm tra điều kiện tách thửa, diện tích tối thiểu theo quy định địa phương (thường 36-80m² tùy quận).',
      risk: 'cao',
      required: true,
    },
    {
      id: 'datn_03',
      title: 'Hạ tầng kỹ thuật & nghiệm thu',
      description:
        'Kiểm tra dự án đã hoàn thiện hạ tầng (điện, nước, đường) và được Sở Xây dựng nghiệm thu chưa. Dự án chưa có hạ tầng đồng bộ là vi phạm Luật Kinh doanh BĐS 2023.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'datn_04',
      title: 'Nghĩa vụ tài chính của chủ đầu tư',
      description:
        'Xác minh chủ đầu tư đã hoàn thành nghĩa vụ tài chính với Nhà nước (tiền sử dụng đất). Dự án chưa nộp tiền sử dụng đất sẽ không thể cấp sổ hồng cho khách hàng.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'datn_05',
      title: 'Tình trạng thế chấp dự án',
      description:
        'Kiểm tra dự án/thửa đất có đang thế chấp tại ngân hàng không. Yêu cầu văn bản giải chấp hoặc bảo lãnh ngân hàng trước khi đặt cọc.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'datn_06',
      title: 'Hợp đồng đặt cọc & tiến độ thanh toán',
      description:
        'Cọc không quá 10% giá trị theo luật. Hợp đồng cần ghi rõ thời hạn ký HĐMB, điều kiện hoàn cọc gấp đôi nếu chủ đầu tư vi phạm, và tiến độ ra sổ hồng.',
      risk: 'trung_binh',
      required: true,
    },
    {
      id: 'datn_07',
      title: 'Tra cứu lịch sử dự án & uy tín CĐT',
      description:
        'Tìm hiểu lịch sử pháp lý của dự án: đã từng bị đình chỉ, khiếu nại không? Kiểm tra uy tín chủ đầu tư qua các dự án đã bàn giao trước đây.',
      risk: 'trung_binh',
      required: false,
    },
  ],

  biet_thu: [
    {
      id: 'biet_01',
      title: 'Sổ đỏ & quyền sở hữu công trình',
      description:
        'Kiểm tra sổ đỏ đất ở, giấy chứng nhận quyền sở hữu nhà (nếu có). Xác minh diện tích đất, diện tích sàn xây dựng và tình trạng không tranh chấp.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'biet_02',
      title: 'Quy hoạch khu biệt thự & mật độ xây dựng',
      description:
        'Kiểm tra quy hoạch 1/500 dự án biệt thự: mật độ xây dựng cho phép, số tầng tối đa, khoảng lùi. Các dự án biệt thự thường có quy định nghiêm ngặt về kiến trúc đồng bộ.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'biet_03',
      title: 'Giấy phép xây dựng & hoàn công',
      description:
        'Yêu cầu giấy phép xây dựng và biên bản hoàn công. Kiểm tra toàn bộ công trình đã được nghiệm thu đúng giấy phép, không có cải tạo trái phép ảnh hưởng kết cấu.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'biet_04',
      title: 'Tình trạng thế chấp & nợ phí',
      description:
        'Tra cứu tình trạng thế chấp tại văn phòng đăng ký đất đai. Kiểm tra nợ phí quản lý, tiện ích, bảo trì chưa thanh toán — người mua có thể bị kế thừa nghĩa vụ này.',
      risk: 'cao',
      required: true,
    },
    {
      id: 'biet_05',
      title: 'Hạ tầng & dịch vụ khu dân cư',
      description:
        'Kiểm tra tình trạng thực tế đường nội bộ, điện, nước, thoát nước, chiếu sáng. Tìm hiểu đơn vị quản lý, phí dịch vụ và chất lượng quản lý khu dân cư.',
      risk: 'trung_binh',
      required: true,
    },
    {
      id: 'biet_06',
      title: 'Thẩm định kết cấu & chất lượng xây dựng',
      description:
        'Thuê chuyên gia thẩm định kỹ thuật độc lập kiểm tra nền móng, hệ thống PCCC, điện, nước, chống thấm. Đặc biệt quan trọng với biệt thự xây trên 10 năm.',
      risk: 'trung_binh',
      required: false,
    },
    {
      id: 'biet_07',
      title: 'Quy định cộng đồng & quyền sử dụng tiện ích',
      description:
        'Đọc kỹ nội quy khu dân cư: quyền sử dụng hồ bơi, clubhouse, sân golf (nếu có), quy định cải tạo nội thất, nuôi thú cưng và cho thuê lại.',
      risk: 'thap',
      required: false,
    },
  ],
};

export function getLegalChecklist(propertyType: string): LegalCheckItem[] {
  const normalized = propertyType.toLowerCase().replace(/\s+/g, '_');
  if (normalized.includes('can_ho') || normalized.includes('chung_cu') || normalized.includes('căn hộ')) {
    return LEGAL_CHECKLISTS.can_ho;
  }
  if (normalized.includes('nha_pho') || normalized.includes('nhà phố') || normalized.includes('nhà riêng')) {
    return LEGAL_CHECKLISTS.nha_pho;
  }
  if (normalized.includes('dat_nen') || normalized.includes('đất nền') || normalized.includes('đất')) {
    return LEGAL_CHECKLISTS.dat_nen;
  }
  if (normalized.includes('biet_thu') || normalized.includes('biệt thự')) {
    return LEGAL_CHECKLISTS.biet_thu;
  }
  return LEGAL_CHECKLISTS.can_ho;
}
