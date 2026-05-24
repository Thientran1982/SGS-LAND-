export interface PropertyProject {
  id: string;
  name: string;
  developer: string;
  district: string;
  city: string;
  type: 'can_ho' | 'nha_pho' | 'dat_nen' | 'biet_thu' | 'shophouse';
  status: 'mo_ban' | 'sap_mo_ban' | 'da_ban_het' | 'dang_xay' | 'ban_giao';
  legalStatus: {
    type: 'so_hong' | 'so_do' | 'hop_dong_mua_ban' | 'chua_co';
    note: string;
  };
  priceRange: { min: number; max: number; unit: 'ty' | 'trieu_m2' };
  paymentPolicy: string[];
  bankPartners: string[];
  handoverDate: string;
  amenities: string[];
  highlights: string[];
}

export const PROPERTY_PROJECTS: PropertyProject[] = [
  {
    id: 'vinhomes-grand-park',
    name: 'Vinhomes Grand Park',
    developer: 'Vinhomes (Vingroup)',
    district: 'TP. Thủ Đức',
    city: 'TP. Hồ Chí Minh',
    type: 'can_ho',
    status: 'mo_ban',
    legalStatus: {
      type: 'so_hong',
      note: 'Sổ hồng riêng từng căn, bàn giao theo từng phân khu',
    },
    priceRange: { min: 2.2, max: 6.5, unit: 'ty' },
    paymentPolicy: [
      'Thanh toán 30% ký hợp đồng',
      'Hỗ trợ vay 70% trong 35 năm',
      'Ân hạn gốc 24 tháng',
      'CK 3-5% thanh toán sớm',
    ],
    bankPartners: ['Vietcombank', 'Techcombank', 'BIDV', 'MB Bank'],
    handoverDate: 'Q2/2025 – Q4/2026 (tùy phân khu)',
    amenities: [
      'Công viên nội khu 36ha',
      'Trường học Vinschool',
      'Bệnh viện Vinmec',
      'Trung tâm thương mại Vincom',
      'Hồ bơi Olympic',
      'Khu thể thao đa năng',
    ],
    highlights: [
      'Quy mô 271ha — đại đô thị lớn nhất TP.HCM',
      'Gần ga Metro Số 1 (Suối Tiên)',
      'Tiện ích nội khu khép kín chuẩn resort',
      'Chủ đầu tư uy tín hàng đầu Việt Nam',
    ],
  },
  {
    id: 'akari-city',
    name: 'Akari City',
    developer: 'Nam Long Group',
    district: 'Bình Tân',
    city: 'TP. Hồ Chí Minh',
    type: 'can_ho',
    status: 'mo_ban',
    legalStatus: {
      type: 'so_hong',
      note: 'Sổ hồng riêng từng căn, pháp lý đầy đủ',
    },
    priceRange: { min: 2.8, max: 5.5, unit: 'ty' },
    paymentPolicy: [
      'Thanh toán 20% ký HĐMB',
      'Vay đến 75% GTCH trong 30 năm',
      'Hỗ trợ lãi suất 0% 18 tháng đầu',
      'CK 2-4% khách hàng thân thiết',
    ],
    bankPartners: ['VPBank', 'Sacombank', 'HDBank', 'OCB'],
    handoverDate: 'Q3/2025 – Q1/2026',
    amenities: [
      'Công viên Nhật Bản nội khu',
      'Hồ bơi ngoài trời và trong nhà',
      'Khu BBQ & vườn trên cao',
      'Trung tâm thương mại AEON (liền kề)',
      'Gym & spa tiêu chuẩn 5 sao',
      'Sân chơi trẻ em',
    ],
    highlights: [
      'Phong cách Nhật Bản — thiết kế tối giản tinh tế',
      'Gần trung tâm thương mại AEON Bình Tân',
      'Kết nối Quốc lộ 1A, đường Hồ Học Lãm',
      'Giá tầm trung, phù hợp ở thực và đầu tư',
    ],
  },
  {
    id: 'the-global-city',
    name: 'The Global City',
    developer: 'Masterise Homes',
    district: 'TP. Thủ Đức',
    city: 'TP. Hồ Chí Minh',
    type: 'can_ho',
    status: 'mo_ban',
    legalStatus: {
      type: 'so_hong',
      note: 'Pháp lý minh bạch, sổ hồng riêng theo từng block',
    },
    priceRange: { min: 4.5, max: 18, unit: 'ty' },
    paymentPolicy: [
      'Thanh toán 15% đặt chỗ',
      'Hỗ trợ vay 70% trong 35 năm',
      'Ân hạn gốc và lãi 24 tháng',
      'CK đến 6% cho khách thiện chí',
    ],
    bankPartners: ['Techcombank', 'Vietcombank', 'Standard Chartered', 'Shinhan'],
    handoverDate: 'Q4/2025 – Q2/2027',
    amenities: [
      'Trung tâm thương mại quốc tế',
      'Văn phòng hạng A',
      'Trường quốc tế TGSV',
      'Bệnh viện quốc tế',
      'Marina & bến du thuyền',
      'Công viên bờ sông 5ha',
    ],
    highlights: [
      'Quy mô 117ha — đô thị phức hợp đẳng cấp quốc tế',
      'Mặt tiền sông Tắc, view sông độc đáo',
      'Gần Vinhomes Grand Park và ga Metro',
      'Tích hợp thương mại, văn phòng, nhà ở',
    ],
  },
  {
    id: 'masteri-centre-point',
    name: 'Masteri Centre Point',
    developer: 'Masterise Homes',
    district: 'TP. Thủ Đức',
    city: 'TP. Hồ Chí Minh',
    type: 'can_ho',
    status: 'ban_giao',
    legalStatus: {
      type: 'so_hong',
      note: 'Đã có sổ hồng, khách hàng nhận sổ đầy đủ',
    },
    priceRange: { min: 3.8, max: 9.5, unit: 'ty' },
    paymentPolicy: [
      'Nhận nhà ngay — thanh toán linh hoạt',
      'Vay ngân hàng đến 80%',
      'Thị trường thứ cấp — thương lượng trực tiếp',
    ],
    bankPartners: ['Techcombank', 'VPBank', 'Vietcombank'],
    handoverDate: 'Đã bàn giao (2023)',
    amenities: [
      'Bể bơi vô cực tầng cao',
      'Phòng gym & yoga hiện đại',
      'Sân thượng skybar',
      'Siêu thị Vinmart',
      'Kết nối trực tiếp ga Metro Bình Thái',
      'Hệ thống an ninh 24/7',
    ],
    highlights: [
      'Đã có sổ hồng — pháp lý hoàn chỉnh nhất',
      'Kết nối trực tiếp ga Metro số 1',
      'Vị trí trung tâm Thủ Đức',
      'Thứ cấp — cơ hội thương lượng giá tốt',
    ],
  },
  {
    id: 'one-verandah',
    name: 'One Verandah',
    developer: 'Mapletree Investments (Singapore)',
    district: 'Quận 2',
    city: 'TP. Hồ Chí Minh',
    type: 'can_ho',
    status: 'ban_giao',
    legalStatus: {
      type: 'so_hong',
      note: 'Đã bàn giao và cấp sổ hồng đầy đủ',
    },
    priceRange: { min: 4.2, max: 12, unit: 'ty' },
    paymentPolicy: [
      'Thị trường thứ cấp — mua bán trực tiếp',
      'Vay ngân hàng đến 75%',
      'Giá thứ cấp thương lượng',
    ],
    bankPartners: ['HSBC', 'Citibank', 'Vietcombank', 'Techcombank'],
    handoverDate: 'Đã bàn giao (2022)',
    amenities: [
      'View sông Giồng Ông Tố panorama',
      'Bể bơi nước mặn trên cao',
      'Clubhouse đẳng cấp Singapore',
      'Sân tennis & khu thể thao',
      'Vườn nhiệt đới nội khu',
      'Concierge 24/7',
    ],
    highlights: [
      'Chủ đầu tư Singapore — chuẩn quốc tế',
      'View sông Sài Gòn tuyệt đẹp',
      'Khu Thảo Điền — an ninh, sầm uất',
      'Cộng đồng cư dân nước ngoài cao cấp',
    ],
  },
];

export function findProjectByKeyword(keyword: string): PropertyProject | undefined {
  const kw = keyword.toLowerCase().trim();
  return PROPERTY_PROJECTS.find(p =>
    p.name.toLowerCase().includes(kw) ||
    p.id.includes(kw.replace(/\s+/g, '-')) ||
    p.developer.toLowerCase().includes(kw) ||
    p.district.toLowerCase().includes(kw),
  );
}

export function findProjectsByDistrict(district: string): PropertyProject[] {
  const d = district.toLowerCase().trim();
  return PROPERTY_PROJECTS.filter(p =>
    p.district.toLowerCase().includes(d),
  );
}
