// Single source of truth for project data.
// Extracted from pages/ProjectDirectory.tsx (ALL_PROJECTS, 17 projects)
// and pages/ProjectLandingPage.tsx (PROJECT_CONFIG + PROJECT_GEO_DATA).
// Edit project data HERE only.

export interface DuAnProject {
    slug: string;
    name: string;
    developer: string;
    location: string;
    province: string;
    scale: string;
    priceRange: string;
    projectType: string;
    typeGroup: string;
    status: string;
    statusColor: 'emerald' | 'indigo' | 'amber';
    img: string;
    description: string;
}
export const ALL_PROJECTS: DuAnProject[] = [
    {
        slug: 'aqua-city',
        name: 'Aqua City Novaland',
        developer: 'Novaland Group',
        location: 'Biên Hòa, Đồng Nai',
        province: 'Đồng Nai',
        scale: '1.000 ha',
        priceRange: 'Nhà phố từ 6 tỷ; biệt thự từ 8,5 tỷ; shophouse từ 10 tỷ',
        projectType: 'Đại Đô Thị Sinh Thái',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang bàn giao',
        statusColor: 'emerald',
        img: '/images/projects/aqua-city.png',
         description: 'Aqua City Novaland có quy mô tham khảo 1.000 ha tại Long Hưng, Biên Hòa. Giá tham khảo từ: nhà phố 6 tỷ, biệt thự 8,5 tỷ, shophouse 10 tỷ; cần xác minh theo sản phẩm và ngày cập nhật.',
    },
    {
        slug: 'the-global-city',
        name: 'The Global City',
        developer: 'Masterise Homes',
        location: 'An Phú, TP Thủ Đức, TP.HCM',
        province: 'TP.HCM',
        scale: '117 ha',
        priceRange: 'Nhà phố từ 15 tỷ',
        projectType: 'Đại Đô Thị Thương Mại',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang mở bán',
        statusColor: 'indigo',
        img: '/images/projects/the-global-city.png',
        description: 'Đại đô thị thương mại – dịch vụ 117ha chuẩn Singapore, cạnh Metro số 1 An Phú. TTTM 200.000m², trường quốc tế, bệnh viện 5 sao.',
    },
    {
        slug: 'izumi-city',
        name: 'Izumi City Nam Long',
        developer: 'Nam Long Group',
        location: 'Biên Hòa, Đồng Nai',
        province: 'Đồng Nai',
        scale: '170 ha',
        priceRange: 'Từ 8,4 tỷ đồng',
        projectType: 'Đô Thị Chuẩn Nhật Bản',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang mở bán',
        statusColor: 'indigo',
        img: '/images/projects/izumi-city.png',
        description: 'Đô thị chuẩn Nhật Bản 170ha với siêu thị Fuji Mart, trường học tiêu chuẩn Nhật, kiến trúc zen. Nam Long track record bàn giao tốt.',
    },
    {
        slug: 'vinhomes-grand-park',
        name: 'Vinhomes Grand Park',
        developer: 'Vinhomes',
        location: 'TP Thủ Đức, TP.HCM',
        province: 'TP.HCM',
        scale: '271 ha',
        priceRange: 'Từ 3 tỷ đồng',
        projectType: 'Siêu Đô Thị Tích Hợp',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang bàn giao',
        statusColor: 'emerald',
        img: '/images/projects/vinhomes-grand-park.png',
        description: 'Siêu đô thị 271ha, công viên 36ha, Metro số 1, Vinmec, Vinschool. Hơn 44 tòa căn hộ hiện đại tại TP Thủ Đức.',
    },
    {
        slug: 'vinhomes-central-park',
        name: 'Vinhomes Central Park',
        developer: 'Vinhomes',
        location: 'Bình Thạnh, TP.HCM',
        province: 'TP.HCM',
        scale: '44 tòa cao tầng',
        priceRange: 'Từ 50 triệu/m²',
        projectType: 'Khu Đô Thị Cao Cấp',
        typeGroup: 'Căn hộ cao cấp',
        status: 'Thứ cấp',
        statusColor: 'emerald',
        img: '/images/projects/vinhomes-grand-park.png',
        description: 'Vinhomes Central Park Bình Thạnh: Landmark 81, bể bơi vô cực ven sông Sài Gòn. Thị trường thứ cấp sổ hồng đầy đủ.',
    },
    {
        slug: 'diamond-sky-van-phuc-city',
        name: 'Diamond Sky – Vạn Phúc City',
        developer: 'Tập đoàn Vạn Phúc',
        location: 'KĐT Vạn Phúc City, Hiệp Bình Phước, TP Thủ Đức',
        province: 'TP.HCM',
        scale: '20 tầng (KĐT 198 ha)',
        priceRange: 'Từ 9,6 tỷ – Từ 190 triệu/m²',
        projectType: 'Căn Hộ Cao Tầng View Sông',
        typeGroup: 'Căn hộ cao cấp',
        status: 'Mở bán 2026',
        statusColor: 'indigo',
        img: '/images/projects/diamond-sky-van-phuc-city.jpg',
        description: 'Tháp căn hộ điểm nhấn 20 tầng trong KĐT Vạn Phúc City 198ha, ven sông Sài Gòn — Hiệp Bình Phước, TP Thủ Đức (giáp Thuận An, Bình Dương). 1–3 PN, view sông, sổ hồng lâu dài.',
    },
    {
        slug: 'manhattan',
        name: 'Grand Manhattan Novaland',
        developer: 'Novaland Group',
        location: 'Nội thành, TP.HCM',
        province: 'TP.HCM',
        scale: 'Căn hộ hạng sang',
        priceRange: 'Từ 120 triệu/m²',
        projectType: 'Căn Hộ Hạng Sang',
        typeGroup: 'Căn hộ cao cấp',
        status: 'Thứ cấp',
        statusColor: 'emerald',
        img: '/images/projects/masterise-homes.png',
        description: 'Grand Manhattan Novaland — căn hộ hạng sang biểu tượng của Novaland tại nội thành TP.HCM, tiện ích 5 sao, penthouse và sky villa.',
    },
    {
        slug: 'thu-thiem',
        name: 'Khu Đô Thị Thủ Thiêm',
        developer: 'Nhiều chủ đầu tư',
        location: 'Thủ Thiêm, TP Thủ Đức, TP.HCM',
        province: 'TP.HCM',
        scale: '657 ha',
        priceRange: 'Từ 80 triệu/m²',
        projectType: 'Trung Tâm Tài Chính',
        typeGroup: 'Biệt thự & nhà phố',
        status: 'Đang phát triển',
        statusColor: 'amber',
        img: '/images/projects/the-global-city.png',
        description: 'Khu đô thị mới Thủ Thiêm 657ha — trung tâm tài chính tương lai TP.HCM. Empire City, Metropole, The River. Thanh khoản cao, tiềm năng lớn.',
    },
    {
        slug: 'son-kim-land',
        name: 'Sơn Kim Land',
        developer: 'Sơn Kim Group',
        location: 'TP.HCM & Hà Nội',
        province: 'TP.HCM',
        scale: 'Đa dự án',
        priceRange: 'Từ 40 triệu/m²',
        projectType: 'BĐS Thương Mại',
        typeGroup: 'Biệt thự & nhà phố',
        status: 'Đang bán',
        statusColor: 'indigo',
        img: '/images/projects/the-global-city.png',
        description: 'Sơn Kim Land: Gem Riverside Q4, Metropole Thủ Thiêm, Seasons Avenue Hà Nội. GEM Center, chuỗi GS25. BĐS thương mại cao cấp.',
    },
    {
        slug: 'nha-pho-trung-tam',
        name: 'Nhà Phố Trung Tâm TP.HCM',
        developer: 'Nhiều chủ sở hữu',
        location: 'Q1, Q3, Bình Thạnh, Phú Nhuận',
        province: 'TP.HCM',
        scale: 'Nhà riêng lẻ',
        priceRange: 'Từ 100 triệu/m²',
        projectType: 'Nhà Phố Mặt Tiền',
        typeGroup: 'Biệt thự & nhà phố',
        status: 'Thứ cấp',
        statusColor: 'emerald',
        img: '/images/projects/aqua-city.png',
        description: 'Mua bán nhà phố mặt tiền, nhà hẻm và shophouse trung tâm TP.HCM. Định giá AI ±5% miễn phí, kiểm tra pháp lý độc lập trước giao dịch.',
    },
    {
        slug: 'vinhomes-can-gio',
        name: 'Vinhomes Cần Giờ',
        developer: 'Vinhomes',
        location: 'Cần Giờ, TP.HCM',
        province: 'TP.HCM',
        scale: '2.870 ha',
        priceRange: 'Từ 12 tỷ',
        projectType: 'Siêu Đô Thị Lấn Biển',
        typeGroup: 'Đô thị tổng hợp',
        status: 'Đang bán',
        statusColor: 'indigo',
        img: '/images/projects/vinhomes-can-gio.png',
        description: 'Siêu đô thị lấn biển 2.870ha lớn nhất Việt Nam tại Cần Giờ, TP.HCM. Bãi biển nhân tạo 7km, Vinwonders, marina, resort 5 sao, sân golf 18 lỗ.',
    },
    {
        slug: 'sala',
        name: 'Sala Đại Quang Minh',
        developer: 'Đại Quang Minh',
        location: 'An Lợi Đông, TP Thủ Đức, TP.HCM',
        province: 'TP.HCM',
        scale: '257 ha',
        priceRange: 'Từ 80 triệu/m²',
        projectType: 'Khu Đô Thị Ven Sông',
        typeGroup: 'Biệt thự & nhà phố',
        status: 'Thứ cấp',
        statusColor: 'emerald',
        img: '/images/projects/the-global-city.png',
        description: 'KĐT Sala Đại Quang Minh 257ha ven sông Sài Gòn — An Lợi Đông, TP Thủ Đức. Biệt thự, nhà phố shophouse, căn hộ hạng sang. Pháp lý sổ hồng đầy đủ, thanh khoản cao.',
    },
    {
        slug: 'eco-retreat-long-an',
        name: 'Eco Retreat Long An',
        developer: 'Eco Park',
        location: 'Long An',
        province: 'Long An',
        scale: '150 ha',
        priceRange: 'Từ 4,5 tỷ đồng',
        projectType: 'Khu Nghỉ Dưỡng Sinh Thái',
        typeGroup: 'Biệt thự & nhà phố',
        status: 'Đang bán',
        statusColor: 'indigo',
        img: '/images/projects/aqua-city.png',
        description: 'Khu đô thị nghỉ dưỡng sinh thái Eco Retreat Long An do Eco Park phát triển tại Long An. Quy mô, sản phẩm, giá, pháp lý và tiến độ cần được xác minh theo hồ sơ hiện hành.',
    },
  {
    slug: 'masteri-park-place',
    name: 'Masteri Park Place',
    developer: 'Masterise Homes',
    location: 'The Global City, An Phu, TP. Thu Duc, TP.HCM',
    province: 'TP.HCM',
    scale: '4 toa A1-A2, B1-B2',
    priceRange: 'Tu 6,7 ty',
    projectType: 'Can ho cao cap (1PN, 1PN+, 2PN, 3PN)',
    typeGroup: 'Can ho cao cap',
    status: 'Dang mo ban',
    statusColor: 'emerald',
    img: '/images/projects/masteri-park-place.jpg',
    description: 'Phan khu can ho cao cap thuoc sieu do thi The Global City (An Phu, Thu Duc) do Masterise Homes phat trien. View song Giong Ong To hoac cong vien noi khu, so hong lau dai.',
  },
  {
    slug: 'masteri-cosmo-central',
    name: 'Masteri Cosmo Central',
    developer: 'Masterise Homes',
    location: 'Do Xuan Hop, Thu Duc, TP.HCM',
    province: 'TP.HCM',
    scale: '20 can',
    priceRange: 'Tu 6,43 ty',
    projectType: 'Can ho cao cap',
    typeGroup: 'Can ho cao cap',
    status: 'Dang mo ban',
    statusColor: 'emerald',
    img: '/landing/masteri-cosmo-central/hero.jpg',
    description: 'Du an can ho cao cap Masteri Cosmo Central tai Do Xuan Hop, TP Thu Duc do Masterise Homes phat trien.',
  },
  {
    slug: 'vinhomes-hoc-mon',
    name: 'Vinhomes Hoc Mon',
    developer: 'Vinhomes',
    location: 'Hoc Mon, TP.HCM',
    province: 'TP.HCM',
    scale: 'TBA',
    priceRange: 'Tu 6,5 ty',
    projectType: 'Khu Do Thi',
    typeGroup: 'Biet thu & nha pho',
    status: 'Dang mo ban',
    statusColor: 'indigo',
    img: '/landing/vinhomes-hoc-mon/hero.jpg',
    description: 'Dai do thi moi Vinhomes tai Hoc Mon, TP.HCM. Quy mo lon, tien ich dong bo.',
  },
  {
    slug: 'legacy-66',
    name: 'Legacy 66',
    developer: 'Tan Thanh',
    location: 'Cho Lon, Q.5, TP.HCM',
    province: 'TP.HCM',
    scale: '348 can',
    priceRange: 'Lien he',
    projectType: 'Can ho cao cap',
    typeGroup: 'Can ho cao cap',
    status: 'Dang mo ban',
    statusColor: 'emerald',
    img: '/landing/legacy-66/hero.jpg',
    description: 'Du an can ho cao cap Legacy 66 tai Cho Lon, Quan 5, TP.HCM voi 348 can.',
  },
];

export interface ProjectConfig {
    slug: string;
    name: string;
    developer: string;
    location: string;
    locationSlug: string;
    heroDescription: string;
    details: { label: string; value: string }[];
    amenities: { title: string; items: string[] }[];
    faqs: { q: string; a: string }[];
    relatedProjects: { name: string; slug: string }[];
    priceRange: string;
    projectType: string;
    scale: string;
}
export const PROJECT_GEO_DATA: Record<string, { lat: number; lng: number; yearBuilt: string; containedIn: string; parentArea: string }> = {
  'aqua-city': { lat: 10.9218, lng: 106.8962, yearBuilt: '2019', containedIn: 'Bien Hoa', parentArea: 'Dong Nai' },
  'manhattan': { lat: 10.7769, lng: 106.7009, yearBuilt: '2021', containedIn: 'Binh Thanh', parentArea: 'TP. Ho Chi Minh' },
  'vinhomes-can-gio': { lat: 10.4124, lng: 106.9524, yearBuilt: '2025', containedIn: 'Can Gio', parentArea: 'TP. Ho Chi Minh' },
  'van-phuc-city': { lat: 10.8324, lng: 106.7516, yearBuilt: '2019', containedIn: 'TP Thu Duc', parentArea: 'TP. Ho Chi Minh' },
  'sala': { lat: 10.8025, lng: 106.7414, yearBuilt: '2018', containedIn: 'TP Thu Duc', parentArea: 'TP. Ho Chi Minh' },
  'izumi-city': { lat: 10.9650, lng: 106.8410, yearBuilt: '2022', containedIn: 'Long Thanh', parentArea: 'Dong Nai' },
  'vinhomes-grand-park': { lat: 10.8510, lng: 106.7930, yearBuilt: '2020', containedIn: 'TP Thu Duc', parentArea: 'TP. Ho Chi Minh' },
  'vinhomes-central-park': { lat: 10.7982, lng: 106.7186, yearBuilt: '2017', containedIn: 'Binh Thanh', parentArea: 'TP. Ho Chi Minh' },
  'thu-thiem': { lat: 10.7891, lng: 106.7265, yearBuilt: '2022', containedIn: 'TP Thu Duc', parentArea: 'TP. Ho Chi Minh' },
  'son-kim-land': { lat: 10.7985, lng: 106.7180, yearBuilt: '2023', containedIn: 'Binh Thanh', parentArea: 'TP. Ho Chi Minh' },
  'masterise-homes': { lat: 10.8003, lng: 106.7210, yearBuilt: '2023', containedIn: 'TP Thu Duc', parentArea: 'TP. Ho Chi Minh' },
  'masteri-park-place': { lat: 10.8398, lng: 106.7472, yearBuilt: '2027', containedIn: 'The Global City', parentArea: 'TP. Ho Chi Minh' },
  'the-global-city': { lat: 10.8401, lng: 106.7485, yearBuilt: '2024', containedIn: 'TP Thu Duc', parentArea: 'TP. Ho Chi Minh' },
  'nha-pho-trung-tam': { lat: 10.7769, lng: 106.7009, yearBuilt: '2020', containedIn: 'TP. Ho Chi Minh', parentArea: 'Viet Nam' },
};

export const PROJECT_CONFIG: Record<string, ProjectConfig> = {
    'aqua-city': {
        slug: 'aqua-city',
        name: 'Aqua City Novaland',
        developer: 'Novaland Group',
        location: 'Biên Hòa, Đồng Nai',
        locationSlug: 'bat-dong-san-dong-nai',
        heroDescription:
            'Aqua City là khu đô thị được giới thiệu tại Long Hưng, Biên Hòa, Đồng Nai do Novaland phát triển. Giá, pháp lý, tiến độ, tiện ích và thời gian di chuyển cần được xác minh theo từng sản phẩm bằng hồ sơ hiện hành trước khi giao dịch.',
        priceRange: 'Nhà phố từ 6 tỷ; biệt thự từ 8,5 tỷ; shophouse từ 10 tỷ',
        projectType: 'Đại Đô Thị Sinh Thái',
        scale: '1.000 ha (tham khảo)',
        details: [
            { label: 'Chủ đầu tư', value: 'Novaland Group' },
            { label: 'Quy mô', value: '1.000 ha (tham khảo)' },
            { label: 'Vị trí', value: 'Long Hưng, Biên Hòa, Đồng Nai' },
            { label: 'Khoảng cách TP.HCM', value: 'Cần đo theo tuyến và thời điểm' },
            { label: 'Loại hình', value: 'Theo danh mục sản phẩm được xác minh' },
            { label: 'Nhà phố', value: 'Từ 6 tỷ (giá tham khảo)' },
            { label: 'Biệt thự', value: 'Từ 8,5 tỷ (giá tham khảo)' },
            { label: 'Shophouse', value: 'Từ 10 tỷ (giá tham khảo)' },
            { label: 'Pháp lý', value: 'Cần kiểm tra hồ sơ của từng sản phẩm' },
            { label: 'Tiến độ', value: 'Cần đối chiếu thông báo và thực địa' },
        ],
        amenities: [
            {
                title: 'Tiện ích đẳng cấp',
                items: [
                    'Tiện ích theo hồ sơ từng phân khu',
                    'Dịch vụ vận hành cần xác minh',
                    'Hạ tầng cảnh quan cần đối chiếu tiến độ',
                ],
            },
            {
                title: 'Kết nối hạ tầng',
                items: [
                    'Cầu và đường kết nối: kiểm tra tiến độ chính thức',
                    'Cao tốc Bến Lức – Long Thành: kiểm tra tuyến thực tế',
                    'Sân bay Long Thành: kiểm tra khoảng cách và mốc vận hành chính thức',
                    'Các tuyến giao thông tương lai: không xem là cam kết',
                    'Bến phà và tuyến liên vùng: kiểm tra thời gian di chuyển thực tế',
                ],
            },
        ],
        faqs: [
            {
                q: 'Aqua City Novaland có đáng mua không?',
                a: 'Không có câu trả lời chung cho việc mua Aqua City. Người mua cần xác minh hồ sơ pháp lý của đúng sản phẩm, tiến độ, tiện ích đã vận hành, giá giao dịch, thanh khoản và khả năng tài chính trước khi quyết định.',
            },
            {
                q: 'Giá Aqua City hiện nay là bao nhiêu?',
                a: 'Bảng giá tham khảo Aqua City: nhà phố từ 6 tỷ, biệt thự từ 8,5 tỷ và shophouse từ 10 tỷ. Đây là mức giá khởi điểm tham khảo, thay đổi theo phân khu, diện tích, pháp lý, điều kiện thanh toán và thời điểm; cần xác nhận bảng giá của đúng sản phẩm.',
            },
            {
                q: 'Aqua City cách TP.HCM bao xa?',
                a: 'Aqua City được giới thiệu tại Long Hưng, Biên Hòa, Đồng Nai. Khoảng cách và thời gian đến TP.HCM cần đo theo đúng phân khu, tuyến đường, giao thông và thời điểm; không dùng mốc hạ tầng dự kiến để cam kết thời gian.',
            },
            {
                q: 'Pháp lý Aqua City có an toàn không?',
                a: 'Tình trạng giấy chứng nhận và điều kiện giao dịch có thể khác nhau theo từng lô. Người mua cần kiểm tra hồ sơ gốc, quy hoạch, thế chấp, nghĩa vụ tài chính và xác nhận bằng văn bản trước khi ký hoặc đặt cọc.',
            },
            {
                q: 'Mua Aqua City để đầu tư hay ở thực tốt hơn?',
                a: 'Mục tiêu ở hoặc đầu tư cần được đánh giá riêng theo sản phẩm, tiện ích đã vận hành, nhu cầu thực tế, chi phí sở hữu, khả năng vay và thanh khoản. Không nên giả định tăng giá hoặc thu nhập cho thuê khi chưa có dữ liệu kiểm chứng.',
            },
            {
                q: 'Aqua City đã có sổ hồng riêng chưa?',
                a: 'Tình trạng giấy chứng nhận có thể khác nhau theo từng lô và phân khu. Người mua cần yêu cầu hồ sơ gốc, kiểm tra quy hoạch, thế chấp, nghĩa vụ tài chính và xác nhận bằng văn bản trước khi đặt cọc.',
            },
            {
                q: 'Novaland có còn tài chính ổn định không sau tái cơ cấu?',
                a: 'Đánh giá tình hình tài chính và ảnh hưởng đến người mua cần dựa trên thông tin công bố chính thức, hợp đồng và tiến độ thực tế tại thời điểm kiểm tra. Trang không đưa ra kết luận về khả năng tài chính hoặc rủi ro doanh nghiệp khi chưa có nguồn phù hợp.',
            },
            {
                q: 'So sánh Aqua City và Izumi City — nên chọn dự án nào?',
                a: 'Hai dự án cần được so sánh theo đúng phân khu, loại hình, pháp lý, tiến độ, giá giao dịch, tiện ích đã vận hành và mục tiêu sử dụng. Không nên kết luận dự án nào tốt hơn chỉ từ quy mô, thông điệp tiếp thị hoặc giá tham khảo chưa có ngày.',
            },
            {
                q: 'Cho thuê căn hộ/nhà phố Aqua City được bao nhiêu tiền?',
                a: 'Giá thuê và tỷ suất cho thuê phụ thuộc sản phẩm, nội thất, vị trí, tiện ích đã vận hành, nhu cầu và thời điểm. Cần kiểm tra hợp đồng thuê hoặc dữ liệu thị trường có ngày; không xem dự báo doanh thu là cam kết.',
            },
            {
                q: 'Aqua City có dịch vụ quản lý và vận hành tòa nhà không?',
                a: 'Dịch vụ quản lý, vận hành và phí quản lý cần xác minh với ban quản lý hoặc tài liệu của đúng phân khu. Không áp dụng một mức phí chung cho toàn Aqua City khi chưa có bảng phí hiện hành.',
            },
        ],
        relatedProjects: [
            { name: 'Izumi City Nam Long', slug: 'izumi-city' },
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
        ],
    },
    'manhattan': {
        slug: 'manhattan',
        name: 'Grand Manhattan Novaland',
        developer: 'Novaland Group',
        location: 'TP.HCM',
        locationSlug: 'bat-dong-san-phu-nhuan',
        heroDescription:
            'Grand Manhattan Novaland là tổ hợp căn hộ hạng sang biểu tượng của Novaland tại trung tâm TP.HCM — nơi giao thoa giữa thiết kế đẳng cấp quốc tế và cuộc sống nội đô sôi động. Với chuẩn mực 5 sao, tiện ích vượt trội và vị trí chiến lược, Grand Manhattan là lựa chọn hàng đầu của giới tinh hoa và nhà đầu tư hiểu giá trị.',
        priceRange: 'Từ 120 triệu/m²',
        projectType: 'Căn Hộ Hạng Sang',
        scale: 'Đang cập nhật',
        details: [
            { label: 'Chủ đầu tư', value: 'Novaland Group' },
            { label: 'Vị trí', value: 'Trung tâm TP.HCM' },
            { label: 'Loại hình', value: 'Căn hộ hạng sang, penthouse, sky villa' },
            { label: 'Mức giá tham khảo', value: 'Từ 120 triệu/m²' },
            { label: 'Tiêu chuẩn', value: '5 sao quốc tế' },
            { label: 'Pháp lý', value: 'Sổ hồng chính chủ lâu dài' },
            { label: 'Mục tiêu cư dân', value: 'Doanh nhân, chuyên gia cao cấp, nhà đầu tư' },
            { label: 'Quản lý vận hành', value: 'Novaland Premium Services' },
        ],
        amenities: [
            {
                title: 'Tiện ích đẳng cấp 5 sao',
                items: [
                    'Infinity pool tầng thượng view toàn cảnh TP.HCM',
                    'Sky lounge & rooftop bar exclusive',
                    'Spa cao cấp & phòng gym tiêu chuẩn quốc tế',
                    'Hệ thống an ninh 5 lớp với nhân viên bảo vệ 24/7',
                    'Concierge services đẳng cấp khách sạn',
                    'Hầm xe thông minh đa tầng',
                    'Phòng chiếu phim riêng & co-working premium',
                    'Lobby art gallery & wine lounge',
                ],
            },
            {
                title: 'Kết nối trung tâm TP.HCM',
                items: [
                    'Tiếp giáp Quận 1, Quận 3 — trung tâm tài chính Việt Nam',
                    'Gần sân bay Tân Sơn Nhất (5-10 phút)',
                    'Tuyến Metro số 2 (Bến Thành – Tham Lương) kết nối toàn thành phố',
                    'Gần phố Tây Bùi Viện, Phố đi bộ Nguyễn Huệ, Landmark 81',
                    'Hệ thống trường quốc tế, bệnh viện cao cấp trong bán kính 2km',
                ],
            },
        ],
        faqs: [
            {
                q: 'Grand Manhattan Novaland có điểm gì nổi bật so với các dự án cao cấp khác?',
                a: 'Grand Manhattan Novaland nổi bật với ba yếu tố: (1) Thương hiệu Novaland — chủ đầu tư BĐS hạng sang lớn nhất Việt Nam với hơn 30 năm kinh nghiệm; (2) Vị trí trung tâm nội đô TP.HCM — quỹ đất ngày càng khan hiếm, giá trị tích lũy bền vững; (3) Chuẩn mực 5 sao hoàn toàn — từ tiện ích đến dịch vụ quản lý vận hành.',
            },
            {
                q: 'Giá căn hộ Grand Manhattan Novaland từ bao nhiêu?',
                a: 'Giá tham khảo từ 120 triệu/m², căn hộ 2 phòng ngủ (75-100m²) từ 9-15 tỷ; căn hộ 3 phòng ngủ (120-150m²) từ 15-22 tỷ; penthouse từ 30-50 tỷ. Sky villa theo giá thỏa thuận. Chính sách thanh toán linh hoạt và hỗ trợ vay ngân hàng tối đa 70% giá trị. Liên hệ SGS LAND để được báo giá và thông tin ưu đãi mới nhất.',
            },
            {
                q: 'Grand Manhattan Novaland ở vị trí nào tại TP.HCM?',
                a: 'Grand Manhattan Novaland tọa lạc tại khu vực nội thành TP.HCM, tiếp giáp Quận 1 và khu vực Phú Nhuận — trung tâm tài chính, thương mại và văn hóa lớn nhất Việt Nam. Chỉ 5-10 phút đến sân bay Tân Sơn Nhất, 10-15 phút đến Landmark 81 và Phố đi bộ Nguyễn Huệ.',
            },
            {
                q: 'Có thể cho thuê căn hộ Grand Manhattan Novaland không?',
                a: 'Grand Manhattan Novaland thuộc phân khúc hạng sang — phù hợp cho thuê ngắn và dài hạn cho giám đốc doanh nghiệp, lãnh đạo tập đoàn đa quốc gia và chuyên gia nước ngoài cao cấp. Giá cho thuê dài hạn: 2PN từ 50-80 triệu/tháng; 3PN từ 80-130 triệu/tháng; penthouse từ 150 triệu/tháng trở lên.',
            },
            {
                q: 'Pháp lý Grand Manhattan Novaland có an toàn không?',
                a: 'Novaland Group là chủ đầu tư BĐS niêm yết trên sàn HOSE (mã NVL) với minh bạch tài chính cao. Dự án được cấp sổ hồng chính chủ lâu dài theo quy định hiện hành. SGS LAND cung cấp dịch vụ kiểm tra pháp lý độc lập miễn phí, đảm bảo an toàn tuyệt đối cho người mua.',
            },
            {
                q: 'Chuyên gia và doanh nhân nước ngoài có quan tâm đến Grand Manhattan Novaland không?',
                a: 'TP.HCM có hơn 100.000 chuyên gia và doanh nhân nước ngoài đang sinh sống và làm việc — nhu cầu nhà ở hạng sang luôn vượt cung. Grand Manhattan Novaland với chuẩn quốc tế, vị trí trung tâm và dịch vụ concierge 5 sao là lựa chọn hàng đầu của đối tượng này, tạo nền tảng vững cho thị trường cho thuê cao cấp.',
            },
            {
                q: 'Vay ngân hàng mua Grand Manhattan Novaland có dễ không?',
                a: 'Nhờ Novaland là tập đoàn BĐS lớn có uy tín và pháp lý dự án minh bạch, việc vay ngân hàng thuận lợi. Các ngân hàng liên kết: Vietcombank, BIDV, Techcombank, VPBank cho vay tối đa 70% giá trị, kỳ hạn đến 25 năm, lãi suất ưu đãi 18-24 tháng đầu. SGS LAND hỗ trợ hồ sơ vay và tư vấn tài chính miễn phí.',
            },
            {
                q: 'So sánh Grand Manhattan Novaland và Masterise Homes — nên chọn đâu?',
                a: 'Grand Manhattan Novaland: thương hiệu Novaland đặc trưng, tiện ích resort style, giá cạnh tranh hơn trong phân khúc hạng sang, cộng đồng cư dân Việt và quốc tế đa dạng. Masterise Homes: phong cách quốc tế hơn, vị trí đa dạng, tích hợp thương hiệu quốc tế. SGS LAND tư vấn theo nhu cầu sử dụng và chiến lược đầu tư cụ thể.',
            },
            {
                q: 'Novaland Group có uy tín như thế nào trong lĩnh vực BĐS hạng sang?',
                a: 'Novaland Group là một trong hai tập đoàn BĐS tư nhân lớn nhất Việt Nam (cùng Vinhomes), với danh mục dự án hạng sang trải dài từ căn hộ, resort đến đô thị biển. Các dự án biểu tượng: Aqua City (1.000ha Đồng Nai), Novaworld Phan Thiết, NovaWorld Hồ Tràm — Novaland định hình tiêu chuẩn BĐS cao cấp tại Việt Nam.',
            },
            {
                q: 'Tiềm năng tăng giá của Grand Manhattan Novaland trong 5 năm tới?',
                a: 'BĐS hạng sang trung tâm TP.HCM tăng giá ổn định 10-18%/năm trong thập kỷ qua, bất chấp các biến động thị trường. Grand Manhattan Novaland hưởng lợi từ: (1) Quỹ đất nội đô ngày càng khan hiếm; (2) Metro số 2 hoàn thành (2028-2030) tăng kết nối; (3) TP.HCM trở thành trung tâm tài chính khu vực Đông Nam Á. Dự báo tăng 15-25% trong 5 năm tới.',
            },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'Masterise Homes', slug: 'masterise-homes' },
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
        ],
    },
    'izumi-city': {
        slug: 'izumi-city',
        name: 'Izumi City Nam Long',
        developer: 'Nam Long Group & Hankyu Hanshin Properties',
        location: 'Biên Hòa, Đồng Nai',
        locationSlug: 'bat-dong-san-dong-nai',
        heroDescription:
            'Izumi City là đô thị tích hợp chuẩn Nhật Bản quy mô 170ha tại Biên Hòa, Đồng Nai, do Nam Long Group hợp tác cùng tập đoàn Hankyu Hanshin Properties (Nhật Bản) phát triển. Với tiêu chuẩn sống đẳng cấp, hệ thống tiện ích 4 tầng và vị trí chiến lược cách TP.HCM 30 phút, Izumi City là lựa chọn sống xanh hàng đầu khu vực miền Đông. SGS LAND hỗ trợ tư vấn và giao dịch Izumi City chuyên nghiệp.',
        priceRange: 'Nhà phố từ 8,4 tỷ',
        projectType: 'Đô Thị Tích Hợp Chuẩn Nhật',
        scale: '170 ha',
        details: [
            { label: 'Chủ đầu tư', value: 'Nam Long Group & Hankyu Hanshin (Nhật Bản)' },
            { label: 'Vị trí', value: 'Biên Hòa, Đồng Nai' },
            { label: 'Quy mô', value: '170 ha' },
            { label: 'Khoảng cách TP.HCM', value: '~30 phút (cao tốc)' },
            { label: 'Loại hình', value: 'Nhà phố, biệt thự, căn hộ Akari' },
            { label: 'Mức giá tham khảo', value: 'Nhà phố 8,4-15 tỷ; biệt thự 15-30 tỷ' },
            { label: 'Pháp lý', value: 'Sổ hồng riêng từng căn' },
            { label: 'Tiến độ', value: 'Nhiều phân khu đã bàn giao' },
        ],
        amenities: [
            {
                title: 'Tiện ích đặc trưng Nhật Bản',
                items: [
                    'Siêu thị Fuji Mart (chuỗi Nhật Bản)',
                    'Trường học chuẩn Nhật Bản trong khuôn viên',
                    'Trung tâm y tế tiêu chuẩn Nhật',
                    'Công viên trung tâm 7ha cảnh quan Nhật',
                    'Khu thể thao tổng hợp & hồ bơi Olympic',
                    'Câu lạc bộ cộng đồng & nhà văn hóa',
                    'Khu vườn sinh thái & đường dạo bộ',
                    'Hệ thống an ninh 24/7 tiêu chuẩn cao',
                ],
            },
            {
                title: 'Kết nối hạ tầng',
                items: [
                    'Cao tốc TP.HCM – Long Thành – Dầu Giây (5 phút)',
                    'Cách sân bay Long Thành 20 phút',
                    'Quốc lộ 1A kết nối Biên Hòa – TP.HCM',
                    'Trung tâm Biên Hòa 5km, đủ tiện ích đô thị',
                    'Cầu Đồng Nai và cầu Long Thành kết nối đa hướng',
                ],
            },
        ],
        faqs: [
            {
                q: 'Izumi City Nam Long có đáng mua không?',
                a: 'Izumi City là dự án đô thị tích hợp hiếm hoi tại Đồng Nai được phát triển theo chuẩn Nhật Bản với đối tác Hankyu Hanshin uy tín. Dự án phù hợp cho cả ở thực (tiêu chuẩn sống cao, yên tĩnh) và đầu tư (hưởng lợi sân bay Long Thành, thanh khoản tốt). Nam Long là chủ đầu tư có lịch sử bàn giao đúng tiến độ và pháp lý minh bạch.',
            },
            {
                q: 'Giá nhà phố và biệt thự Izumi City là bao nhiêu?',
                a: 'Nhà phố liền kề Izumi City từ 8,4-15 tỷ tùy diện tích và vị trí trong dự án. Biệt thự song lập từ 15-25 tỷ; biệt thự đơn lập từ 25-40 tỷ. Liên hệ SGS LAND để nhận bảng giá cập nhật và chính sách ưu đãi.',
            },
            {
                q: 'Izumi City cách TP.HCM bao xa và đi như thế nào?',
                a: 'Izumi City tại Biên Hòa, Đồng Nai, cách trung tâm TP.HCM khoảng 30km. Di chuyển nhanh nhất qua cao tốc TP.HCM – Long Thành – Dầu Giây (khoảng 25-35 phút tùy giờ). Ngoài ra còn có quốc lộ 1A và đường vành đai 3 đang triển khai.',
            },
            {
                q: 'Tiện ích Nhật Bản tại Izumi City gồm những gì?',
                a: 'Izumi City tích hợp hệ thống tiện ích theo chuẩn Nhật: siêu thị Fuji Mart, trường học chuẩn Nhật, trung tâm y tế, công viên 7ha thiết kế phong cách Nhật, khu thể thao và nhà văn hóa cộng đồng. Đây là môi trường sống phù hợp cho các gia đình có con nhỏ muốn tiêu chuẩn giáo dục và y tế cao.',
            },
            {
                q: 'Izumi City có sổ hồng riêng không?',
                a: 'Có, Izumi City được cấp sổ hồng riêng từng căn nhà/biệt thự. Nam Long Group cam kết pháp lý rõ ràng và đã có kinh nghiệm bàn giao sổ hồng cho nhiều dự án như Flora, Valora. SGS LAND hỗ trợ kiểm tra pháp lý miễn phí trước giao dịch.',
            },
            {
                q: 'Nam Long Group có uy tín bàn giao đúng hẹn không?',
                a: 'Nam Long Group là một trong những chủ đầu tư mid-high end có track record bàn giao đúng tiến độ tốt nhất Việt Nam. Các dự án Flora Fuji, Flora Panorama, Valora Kikyo đều bàn giao đúng hạn. Đây là điểm khác biệt quan trọng so với nhiều chủ đầu tư khác trong giai đoạn thị trường khó khăn 2022-2024.',
            },
            {
                q: 'Cho thuê Izumi City thu nhập bao nhiêu mỗi tháng?',
                a: 'Nhà phố liền kề Izumi City cho thuê 8-15 triệu/tháng; biệt thự song lập 15-25 triệu/tháng; biệt thự đơn lập 25-40 triệu/tháng. Nhu cầu thuê từ chuyên gia KCN Biên Hòa và Nhơn Trạch. Tỷ suất cho thuê gross yield ước đạt 4-5%/năm so với giá trị tài sản.',
            },
            {
                q: 'So sánh Izumi City và Aqua City — nên chọn dự án nào?',
                a: 'Izumi City: nhỏ hơn (170ha vs 1.000ha), tiêu chuẩn Nhật Bản (Fuji Mart, Hankyu Hanshin), gần TP.HCM hơn, Nam Long track record tốt, giá nhà phố vừa hơn. Aqua City: quy mô lớn hơn, marina/golf, Novaland thương hiệu lớn hơn, giá biệt thự cao hơn. SGS LAND tư vấn theo ngân sách và mục tiêu cụ thể.',
            },
            {
                q: 'Sân bay Long Thành ảnh hưởng thế nào đến giá BĐS Izumi City?',
                a: 'Izumi City tại Biên Hòa, cách sân bay Long Thành 20 phút. Khi SBLT hoàn thành (dự kiến 2026-2028), nhu cầu nhà ở cho nhân sự sân bay, logistics và thương mại sẽ tăng mạnh khu vực Đồng Nai. Giá BĐS Izumi City dự báo tăng 15-25% khi SBLT đi vào hoạt động.',
            },
            {
                q: 'Vay ngân hàng mua nhà Izumi City có được không?',
                a: 'Pháp lý sổ hồng rõ ràng của Izumi City giúp vay ngân hàng thuận lợi. LTV tối đa 70%, kỳ hạn 20-25 năm, lãi suất ưu đãi 18-24 tháng đầu qua ngân hàng hợp tác của Nam Long. SGS LAND hỗ trợ hồ sơ vay và so sánh gói vay từ nhiều ngân hàng miễn phí.',
            },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
        ],
    },
    'vinhomes-grand-park': {
        slug: 'vinhomes-grand-park',
        name: 'Vinhomes Grand Park',
        developer: 'Vinhomes (Tập đoàn Vingroup)',
        location: 'Quận 9 (TP Thủ Đức), TP.HCM',
        locationSlug: 'bat-dong-san-thu-duc',
        heroDescription:
            'Vinhomes Grand Park là siêu đô thị 271ha tại Quận 9 (nay là TP Thủ Đức), TP.HCM — một trong những dự án bất động sản quy mô lớn nhất và được tìm kiếm nhiều nhất Việt Nam. Với 44 tòa tháp căn hộ, công viên trung tâm 36ha, hệ thống tiện ích Vinschool, Vinmec, Vinhome và kết nối Metro số 1, Grand Park là trung tâm đô thị năng động của TP Thủ Đức. SGS LAND hỗ trợ tư vấn và giao dịch mua bán Vinhomes Grand Park.',
        priceRange: 'Từ 3 tỷ đồng',
        projectType: 'Siêu Đô Thị',
        scale: '271 ha',
        details: [
            { label: 'Chủ đầu tư', value: 'Vinhomes (Vingroup)' },
            { label: 'Vị trí', value: 'Quận 9 (TP Thủ Đức), TP.HCM' },
            { label: 'Quy mô', value: '271 ha' },
            { label: 'Số tòa tháp', value: '44 tòa cao tầng' },
            { label: 'Loại hình', value: 'Căn hộ, shophouse, biệt thự' },
            { label: 'Mức giá tham khảo', value: 'Căn hộ từ 3-6 tỷ; shophouse từ 10 tỷ+' },
            { label: 'Kết nối Metro', value: 'Metro số 1 Bến Thành – Suối Tiên' },
            { label: 'Pháp lý', value: 'Sổ hồng riêng' },
        ],
        amenities: [
            {
                title: 'Tiện ích nội khu đẳng cấp',
                items: [
                    'Công viên trung tâm 36ha — lớn nhất TP.HCM',
                    'Trường học Vinschool các cấp',
                    'Bệnh viện Vinmec tiêu chuẩn quốc tế',
                    'Trung tâm thương mại Vincom Mega Mall',
                    'Hồ bơi Olympic và khu thể thao đa năng',
                    'Khu vui chơi trẻ em & công viên chuyên đề',
                    'Hệ thống an ninh 24/7 Smart Home',
                    'Bãi đỗ xe ngầm thông minh',
                ],
            },
            {
                title: 'Kết nối giao thông',
                items: [
                    'Metro số 1 (ga Suối Tiên, Bến Xe Miền Đông mới) — cách 5 phút đi bộ',
                    'Cao tốc TP.HCM – Long Thành – Dầu Giây',
                    'Vành đai 2 mở rộng kết nối toàn TP.HCM',
                    'Quốc lộ 1A và Xa lộ Hà Nội',
                    'Cách sân bay Long Thành 25 phút',
                ],
            },
        ],
        faqs: [
            {
                q: 'Vinhomes Grand Park có đáng mua không năm 2025-2026?',
                a: 'Vinhomes Grand Park là dự án có thanh khoản tốt nhất khu vực Thủ Đức nhờ quy mô lớn, thương hiệu Vinhomes uy tín và kết nối Metro số 1. Phù hợp cho cả ở thực (tiện ích đầy đủ, môi trường sống hiện đại) và đầu tư cho thuê (nhu cầu từ chuyên gia công nghệ SHTP và sinh viên ĐH Quốc Gia). Giá tăng ổn định 8-15%/năm.',
            },
            {
                q: 'Giá căn hộ Vinhomes Grand Park mới nhất là bao nhiêu?',
                a: 'Giá căn hộ Vinhomes Grand Park trên thị trường thứ cấp (2025-2026): The Rainbow 2,5-4 tỷ; The Origami 3-5 tỷ; The Beverly 4-7 tỷ; The Opus One (hạng sang) 8-15 tỷ. Giá cho thuê 8-20 triệu/tháng tùy phân khu và diện tích. Liên hệ SGS LAND để nhận bảng giá cập nhật nhất.',
            },
            {
                q: 'Phân khu nào tốt nhất tại Vinhomes Grand Park?',
                a: 'Mỗi phân khu phù hợp mục đích khác nhau: The Rainbow & Origami — giá tốt, phù hợp ở thực và đầu tư cho thuê; The Beverly — vị trí trung tâm, tiện ích phong phú; The Opus One — phân khúc hạng sang, cộng đồng cư dân cao cấp. SGS LAND tư vấn chọn phân khu theo ngân sách và mục tiêu đầu tư cụ thể.',
            },
            {
                q: 'Metro số 1 ảnh hưởng thế nào đến Vinhomes Grand Park?',
                a: 'Tuyến Metro số 1 (Bến Thành – Suối Tiên) đã vận hành cuối 2024, với ga Suối Tiên và Bến Xe Miền Đông Mới chỉ 5-10 phút đi bộ từ Grand Park. Từ khi Metro hoạt động, giá thuê căn hộ tăng 15-20% và thời gian về trung tâm Q1 giảm xuống còn 30 phút. BĐS cạnh Metro tăng giá bền vững.',
            },
            {
                q: 'Cho thuê căn hộ Vinhomes Grand Park thu nhập bao nhiêu?',
                a: 'Căn hộ 1 phòng ngủ (45-55m²) cho thuê 8-12 triệu/tháng; 2 phòng ngủ 12-18 triệu/tháng; 3 phòng ngủ 18-25 triệu/tháng. Tỷ suất cho thuê gross yield khoảng 4-6%/năm. Nhu cầu thuê rất tốt từ chuyên gia SHTP, sinh viên ĐH Quốc Gia và nhân viên văn phòng khu Đông.',
            },
            {
                q: 'The Opus One Vinhomes Grand Park có đáng đầu tư không?',
                a: 'The Opus One là phân khu hạng sang nhất Grand Park, giá 8-15 tỷ/căn, thiết kế bởi kiến trúc sư quốc tế, vận hành chuẩn khách sạn 5 sao. Phù hợp nhà đầu tư tìm tài sản cao cấp trong hệ sinh thái Vinhomes với cộng đồng doanh nhân. Gross yield cho thuê 3-5%/năm, tăng giá ổn định.',
            },
            {
                q: 'Vinhomes Grand Park có phù hợp cho gia đình có con nhỏ không?',
                a: 'Grand Park là lựa chọn lý tưởng cho gia đình: Vinschool các cấp (mầm non đến THPT) ngay trong khuôn viên, Vinmec tiêu chuẩn quốc tế, công viên 36ha an toàn cho trẻ vui chơi. Cộng đồng cư dân văn minh và môi trường sống trong lành, hệ thống an ninh 24/7.',
            },
            {
                q: 'Pháp lý Vinhomes Grand Park có sổ hồng chưa?',
                a: 'Nhiều phân khu tại Grand Park đã hoàn thành bàn giao và được cấp sổ hồng riêng: The Rainbow, The Origami, The Beverly đã bàn giao 2019-2022. The Opus One đang trong tiến độ bàn giao. SGS LAND hỗ trợ xác minh sổ hồng từng căn cụ thể trước khi đặt cọc.',
            },
            {
                q: 'So sánh Vinhomes Grand Park và Vinhomes Central Park — nên chọn đâu?',
                a: 'Grand Park (Q9): lớn hơn (271ha), giá rẻ hơn (2,5-7 tỷ), cộng đồng trẻ, gần SHTP. Central Park (Bình Thạnh): giá cao hơn (4-15 tỷ), gần sân bay Tân Sơn Nhất, view sông, Landmark 81. Chọn Grand Park nếu ngân sách vừa và ưu tiên tiện ích; chọn Central Park nếu cần vị trí nội thành đẳng cấp.',
            },
            {
                q: 'Tầng nào nên chọn khi mua căn hộ Vinhomes Grand Park?',
                a: 'Tầng 15-25: giá trung bình, thoáng gió, view tốt. Tầng 26 trở lên: view toàn thành phố và sông, giá cao hơn 10-20%, phù hợp đầu tư dài hạn. Tầng 5-14: dễ ra vào, phù hợp gia đình có người lớn tuổi. Tầng 1-4 (shophouse): cho thuê kinh doanh, giá khác biệt hẳn. SGS LAND tư vấn theo mục tiêu cụ thể.',
            },
        ],
        relatedProjects: [
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
            { name: 'The Global City', slug: 'the-global-city' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
        ],
    },
    'vinhomes-central-park': {
        slug: 'vinhomes-central-park',
        name: 'Vinhomes Central Park',
        developer: 'Vinhomes (Tập đoàn Vingroup)',
        location: 'Quận Bình Thạnh, TP.HCM',
        locationSlug: 'marketplace',
        heroDescription:
            'Vinhomes Central Park là đại đô thị ven sông Sài Gòn tại Quận Bình Thạnh — biểu tượng BĐS cao cấp nội thành TP.HCM với 44 tòa tháp, công viên 3,3ha, bể bơi vô cực và tòa Landmark 81 cao nhất Việt Nam. Cư dân đẳng cấp, vị trí đắc địa, kết nối nhanh đến sân bay Tân Sơn Nhất và trung tâm tài chính. SGS LAND hỗ trợ tư vấn mua bán và cho thuê Vinhomes Central Park.',
        priceRange: 'Từ 50 triệu/m² — Penthouse 200+ triệu/m²',
        projectType: 'Đại Đô Thị Ven Sông',
        scale: '44 tòa cao tầng, 14.500 căn',
        details: [
            { label: 'Chủ đầu tư', value: 'Vinhomes (Vingroup)' },
            { label: 'Vị trí', value: 'Quận Bình Thạnh, TP.HCM' },
            { label: 'Số tòa / căn', value: '44 tòa cao tầng, ~14.500 căn' },
            { label: 'Điểm nhấn', value: 'Landmark 81 — tòa nhà cao nhất Việt Nam' },
            { label: 'Loại hình', value: 'Căn hộ cao cấp, penthouse, biệt thự sông' },
            { label: 'Mức giá tham khảo', value: 'Căn hộ 50-150 tr/m²; penthouse 200+ tr/m²' },
            { label: 'Cho thuê', value: '15-60 triệu/tháng tùy loại căn' },
            { label: 'Kết nối', value: '10 phút đến sân bay Tân Sơn Nhất' },
        ],
        amenities: [
            {
                title: 'Tiện ích đẳng cấp nội đô',
                items: [
                    'Công viên trung tâm 3,3ha ven sông Sài Gòn',
                    'Bể bơi vô cực (Infinity Pool) view thành phố',
                    'Trung tâm thương mại Vincom Central Park',
                    'Landmark 81 — Sky Bar, văn phòng, khách sạn 6 sao',
                    'Rạp chiếu phim, khu ẩm thực đa văn hóa',
                    'Phòng gym, spa và khu thể thao trong nhà',
                    'Vườn BBQ, khu vui chơi trẻ em tiêu chuẩn cao',
                    'An ninh đa lớp, quản lý chuyên nghiệp 24/7',
                ],
            },
            {
                title: 'Kết nối chiến lược nội thành',
                items: [
                    'Sân bay Tân Sơn Nhất chỉ 10 phút',
                    'Quận 1 (trung tâm tài chính) 15 phút',
                    'Metro Bến Thành – Tham Lương qua khu vực',
                    'Cầu Sài Gòn, cầu Thủ Thiêm kết nối đa hướng',
                    'Xa lộ Hà Nội, đại lộ Phạm Văn Đồng',
                ],
            },
        ],
        faqs: [
            {
                q: 'Vinhomes Central Park có phải BĐS hạng sang không?',
                a: 'Vinhomes Central Park thuộc phân khúc cao cấp – hạng sang tại TP.HCM, với giá từ 50-200 triệu/m² tùy tầng và view. Cư dân gồm nhiều doanh nhân, chuyên gia nước ngoài và nhân sự cấp cao. Landmark 81 (tòa nhà cao nhất VN) là biểu tượng của dự án, tạo giá trị thương hiệu bền vững.',
            },
            {
                q: 'Giá căn hộ Vinhomes Central Park mới nhất?',
                a: 'Thị trường thứ cấp 2025-2026: căn hộ 1 phòng ngủ từ 3,5-5 tỷ; 2 phòng ngủ 5-9 tỷ; 3 phòng ngủ 8-15 tỷ; penthouse từ 20-50 tỷ. Cho thuê: studio 15-20 triệu/tháng; 2PN 25-40 triệu/tháng; biệt thự sông 60-120 triệu/tháng. Liên hệ SGS LAND để nhận báo giá cập nhật.',
            },
            {
                q: 'Landmark 81 tại Vinhomes Central Park là gì?',
                a: 'Landmark 81 là tòa nhà cao nhất Việt Nam (461m, 81 tầng) nằm trong Vinhomes Central Park. Tòa nhà bao gồm: khách sạn Marriott 5 sao, văn phòng hạng A+, căn hộ dịch vụ cao cấp Serviced Apartment và đài quan sát trên đỉnh. Đây là biểu tượng kiến trúc của TP.HCM, tạo thêm giá trị thương hiệu và giá BĐS cho toàn khu.',
            },
            {
                q: 'Đầu tư cho thuê Vinhomes Central Park có lời không?',
                a: 'Vinhomes Central Park là thị trường cho thuê sôi động nhất khu vực Bình Thạnh. Tỷ suất gross yield khoảng 4-6%/năm, cộng thêm tăng giá BĐS 8-12%/năm, tổng return 12-18%/năm. Nhu cầu thuê rất mạnh từ chuyên gia nước ngoài, doanh nhân và nhân sự công ty đa quốc gia muốn ở gần sân bay và trung tâm tài chính.',
            },
            {
                q: 'Mua căn hộ Vinhomes Central Park cần kiểm tra pháp lý gì?',
                a: 'Khi mua thứ cấp tại Central Park cần kiểm tra: (1) Sổ hồng chính chủ, không tranh chấp; (2) Không có nghĩa vụ tài chính đang thế chấp ngân hàng; (3) Phí quản lý và tiện ích không nợ đọng; (4) Biên bản bàn giao và hồ sơ kỹ thuật đầy đủ. SGS LAND kiểm tra pháp lý độc lập miễn phí cho mọi giao dịch.',
            },
            {
                q: 'Người nước ngoài có được mua căn hộ Vinhomes Central Park không?',
                a: 'Theo Luật Nhà Ở 2023, người nước ngoài được mua tối đa 30% số căn hộ trong một tòa nhà. Vinhomes Central Park có cộng đồng expat rất đông (Hàn, Nhật, Âu, Mỹ), pháp lý cấp cho người nước ngoài rõ ràng. SGS LAND hỗ trợ thủ tục pháp lý riêng cho người nước ngoài mua BĐS tại Việt Nam.',
            },
            {
                q: 'So sánh Vinhomes Central Park và Thủ Thiêm — nên chọn đâu?',
                a: 'Central Park: hệ sinh thái Vinhomes hoàn chỉnh, gần sân bay Tân Sơn Nhất, giá 50-200 triệu/m², thanh khoản cao. Thủ Thiêm: tiềm năng dài hạn cao hơn (quy hoạch tài chính quốc tế), giá 80-250 triệu/m², đang phát triển. Chọn Central Park nếu cần thanh khoản; chọn Thủ Thiêm nếu đầu tư dài hạn 5-10 năm.',
            },
            {
                q: 'Phí quản lý tòa nhà Vinhomes Central Park là bao nhiêu?',
                a: 'Phí quản lý Vinhomes Central Park khoảng 10.000-12.000 VNĐ/m²/tháng. Căn 2PN (75m²) khoảng 750.000-900.000 đồng/tháng. Phí này bao gồm an ninh 24/7, vệ sinh tòa nhà, bảo trì thang máy, tiện ích công cộng. Vinhomes quản lý chuyên nghiệp, chất lượng dịch vụ cao nhất trong các dự án tại TP.HCM.',
            },
            {
                q: 'Căn hộ tầng cao view sông Vinhomes Central Park đẹp không?',
                a: 'Căn hộ tầng 20 trở lên tại Central Park có view sông Sài Gòn và Landmark 81 — được coi là một trong những view đẹp nhất Việt Nam. Tầng càng cao, giá càng tăng 10-25%. Các tòa Landmark Plus, Landmark 1-6 view sông đẹp nhất. Căn góc 2 view giá cao hơn 15-20% nhưng rất được ưa chuộng.',
            },
            {
                q: 'Vay ngân hàng mua căn hộ thứ cấp Vinhomes Central Park có khó không?',
                a: 'Mua thứ cấp vay ngân hàng tại Central Park thuận lợi vì sổ hồng riêng đầy đủ. LTV tối đa 65-70%, kỳ hạn 25 năm. Nhiều ngân hàng nhận thế chấp căn hộ Central Park (VCB, Techcombank, BIDV). SGS LAND hỗ trợ hồ sơ vay và tìm gói lãi suất tốt nhất thị trường.',
            },
        ],
        relatedProjects: [
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
            { name: 'Masterise Homes', slug: 'masterise-homes' },
            { name: 'Khu Đô Thị Thủ Thiêm', slug: 'thu-thiem' },
        ],
    },
    'thu-thiem': {
        slug: 'thu-thiem',
        name: 'Khu Đô Thị Thủ Thiêm',
        developer: 'UBND TP.HCM & Các Chủ Đầu Tư Lớn',
        location: 'Thủ Thiêm, TP Thủ Đức (Q2 cũ), TP.HCM',
        locationSlug: 'bat-dong-san-thu-duc',
        heroDescription:
            'Khu Đô Thị Mới Thủ Thiêm (657ha) đối diện Q1 qua sông Sài Gòn — được quy hoạch là Trung Tâm Tài Chính – Thương Mại tương lai của TP.HCM và cả nước. Với hạ tầng hiện đại đồng bộ, cầu và hầm Thủ Thiêm kết nối trực tiếp Q1, Thủ Thiêm là điểm đến của các dự án bất động sản hạng sang và thương mại đẳng cấp quốc tế. SGS LAND hỗ trợ tư vấn mua bán BĐS Thủ Thiêm.',
        priceRange: 'Căn hộ từ 80 triệu/m² — Đất thương mại từ 500 triệu/m²',
        projectType: 'Khu Đô Thị Tài Chính Hạng Sang',
        scale: '657 ha',
        details: [
            { label: 'Vị trí', value: 'Thủ Thiêm, TP Thủ Đức (Q2 cũ), TP.HCM' },
            { label: 'Quy mô', value: '657 ha (khu đô thị mới)' },
            { label: 'Kết nối Q1', value: 'Hầm Thủ Thiêm, cầu Thủ Thiêm 2' },
            { label: 'Loại hình', value: 'Căn hộ hạng sang, văn phòng A+, thương mại' },
            { label: 'Mức giá', value: 'Căn hộ 80-250 tr/m²; đất TM 200-500 tr/m²' },
            { label: 'Dự án tiêu biểu', value: 'Empire City, Metropole, The River' },
            { label: 'Định hướng', value: 'Trung tâm tài chính quốc tế TP.HCM' },
            { label: 'Pháp lý', value: 'Quy hoạch 1/500 rõ ràng' },
        ],
        amenities: [
            {
                title: 'Hạ tầng đô thị hiện đại',
                items: [
                    'Quảng trường trung tâm 12ha ven sông',
                    'Tuyến đường thủy nội địa Thủ Thiêm',
                    'Hệ thống ngầm hóa điện, viễn thông toàn khu',
                    'Công viên bờ sông Sài Gòn dài 10km',
                    'Trung tâm biểu diễn nghệ thuật quốc tế (đang xây)',
                    'Hệ thống xe buýt nhanh BRT nội khu',
                    'Bãi đỗ xe ngầm 5 tầng dưới quảng trường',
                    'Khu phức hợp văn phòng – khách sạn – thương mại',
                ],
            },
            {
                title: 'Kết nối đa phương thức',
                items: [
                    'Hầm Thủ Thiêm — kết nối thẳng Q1 trong 5 phút',
                    'Cầu Thủ Thiêm 2 — kết nối Q1, Ba Son',
                    'Cầu Ba Son — kết nối Bình Thạnh, Q1',
                    'Metro số 2 (Bến Thành – Thủ Thiêm) quy hoạch đi qua',
                    'Kết nối cao tốc TP.HCM – Long Thành qua TP Thủ Đức',
                ],
            },
        ],
        faqs: [
            {
                q: 'Khu đô thị Thủ Thiêm có đáng đầu tư không?',
                a: 'Thủ Thiêm là thị trường BĐS chiến lược dài hạn — quy hoạch là trung tâm tài chính quốc tế TP.HCM (tương tự Pudong/Thượng Hải). Giá BĐS đã tăng mạnh nhưng tiềm năng còn lớn khi các tòa nhà văn phòng, khách sạn và trung tâm thương mại hoàn thành trong 2025-2030. Phù hợp với nhà đầu tư dài hạn tài chính mạnh.',
            },
            {
                q: 'Giá căn hộ Thủ Thiêm hiện tại là bao nhiêu?',
                a: 'Giá căn hộ Thủ Thiêm thuộc hàng cao nhất TP.HCM: Empire City 90-150 triệu/m²; Metropole Thủ Thiêm 90-130 triệu/m²; The River Thủ Thiêm 80-120 triệu/m²; Grand Marina Saigon 130-250 triệu/m². Cho thuê các dự án này 35-80 triệu/tháng. Liên hệ SGS LAND để so sánh và tư vấn.',
            },
            {
                q: 'Các dự án BĐS nào đáng chú ý tại Thủ Thiêm?',
                a: 'Ba dự án lớn nhất: (1) Empire City (Keppel Land + Tiến Phước) — 14,57ha, căn hộ từ 5-15 tỷ; (2) Metropole Thủ Thiêm (SonKim Land) — khu đô thị hỗn hợp, căn hộ 7-20 tỷ; (3) The River (Kiến Á) — căn hộ 80-100 triệu/m². Ngoài ra còn Grand Marina Saigon (Masterise Homes) tại vị trí bến cảng lịch sử Ba Son.',
            },
            {
                q: 'Khu đô thị Thủ Thiêm sẽ phát triển thành gì?',
                a: 'Theo quy hoạch được duyệt, Thủ Thiêm sẽ là "Manhattan của Sài Gòn" với trung tâm tài chính – ngân hàng, văn phòng tập đoàn quốc tế, khách sạn 5-6 sao, trung tâm thương mại cao cấp, căn hộ hạng sang và quảng trường quốc tế. Khi hoàn chỉnh (dự kiến 2030-2035), Thủ Thiêm sẽ là trung tâm kinh tế của toàn bộ Đông Nam Á.',
            },
            {
                q: 'Rủi ro khi đầu tư BĐS Thủ Thiêm là gì?',
                a: 'Rủi ro chính cần lưu ý: (1) Giá cao, thanh khoản thứ cấp chậm hơn nội thành truyền thống; (2) Tiến độ hoàn thiện hạ tầng có thể chậm so với quy hoạch; (3) Một số lô đất vẫn đang tranh chấp quy hoạch cần kiểm tra kỹ. SGS LAND hỗ trợ kiểm tra pháp lý và đánh giá rủi ro độc lập trước khi đầu tư.',
            },
            {
                q: 'Metropole Thủ Thiêm của Sơn Kim Land là dự án như thế nào?',
                a: 'Metropole Thủ Thiêm (5,04ha) là dự án 5 phân khu do Sơn Kim Land và Creed Group (Nhật Bản) đồng phát triển ngay trung tâm Thủ Thiêm. Bao gồm The River, The Grand Riverside, The Crest Residence, The Peak, The Galleria — giá 7-30 tỷ/căn. Đây là khu tổ hợp có thiết kế đẹp nhất Thủ Thiêm hiện tại.',
            },
            {
                q: 'Hầm Thủ Thiêm và cầu Thủ Thiêm 2 đã hoạt động chưa?',
                a: 'Cả hai đã hoạt động: Hầm Thủ Thiêm (từ 2011) kết nối thẳng Q1 qua đường Nguyễn Hữu Cảnh; cầu Thủ Thiêm 2 (từ 2022) kết nối Ba Son-Q1. Từ đó, di chuyển từ Thủ Thiêm vào Q1 chỉ còn 5-8 phút, tăng đáng kể giá trị BĐS khu vực.',
            },
            {
                q: 'Người nước ngoài có mua được BĐS Thủ Thiêm không?',
                a: 'Theo Luật Nhà Ở 2023, người nước ngoài được mua tối đa 30% căn hộ trong một dự án. Các dự án Thủ Thiêm như Metropole, Empire City, The River đều có phần dành cho người nước ngoài. SGS LAND hỗ trợ quy trình pháp lý riêng cho người nước ngoài mua BĐS tại khu vực Thủ Thiêm.',
            },
            {
                q: 'Grand Marina Saigon tại Ba Son có gì đặc biệt?',
                a: 'Grand Marina Saigon (Ba Son, Q1) do Masterise Homes phát triển là dự án BĐS sang trọng nhất TP.HCM: tích hợp khách sạn Marriott International, JW Marriott, bến du thuyền riêng trên sông Sài Gòn và căn hộ branded residence. Giá 130-300 triệu/m², đây là tài sản ultra-luxury tốt nhất thị trường Việt Nam.',
            },
            {
                q: 'Empire City Thủ Thiêm tiến độ bàn giao như thế nào?',
                a: 'Empire City (Keppel Land + Tiến Phước + Watco, 14,57ha) đang trong tiến độ xây dựng nhiều phân khu. Tháp Tilia và Empire 88 đã hoàn thành. Chủ đầu tư Singapore Keppel Land uy tín cao, đảm bảo tiến độ và chất lượng. SGS LAND cập nhật tiến độ từng phân khu trước khi mua.',
            },
        ],
        relatedProjects: [
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
            { name: 'Masterise Homes', slug: 'masterise-homes' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
        ],
    },
    'son-kim-land': {
        slug: 'son-kim-land',
        name: 'Sơn Kim Land',
        developer: 'Sơn Kim Land (Sơn Kim Group)',
        location: 'TP.HCM & Hà Nội',
        locationSlug: 'marketplace',
        heroDescription:
            'Sơn Kim Land là thương hiệu bất động sản cao cấp thuộc Sơn Kim Group — tập đoàn đa ngành hàng đầu Việt Nam với chuỗi trung tâm thương mại GEM CENTER, hệ thống GS25 và các dự án BĐS nghỉ dưỡng, căn hộ tại TP.HCM và Hà Nội. Danh mục dự án đa dạng từ căn hộ trung cao cấp đến bất động sản thương mại và nghỉ dưỡng. SGS LAND hỗ trợ tư vấn mua bán, cho thuê dự án Sơn Kim Land.',
        priceRange: 'Từ 110 triệu/m² — 250 triệu/m²',
        projectType: 'BĐS Thương Mại & Căn Hộ Cao Cấp',
        scale: 'Nhiều dự án tại TP.HCM & Hà Nội',
        details: [
            { label: 'Chủ đầu tư', value: 'Sơn Kim Land (Sơn Kim Group)' },
            { label: 'Thị trường', value: 'TP.HCM, Hà Nội' },
            { label: 'Phân khúc', value: 'Căn hộ trung cao cấp, BĐS thương mại, nghỉ dưỡng' },
            { label: 'Dự án tiêu biểu', value: 'Gem Riverside, Seasons Avenue, Metropole Thủ Thiêm' },
            { label: 'Mức giá tham khảo', value: 'Căn hộ 110-250 triệu/m²' },
            { label: 'Hệ sinh thái', value: 'GEM CENTER, GS25, khách sạn 5 sao' },
            { label: 'Kinh nghiệm', value: '20+ năm phát triển BĐS' },
            { label: 'Đặc điểm', value: 'Tích hợp thương mại, dịch vụ và ở ở cùng khu' },
        ],
        amenities: [
            {
                title: 'Hệ sinh thái Sơn Kim',
                items: [
                    'GEM CENTER — trung tâm sự kiện & hội nghị hàng đầu TP.HCM',
                    'GS25 — chuỗi cửa hàng tiện lợi Hàn Quốc tiêu chuẩn quốc tế',
                    'Khách sạn 4-5 sao liên kết trong các dự án lớn',
                    'Khu thương mại tích hợp với lifestyle shopping',
                    'F&B cao cấp — nhà hàng, cà phê đa phong cách',
                    'Khu văn phòng hạng B+/A trong dự án hỗn hợp',
                    'Dịch vụ quản lý tòa nhà chuyên nghiệp',
                    'Tiêu chuẩn xây dựng Green Building',
                ],
            },
            {
                title: 'Dự án nổi bật',
                items: [
                    'Gem Riverside Q4 — căn hộ ven sông Sài Gòn',
                    'Metropole Thủ Thiêm — khu đô thị Thủ Thiêm (đồng đầu tư)',
                    'Seasons Avenue Mỗ Lao — căn hộ cao cấp Hà Nội',
                    'Geleximco Southern Star — Hà Đông, Hà Nội',
                    'GEM Center Nguyễn Đình Chiểu — Q3, TP.HCM',
                ],
            },
        ],
        faqs: [
            {
                q: 'Sơn Kim Land có uy tín không?',
                a: 'Sơn Kim Land là thương hiệu BĐS có uy tín tốt, thuộc Sơn Kim Group — tập đoàn thành lập từ 1993 với các mảng kinh doanh đa dạng: BĐS, bán lẻ (GS25), tổ chức sự kiện (GEM CENTER), khách sạn. Dự án Gem Riverside và Metropole Thủ Thiêm được đánh giá cao về thiết kế và chất lượng xây dựng.',
            },
            {
                q: 'Dự án Gem Riverside của Sơn Kim Land như thế nào?',
                a: 'Gem Riverside tại Quận 4 TP.HCM là dự án căn hộ cao cấp ven sông Sài Gòn. Vị trí cực kỳ hiếm — mặt tiền sông trong nội thành, cách Q1 chỉ 10 phút. Giá 85-120 triệu/m², phù hợp đầu tư dài hạn hoặc ở thực tại trung tâm thành phố với view sông đắt giá.',
            },
            {
                q: 'Sơn Kim Land có dự án nào tại Hà Nội không?',
                a: 'Sơn Kim Land phát triển Seasons Avenue tại Mỗ Lao (Hà Đông, Hà Nội) — căn hộ cao cấp với hệ thống tiện ích đồng bộ, gần các trục giao thông lớn. Ngoài ra tham gia Geleximco Southern Star cùng đối tác. Hà Nội là thị trường chiến lược mà Sơn Kim Land đang mở rộng.',
            },
            {
                q: 'GEM CENTER liên quan gì đến Sơn Kim Land?',
                a: 'GEM Center (186 Lê Thánh Tôn, Q1, TP.HCM) là trung tâm sự kiện và hội nghị hàng đầu TP.HCM do Sơn Kim Group vận hành. Đây là phần của hệ sinh thái thương mại Sơn Kim Land — tạo ra giá trị cộng thêm cho các dự án BĐS cùng thương hiệu. Nhà đầu tư tại dự án Sơn Kim Land được hưởng lợi từ hệ sinh thái này.',
            },
            {
                q: 'Nên mua dự án Sơn Kim Land hay thương hiệu khác?',
                a: 'Sơn Kim Land phù hợp với nhà đầu tư ưu tiên: (1) BĐS tích hợp thương mại – dịch vụ – ở; (2) Cộng đồng cư dân chuyên nghiệp, quốc tế hóa; (3) Hệ sinh thái vận hành chuyên nghiệp dài hạn. So sánh với Vinhomes (quy mô lớn, giá đại trà) và Masterise (hạng sang). SGS LAND tư vấn khách quan, không hoa hồng chủ đầu tư.',
            },
            {
                q: 'Metropole Thủ Thiêm của Sơn Kim Land có đáng mua không?',
                a: 'Metropole Thủ Thiêm (đồng phát triển với Creed Group Nhật Bản) tại vị trí số 1 Thủ Thiêm — trực tiếp nhìn ra sông Sài Gòn. Phân khu The River và The Grand Riverside đã bàn giao, thanh khoản thứ cấp tốt. Giá 7-20 tỷ/căn, tỷ suất cho thuê 3-5%/năm. Phù hợp đầu tư dài hạn theo quy hoạch trung tâm tài chính TP.HCM.',
            },
            {
                q: 'Gem Riverside Q4 Sơn Kim Land giá bao nhiêu năm 2026?',
                a: 'Gem Riverside tại Quận 4, mặt tiền sông Sài Gòn, thị trường thứ cấp 2025-2026: căn 2PN (70-80m²) khoảng 7-9 tỷ, 3PN (90-110m²) khoảng 9-15 tỷ. Cho thuê 2PN 20-30 triệu/tháng, 3PN 30-45 triệu/tháng. Vị trí hiếm view sông nội thành, tiềm năng tăng giá bền vững.',
            },
            {
                q: 'GS25 của Sơn Kim Land có ý nghĩa gì với dự án BĐS?',
                a: 'Sơn Kim Group vận hành GS25 Việt Nam (chuỗi convenience store Hàn Quốc, 700+ điểm). Trong dự án Sơn Kim Land thường có GS25 nội khu, tạo tiện ích sống đầy đủ cho cư dân. Hệ sinh thái GS25 + GEM Center + BĐS tạo ra cộng đồng lifestyle tích hợp, khác biệt với chủ đầu tư thông thường.',
            },
            {
                q: 'So sánh Sơn Kim Land và Masterise Homes — khác nhau thế nào?',
                a: 'Sơn Kim Land: tích hợp thương mại-lifestyle mạnh (GEM Center, GS25, hotel), giá từ 50-130 triệu/m², cộng đồng quốc tế vừa phải. Masterise: ultra-luxury (branded residence, 110-350 triệu/m²), vận hành bởi Marriott/IHG, cộng đồng doanh nhân/expat cấp cao. Chọn Sơn Kim nếu giá vừa hơn; chọn Masterise nếu cần prestige cao nhất.',
            },
            {
                q: 'Sơn Kim Land có dự án nghỉ dưỡng hay resort nào không?',
                a: 'Sơn Kim Land đang phát triển mảng hospitality và nghỉ dưỡng tại các điểm du lịch cao cấp như Đà Nẵng và Phú Quốc. Đây là chiến lược mở rộng danh mục ngoài BĐS đô thị. Đầu tư BĐS nghỉ dưỡng Sơn Kim tận dụng thương hiệu và hệ sinh thái vận hành khách sạn sẵn có.',
            },
        ],
        relatedProjects: [
            { name: 'Khu Đô Thị Thủ Thiêm', slug: 'thu-thiem' },
            { name: 'Masterise Homes', slug: 'masterise-homes' },
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
        ],
    },
    'masterise-homes': {
        slug: 'masterise-homes',
        name: 'Masterise Homes',
        developer: 'Masterise Homes (Masterise Group)',
        location: 'TP.HCM & Toàn Quốc',
        locationSlug: 'bat-dong-san-thu-duc',
        heroDescription:
            'Masterise Homes là thương hiệu bất động sản hạng sang – ultra luxury hàng đầu Việt Nam thuộc Masterise Group. Danh mục dự án bao gồm Masteri Thảo Điền, Masteri An Phú, Masteri Centre Point, Lumière Boulevard, Lumière Riverside và Grand Marina Saigon — đều thiết kế bởi kiến trúc sư quốc tế, vận hành bởi chuỗi khách sạn 5 sao. SGS LAND hỗ trợ tư vấn và giao dịch Masterise Homes chuyên nghiệp.',
        priceRange: 'Từ 7,5 tỷ đồng',
        projectType: 'Bất Động Sản Hạng Sang & Ultra Luxury',
        scale: 'Nhiều dự án tại TP.HCM, Hà Nội, Phú Quốc',
        details: [
            { label: 'Chủ đầu tư', value: 'Masterise Homes (Masterise Group)' },
            { label: 'Phân khúc', value: 'Hạng sang đến ultra-luxury' },
            { label: 'Dự án tiêu biểu', value: 'Masteri Thảo Điền, Lumière, Grand Marina' },
            { label: 'Mức giá', value: 'Masteri từ 7,5 tỷ; Lumière từ 12 tỷ; Grand Marina từ 130 triệu/m²' },
            { label: 'Vận hành', value: 'Chuỗi khách sạn 5 sao quốc tế' },
            { label: 'Thiết kế', value: 'Kiến trúc sư & interior designer quốc tế' },
            { label: 'Thị trường', value: 'TP.HCM, Hà Nội, Phú Quốc, Nha Trang' },
            { label: 'Cộng đồng', value: 'Doanh nhân, chuyên gia cấp cao, expats' },
        ],
        amenities: [
            {
                title: 'Tiêu chuẩn ultra-luxury',
                items: [
                    'Thiết kế nội thất bởi designer quốc tế (Châu Âu, Singapore)',
                    'Lobby khách sạn 6 sao với concierge 24/7',
                    'Sky Pool, Sky Lounge trên tầng cao',
                    'Private cinema và wine cellar riêng từng tầng',
                    'Gym, spa, yoga studio chuẩn khách sạn 5 sao',
                    'Hệ thống smart home tích hợp toàn bộ',
                    'Bãi đỗ xe riêng, butler service theo yêu cầu',
                    'Khu vực cộng đồng business club độc quyền',
                ],
            },
            {
                title: 'Danh mục dự án Masterise',
                items: [
                    'Masteri Thảo Điền (Q2) — căn hộ hạng sang ven sông',
                    'Masteri An Phú (Q2) — vị trí vàng cạnh Metro số 1',
                    'Masteri Centre Point (Q9) — kết nối Khu Đô Thị mới',
                    'Lumière Boulevard (Q9) — căn hộ ultra-luxury',
                    'Lumière Riverside (Q2) — biệt thự ven sông Sài Gòn',
                    'Grand Marina Saigon (Ba Son) — phức hợp 5 sao ngay Q1',
                    'The Global City (An Phú) — đô thị thương mại 117ha',
                ],
            },
        ],
        faqs: [
            {
                q: 'Masterise Homes có đáng tin không?',
                a: 'Masterise Homes là thương hiệu BĐS hạng sang uy tín của Việt Nam, có hậu thuẫn từ Masterise Group với các đối tác quốc tế như Marriott, IHG. Dự án Masteri Thảo Điền và Masteri An Phú đã bàn giao thành công, giữ giá tốt qua các chu kỳ thị trường. Đây là lựa chọn an toàn cho nhà đầu tư dài hạn.',
            },
            {
                q: 'Giá căn hộ Masterise Homes hiện nay là bao nhiêu?',
                a: 'Giá Masterise theo dự án: Masteri Thảo Điền 110-150 triệu/m²; Masteri An Phú 80-130 triệu/m²; Lumière Boulevard 110-180 triệu/m²; Grand Marina Saigon 180-350 triệu/m² (luxury). Cho thuê: Masteri Thảo Điền 25-60 triệu/tháng; căn hộ Lumière 40-80 triệu/tháng. Liên hệ SGS LAND để báo giá cập nhật.',
            },
            {
                q: 'Grand Marina Saigon của Masterise có đặc biệt không?',
                a: 'Grand Marina Saigon là dự án BĐS hạng sang nhất TP.HCM tại địa điểm lịch sử Ba Son (Q1). Tòa nhà được tích hợp với khách sạn Marriott, JW Marriott và có quyền truy cập bến du thuyền riêng trên sông Sài Gòn. Giá từ 130-300 triệu/m², phù hợp nhà đầu tư tìm kiếm tài sản trú ẩn giá trị và tỷ suất cho thuê cao nhất thị trường.',
            },
            {
                q: 'Masteri Thảo Điền hay Masteri An Phú nên chọn?',
                a: 'Masteri Thảo Điền — vị trí gần sông hơn, cộng đồng expat đông, tiện ích xung quanh phong phú; phù hợp cho thuê ngắn hạn và cư dân nước ngoài. Masteri An Phú — cạnh ga Metro số 1, kết nối toàn TP.HCM dễ dàng; phù hợp đi làm và thanh khoản cao. SGS LAND tư vấn chọn theo mục tiêu cụ thể của bạn.',
            },
            {
                q: 'Lumière Boulevard và Lumière Riverside khác nhau thế nào?',
                a: 'Lumière Boulevard (Tô Ngọc Vân, Q9/Thủ Đức) — căn hộ ultra-luxury theo phong cách Paris, gần Metro số 1, giá 90-150 triệu/m². Lumière Riverside (Q2) — biệt thự ven sông Sài Gòn tầm nhìn toàn cảnh, tính riêng tư cao, giá 120-200 triệu/m². Cả hai đều được vận hành bởi chuỗi khách sạn 5 sao quốc tế.',
            },
            {
                q: 'Masteri Thảo Điền có còn là BĐS tốt để đầu tư năm 2026 không?',
                a: 'Masteri Thảo Điền (Q2) đã bàn giao từ 2017-2018, sổ hồng đầy đủ, giá tăng đều 10%+/năm. Thị trường cho thuê mạnh (25-60 triệu/tháng) nhờ vị trí Thảo Điền expat hub. Giá thứ cấp 65-100 triệu/m², thanh khoản tốt. Đây vẫn là BĐS hạng sang an toàn để tích lũy dài hạn.',
            },
            {
                q: 'Người nước ngoài có thể mua dự án Masterise Homes không?',
                a: 'Theo Luật Nhà Ở 2023, người nước ngoài được mua tối đa 30% số căn trong dự án chung cư. Masteri Thảo Điền, Masteri An Phú có cộng đồng expat đông nhất TP.HCM. SGS LAND hỗ trợ quy trình pháp lý, hợp đồng song ngữ và thủ tục chuyển tiền cho người nước ngoài mua BĐS Masterise.',
            },
            {
                q: 'Grand Marina Saigon tiến độ bàn giao năm 2025-2026 như thế nào?',
                a: 'Grand Marina Saigon (Ba Son, Q1) phân khu đầu đã bàn giao 2024. Phân khu JW Marriott và Marriott Executive Apartments đang tiếp tục hoàn thiện và bàn giao 2025-2026. Tiến độ đúng cam kết từ Masterise. SGS LAND theo dõi cập nhật tiến độ từng tháng.',
            },
            {
                q: 'Masterise Homes hỗ trợ vay ngân hàng mua căn hộ không?',
                a: 'Masterise Homes hợp tác với nhiều ngân hàng lớn: Techcombank, VPBank, BIDV. LTV tối đa 70%, lãi suất ưu đãi 0-5%/18-24 tháng đầu rồi thả nổi. SGS LAND so sánh các gói vay và hỗ trợ hồ sơ miễn phí để nhà đầu tư chọn được gói tài chính tối ưu nhất.',
            },
            {
                q: 'Tại sao Masterise Homes được coi là ultra-luxury?',
                a: 'Ba yếu tố: (1) Thiết kế bởi kiến trúc sư và interior designer quốc tế (Châu Âu, Singapore); (2) Vận hành bởi chuỗi khách sạn 5 sao Marriott, IHG — concierge, butler, valet 24/7; (3) Vị trí prime location — Thảo Điền, An Phú, Ba Son Q1. Kết hợp ba yếu tố này tạo ra branded residence đẳng cấp nhất thị trường Việt Nam.',
            },
        ],
        relatedProjects: [
            { name: 'The Global City', slug: 'the-global-city' },
            { name: 'Khu Đô Thị Thủ Thiêm', slug: 'thu-thiem' },
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
        ],
    },
    'masteri-park-place': {
      slug: 'masteri-park-place',
      name: 'Masteri Park Place',
      developer: 'Masterise Homes',
      location: 'The Global City, An Phú, TP. Thủ Đức, TP.HCM',
      locationSlug: 'the-global-city',
      heroDescription: 'Masteri Park Place là phân khu căn hộ cao cấp thuộc siêu đô thị The Global City (An Phú, Thủ Đức) do Masterise Homes phát triển. Gồm 4 toà A1, A2, B1, B2 với căn hộ 1PN, 1PN+, 2PN, 3PN, view sông Giồng Ông Tố và công viên nội khu. Giá từ 6,7 tỷ (~120 triệu/m²). Liên hệ SGS LAND: 0971 132 378 để nhận bảng giá chi tiết toà A1-A2 và B1-B2.',
      details: [
        { label: 'Chủ đầu tư', value: 'Masterise Homes' },
        { label: 'Vị trí', value: 'The Global City, An Phú, TP. Thủ Đức, TP.HCM' },
        { label: 'Loại hình', value: 'Căn hộ cao cấp (1PN, 1PN+, 2PN, 3PN)' },
        { label: 'Toà tháp', value: 'A1, A2, B1, B2' },
        { label: 'Diện tích', value: '53 - 109 m² (tim tường)' },
        { label: 'Giá 1PN (~53-57m²)', value: '6,7 - 8,4 tỷ' },
        { label: 'Giá 1PN+ (~54-59m²)', value: '6,8 - 8,5 tỷ' },
        { label: 'Giá 2PN (~74-83m²)', value: '8,9 - 10,1 tỷ' },
        { label: 'Giá 3PN (~95-109m²)', value: '11,8 - 14,5 tỷ' },
        { label: 'Pháp lý', value: 'Sổ hồng lâu dài' },
      ],
      amenities: [
        { title: 'Tiện ích nội khu', items: ['Công viên & vườn Nhật nội khu', 'Hồ cảnh quan & thác nước', 'Khu yoga - thiền ngoài trời', 'Bể bơi & phòng gym'] },
        { title: 'Kết nối The Global City', items: ['Quảng trường ánh sáng SOHO', 'Nhạc nước lớn nhất Đông Nam Á', 'Trung tâm thương mại', 'Metro số 1 & cao tốc Long Thành'] },
      ],
      faqs: [
        { q: 'Masteri Park Place ở đâu?', a: 'Masteri Park Place toạ lạc trong The Global City tại An Phú, TP. Thủ Đức, TP.HCM - siêu đô thị 117ha do Masterise Homes phát triển, kề Metro số 1 và cao tốc TP.HCM - Long Thành.' },
        { q: 'Giá căn hộ Masteri Park Place bao nhiêu?', a: 'Giá khảo sát (chưa VAT) từ khoảng 6,7 tỷ cho căn 1PN, 8,9-10,1 tỷ cho 2PN và 11,8-14,5 tỷ cho 3PN. Bảng hàng gồm 4 toà A1, A2, B1, B2. Liên hệ SGS LAND 0971 132 378 để nhận bảng giá chi tiết từng căn.' },
        { q: 'Masteri Park Place có mấy loại căn hộ?', a: 'Dự án có các loại 1PN (~53-57m²), 1PN+ (~54-59m²), 2PN (~74-83m²) và 3PN (~95-109m²), diện tích tính theo tim tường. Diện tích thông thuỷ nhỏ hơn khoảng 5-8m².' },
        { q: 'Pháp lý Masteri Park Place thế nào?', a: 'Dự án do Masterise Homes phát triển trong The Global City, sổ hồng lâu dài. SGS LAND kiểm tra pháp lý độc lập 2 lớp trước khi tư vấn khách hàng.' },
      ],
      relatedProjects: [
        { name: 'The Global City', slug: 'the-global-city' },
        { name: 'Masteri Cosmo Central', slug: 'masteri-cosmo-central' },
        { name: 'Grand Marina Saigon', slug: 'grand-marina' },
      ],
      priceRange: 'Từ 6,7 tỷ',
      projectType: 'Căn hộ cao cấp',
      scale: '4 toà A1-A2, B1-B2',
    },
    'the-global-city': {
        slug: 'the-global-city',
        name: 'The Global City',
        developer: 'Masterise Homes',
        location: 'An Phú, TP Thủ Đức, TP.HCM',
        locationSlug: 'bat-dong-san-thu-duc',
        heroDescription:
            'The Global City là đại đô thị thương mại – dịch vụ – nhà ở 117ha do Masterise Homes phát triển tại An Phú, TP Thủ Đức — vị trí đắc địa nhất khu Đông TP.HCM, cạnh Metro số 1 và đối diện Thủ Thiêm. Là tổ hợp lớn nhất của Masterise Homes, The Global City bao gồm nhà phố thương mại, biệt thự, shophouse, văn phòng, trường học và bệnh viện tiêu chuẩn quốc tế. SGS LAND hỗ trợ tư vấn và giao dịch The Global City.',
        priceRange: 'Nhà phố từ 15 tỷ — Biệt thự từ 30 tỷ',
        projectType: 'Đại Đô Thị Thương Mại Quốc Tế',
        scale: '117 ha',
        details: [
            { label: 'Chủ đầu tư', value: 'Masterise Homes' },
            { label: 'Vị trí', value: 'An Phú, TP Thủ Đức, TP.HCM' },
            { label: 'Quy mô', value: '117 ha' },
            { label: 'Kết nối Metro', value: 'Cạnh ga Metro số 1 An Phú' },
            { label: 'Loại hình', value: 'Nhà phố, biệt thự, shophouse thương mại, căn hộ Masteri Cosmo Central' },
            { label: 'Mức giá', value: 'Nhà phố 15-40 tỷ; biệt thự 30-120 tỷ; căn hộ Cosmo Central từ 6,4 tỷ' },
            { label: 'Tiêu chuẩn', value: 'Chuẩn Singapore (Capitaland, Keppel) + Foster + Partners' },
            { label: 'Pháp lý', value: 'Sổ hồng riêng, quy hoạch 1/500 rõ ràng' },
        ],
        amenities: [
            {
                title: 'Phân khu căn hộ Masteri Cosmo Central',
                items: [
                    '6 tòa tháp cao 19–29 tầng, thiết kế bởi Foster + Partners (Anh Quốc)',
                    'Mô hình All-in-One: Sống – Làm việc – Giải trí ngay trong dự án',
                    'Kênh đào nhạc nước lớn nhất Đông Nam Á tại trung tâm khu căn hộ',
                    'Loại căn: 1PN, 2PN, 3PN, Penthouse, Duplex — diện tích đa dạng',
                    'Giá từ 6,429 tỷ (mở bán 01/2026, đang nhận đặt chỗ)',
                    'Sổ hồng riêng lâu dài, pháp lý chuẩn Masterise Homes',
                    'View kênh đào, nội khu, công viên — không gian sống đẳng cấp quốc tế',
                ],
            },
            {
                title: 'Hạ tầng thương mại đẳng cấp',
                items: [
                    'Trung tâm thương mại quy mô 200.000m² (chuẩn Singapore)',
                    'Văn phòng hạng A+ — hub kinh doanh khu Đông',
                    'Trường học quốc tế (BIS, Eaton House, IVS)',
                    'Bệnh viện tiêu chuẩn 5 sao quốc tế',
                    'Khách sạn 5-6 sao với hội trường sự kiện lớn',
                    'Khu F&B đa ẩm thực tầm cỡ quốc tế',
                    'Fitness center và spa toàn diện',
                    'Khu vui chơi trẻ em & công viên cộng đồng',
                ],
            },
            {
                title: 'Kết nối vượt trội',
                items: [
                    'Ga Metro số 1 An Phú — đi vào hoạt động 2024',
                    'Cầu Thủ Thiêm 2 — kết nối Q1 trong 5 phút',
                    'Đường Mai Chí Thọ — trục huyết mạch khu Đông',
                    'Cao tốc TP.HCM – Long Thành – Dầu Giây',
                    'Tunnel Thủ Thiêm kết nối thẳng Q1',
                ],
            },
        ],
        faqs: [
            {
                q: 'The Global City có phải dự án tốt để đầu tư không?',
                a: 'The Global City là dự án chiến lược của Masterise Homes tại vị trí đắc địa nhất khu Đông TP.HCM. Với quy mô 117ha, tích hợp đầy đủ thương mại – giáo dục – y tế – ở ở, dự án tạo một đô thị tự cung tự cấp hoàn chỉnh. Phù hợp đầu tư nhà phố thương mại (cho thuê kinh doanh) và biệt thự nghỉ dưỡng-ở thực cao cấp.',
            },
            {
                q: 'Giá nhà phố thương mại The Global City là bao nhiêu?',
                a: 'Nhà phố thương mại The Global City (shophouse) có giá từ 15-40 tỷ tùy vị trí mặt tiền và diện tích. Biệt thự song lập từ 30-60 tỷ; biệt thự đơn lập từ 60-120 tỷ. Cho thuê nhà phố thương mại từ 50-200 triệu/tháng (mặt tiền trục chính). Liên hệ SGS LAND để nhận bảng giá và chính sách chiết khấu.',
            },
            {
                q: 'The Global City cách Q1 và Thủ Thiêm bao xa?',
                a: 'The Global City tại An Phú, TP Thủ Đức — cách Q1 khoảng 6-8km, di chuyển qua cầu Thủ Thiêm 2 hoặc hầm Thủ Thiêm chỉ 5-10 phút. Cách khu Thủ Thiêm khoảng 2km (kết nối đường Mai Chí Thọ). Metro số 1 ga An Phú chỉ cách 5 phút đi bộ.',
            },
            {
                q: 'Trường học và bệnh viện tại The Global City như thế nào?',
                a: 'The Global City tích hợp hệ thống giáo dục – y tế đẳng cấp: trường học quốc tế BIS (British International School), Eaton House và IVS với chương trình IB/IGCSE; bệnh viện 5 sao tiêu chuẩn quốc tế với hơn 300 giường bệnh. Đây là lợi thế lớn cho gia đình có con nhỏ và cư dân nước ngoài.',
            },
            {
                q: 'Tiêu chuẩn Singapore tại The Global City nghĩa là gì?',
                a: 'Masterise Homes hợp tác với các kiến trúc sư và nhà quy hoạch từ Singapore (từng làm việc với CapitaLand, Keppel Land) để thiết kế The Global City. Điều này có nghĩa: quy hoạch phân khu khoa học, hệ thống cây xanh – không gian công cộng đạt chuẩn, hạ tầng kỹ thuật đồng bộ và thiết kế đô thị bền vững — tương tự One North hay Sentosa Cove của Singapore.',
            },
            {
                q: 'Shophouse thương mại The Global City cho thuê được bao nhiêu tiền?',
                a: 'Shophouse mặt tiền trục chính The Global City cho thuê 50-200 triệu/tháng tùy diện tích và vị trí. Đây là mức giá tương đương mặt tiền đường lớn Q2-Q9 hiện tại. Khi hoàn thành toàn bộ (2026-2028), nhu cầu thuê kinh doanh từ 60.000+ cư dân nội khu và lưu lượng từ Metro số 1 sẽ rất cao.',
            },
            {
                q: 'The Global City đã mở bán và bàn giao chưa?',
                a: 'Các giai đoạn nhà phố thương mại và shophouse đã mở bán. Một số phân khu đã và đang bàn giao 2024-2025. Masterise Homes theo đúng tiến độ cam kết — là điểm mạnh của thương hiệu. SGS LAND cập nhật tiến độ bàn giao từng phân khu theo thời gian thực.',
            },
            {
                q: 'Trường BIS tại The Global City học phí bao nhiêu?',
                a: 'British International School (BIS) tại The Global City theo chương trình quốc tế IB/IGCSE, học phí khoảng 20-40 triệu VNĐ/tháng. IVS (International Village School) khoảng 10-20 triệu/tháng. Sự hiện diện của các trường quốc tế top-tier là lợi thế lớn thu hút cư dân expat và gia đình có con học trường quốc tế.',
            },
            {
                q: 'The Global City có cạnh tranh được với Thủ Thiêm không?',
                a: 'The Global City và Thủ Thiêm bổ trợ nhau hơn là cạnh tranh: Thủ Thiêm là trung tâm tài chính-văn phòng tương lai; The Global City là đô thị thương mại-dịch vụ-ở tích hợp. Lợi thế The Global City: Metro số 1 ngay cửa, quy mô thương mại lớn hơn (117ha vs ~50ha khu ở Thủ Thiêm), giá nhà phố vừa hơn đất Thủ Thiêm.',
            },
            {
                q: 'Vay ngân hàng mua nhà phố The Global City có thuận lợi không?',
                a: 'Pháp lý rõ ràng và Masterise Homes uy tín cao giúp vay ngân hàng dễ dàng. LTV tối đa 65-70%, kỳ hạn 20-25 năm. Techcombank và VPBank là ngân hàng chính hỗ trợ The Global City với lãi suất ưu đãi 12-18 tháng đầu. SGS LAND hỗ trợ hồ sơ vay và so sánh gói vay miễn phí.',
            },
            {
                q: 'Masteri Cosmo Central là gì? Có phải thuộc The Global City không?',
                a: 'Masteri Cosmo Central chính là phân khu căn hộ cao cấp nằm tại lõi trung tâm đại đô thị The Global City. Đây là sản phẩm căn hộ duy nhất trong hệ sinh thái The Global City, thuộc bộ sưu tập Masteri Collection. Dự án gồm 6 tòa tháp 19–29 tầng do Foster + Partners (Anh Quốc) thiết kế, mô hình All-in-One với kênh đào nhạc nước lớn nhất Đông Nam Á. Giá từ 6,429 tỷ, đang mở bán. Liên hệ SGS LAND: 0971 132 378 để nhận bảng giá.',
            },
            {
                q: 'Masteri Cosmo Central giá bao nhiêu? Loại căn hộ nào đang bán?',
                a: 'Masteri Cosmo Central mở bán từ tháng 01/2026 với giá khởi điểm từ 6,429 tỷ đồng. Cơ cấu căn: 1PN, 2PN, 3PN, Penthouse và Duplex — diện tích đa dạng phù hợp nhiều nhu cầu từ ở thực đến đầu tư. Pháp lý sổ hồng riêng lâu dài. Masterise Homes hỗ trợ lãi suất 0% giai đoạn đầu. Liên hệ SGS LAND để nhận bảng giá và chính sách ưu đãi chi tiết: 0971 132 378.',
            },
        ],
        relatedProjects: [
            { name: 'Masteri Cosmo Central', slug: 'masteri-cosmo-central' },
            { name: 'Khu Đô Thị Thủ Thiêm', slug: 'thu-thiem' },
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
        ],
    },
    'nha-pho-trung-tam': {
        slug: 'nha-pho-trung-tam',
        name: 'Nhà Phố Trung Tâm TP.HCM',
        developer: 'Nhiều Chủ Sở Hữu Cá Nhân & Tổ Chức',
        location: 'Quận 1, 3, 5, Phú Nhuận, Bình Thạnh, Gò Vấp',
        locationSlug: 'marketplace',
        heroDescription:
            'Nhà phố trung tâm TP.HCM — tài sản bất động sản ổn định giá nhất và thanh khoản cao nhất Việt Nam. Mặt tiền kinh doanh Quận 1-3, nhà hẻm xe hơi, shophouse phố cổ — đây là tài sản tích lũy bền vững qua các thế hệ với giá thuê thương mại cao, giá trị tăng đều đặn và pháp lý ổn định. SGS LAND hỗ trợ tìm kiếm, định giá AI và giao dịch nhà phố trung tâm TP.HCM.',
        priceRange: 'Nhà hẻm từ 5 tỷ — Mặt tiền Q1 từ 30 tỷ',
        projectType: 'Nhà Phố & Shophouse Nội Thành',
        scale: 'Toàn khu nội thành TP.HCM',
        details: [
            { label: 'Khu vực', value: 'Q1, Q3, Q5, Phú Nhuận, Bình Thạnh, Gò Vấp' },
            { label: 'Loại hình', value: 'Nhà mặt tiền, nhà hẻm, shophouse, nhà phố liền kề' },
            { label: 'Giá mặt tiền Q1', value: '500-2.000 triệu/m²' },
            { label: 'Giá hẻm xe hơi Q3', value: '100-250 triệu/m²' },
            { label: 'Cho thuê mặt bằng', value: '50-300 triệu/tháng (mặt tiền lớn)' },
            { label: 'Pháp lý', value: 'Sổ hồng chính chủ, thổ cư ổn định' },
            { label: 'Đặc điểm', value: 'Tài sản tích lũy bền vững qua thế hệ' },
            { label: 'Phù hợp', value: 'Kinh doanh, đầu tư cho thuê, tích lũy' },
        ],
        amenities: [
            {
                title: 'Ưu điểm nhà phố nội thành',
                items: [
                    'Vị trí trung tâm, tiếp cận mọi tiện ích thành phố',
                    'Cho thuê mặt bằng kinh doanh giá cao, ổn định',
                    'Pháp lý sổ đỏ thổ cư — an toàn, không thời hạn',
                    'Giá trị tăng bền vững 8-15%/năm trong 30 năm qua',
                    'Đa dạng hóa danh mục — ở + kinh doanh + cho thuê',
                    'Thanh khoản tốt, dễ bán lại bất kỳ thời điểm',
                    'Không mất phí quản lý chung cư, tự chủ hoàn toàn',
                    'Có thể xây mới, sửa chữa tự do theo nhu cầu',
                ],
            },
            {
                title: 'Khu vực nổi bật',
                items: [
                    'Quận 1 (Nguyễn Huệ, Đồng Khởi) — đắt giá nhất VN',
                    'Quận 3 (Võ Văn Tần, Nam Kỳ Khởi Nghĩa) — nhà phố cổ',
                    'Phú Nhuận (Phan Xích Long, Hoàng Văn Thụ) — sầm uất',
                    'Bình Thạnh (Đinh Bộ Lĩnh, Xô Viết Nghệ Tĩnh) — gần Landmark',
                    'Quận 5 (Châu Văn Liêm, Trần Hưng Đạo) — trung tâm người Hoa',
                    'Gò Vấp (Lê Văn Thọ, Quang Trung) — đang tăng giá mạnh',
                ],
            },
        ],
        faqs: [
            {
                q: 'Nên mua nhà phố hay căn hộ tại TP.HCM để đầu tư?',
                a: 'Nhà phố trung tâm có ba lợi thế so với căn hộ: (1) Pháp lý sổ đỏ thổ cư — không thời hạn, không mất phí quản lý; (2) Thu nhập kép — vừa ở, vừa cho thuê mặt bằng; (3) Giá trị tăng trưởng dài hạn bền vững hơn. Nhược điểm: giá cao hơn căn hộ cùng vị trí 30-50%. Phù hợp nhà đầu tư tài chính mạnh, tầm nhìn dài hạn.',
            },
            {
                q: 'Giá mặt tiền Quận 1 TP.HCM hiện nay là bao nhiêu?',
                a: 'Giá mặt tiền Quận 1 là cao nhất Việt Nam: đường Nguyễn Huệ, Đồng Khởi 1.000-2.000 triệu/m²; Lê Lợi, Lê Thánh Tôn 500-1.000 triệu/m²; các đường nhánh 300-600 triệu/m². Cho thuê mặt bằng kinh doanh mặt tiền Q1: 100-500 triệu/tháng. Đây là tài sản hiếm và tăng giá bền vững nhất thị trường.',
            },
            {
                q: 'Nhà hẻm xe hơi Quận 3, Phú Nhuận giá bao nhiêu?',
                a: 'Nhà hẻm xe hơi (hẻm 4-6m) tại Q3 từ 100-200 triệu/m²; tại Phú Nhuận 80-150 triệu/m²; tại Bình Thạnh 60-120 triệu/m². Nhà 4x15m (60m²) Q3 dao động 6-12 tỷ. Đây là phân khúc phổ biến nhất — vừa ở thực, vừa tích lũy tài sản với ngân sách 5-15 tỷ.',
            },
            {
                q: 'SGS LAND hỗ trợ tìm nhà phố trung tâm như thế nào?',
                a: 'SGS LAND cung cấp: (1) Tìm kiếm nhà phố theo yêu cầu — khu vực, giá, diện tích, pháp lý; (2) Định giá AI miễn phí — so sánh với 500+ giao dịch thực trong bán kính 500m; (3) Kiểm tra pháp lý sổ đỏ độc lập trước giao dịch; (4) Hỗ trợ đàm phán giá và điều kiện hợp đồng; (5) Kết nối công chứng, ngân hàng vay vốn lãi suất tốt.',
            },
            {
                q: 'Tại sao nhà phố nội thành TP.HCM luôn tăng giá?',
                a: 'Ba lý do cốt lõi: (1) Quỹ đất nội thành hữu hạn — không thể xây mới mặt tiền lớn; (2) Lạm phát đồng tiền dài hạn đẩy giá tài sản thực tăng; (3) TP.HCM là đầu tàu kinh tế Việt Nam — nhu cầu mặt bằng kinh doanh và ở thực liên tục tăng theo dân số và GDP. Trong 30 năm qua, nhà phố nội thành TP.HCM tăng giá trung bình 12-18%/năm.',
            },
            {
                q: 'Nhà phố Gò Vấp có đang tăng giá nhanh không năm 2025-2026?',
                a: 'Gò Vấp đang tăng giá mạnh nhất trong các quận nội thành: 15-25%/năm nhờ hạ tầng hoàn thiện (Metro số 2 quy hoạch đi qua, đường Lê Văn Thọ, Quang Trung mở rộng). Nhà hẻm xe hơi Q. Gò Vấp từ 4-8 tỷ, mặt tiền 6-12 tỷ — còn rẻ hơn 30-40% so với Q3 và Phú Nhuận lân cận.',
            },
            {
                q: 'Mua nhà phố làm homestay hay Airbnb TP.HCM có hiệu quả không?',
                a: 'Nhà phố Q1-3 vị trí du lịch cho thuê Airbnb rất hiệu quả: 1,5-5 triệu/đêm, công suất 70-90%. ROI homestay cao hơn cho thuê dài hạn 30-50%. Tuy nhiên cần đăng ký kinh doanh, xin giấy phép lưu trú và tuân thủ quy định phòng cháy chữa cháy. SGS LAND tư vấn quy trình hợp pháp hóa homestay.',
            },
            {
                q: 'Kiểm tra pháp lý nhà phố cũ TP.HCM cần lưu ý những gì?',
                a: 'Sáu điểm cần kiểm tra khi mua nhà phố cũ: (1) Sổ đỏ/hồng thổ cư — không phải sổ tạm; (2) Không nằm trong quy hoạch lộ giới, hành lang bảo vệ kênh rạch; (3) Không tranh chấp thừa kế, thế chấp ngân hàng; (4) Diện tích sổ đỏ khớp hiện trạng; (5) Không vi phạm xây dựng; (6) Nộp đủ thuế trước bạ. SGS LAND kiểm tra miễn phí.',
            },
            {
                q: 'Giá nhà phố mặt tiền Phú Nhuận hiện tại là bao nhiêu?',
                a: 'Mặt tiền Phú Nhuận (Phan Xích Long, Hoàng Văn Thụ, Phổ Quang): 200-500 triệu/m². Nhà 4x15m (60m²) mặt tiền khoảng 12-30 tỷ; nhà hẻm xe hơi (4m+) 80-150 triệu/m², nhà 60m² khoảng 5-9 tỷ. Phú Nhuận sôi động bởi F&B, văn phòng và gần sân bay Tân Sơn Nhất.',
            },
            {
                q: 'SGS LAND định giá AI nhà phố nội thành chính xác cỡ nào?',
                a: 'Hệ thống định giá AI của SGS LAND phân tích 500+ giao dịch thực trong bán kính 500m, 12 tháng gần nhất, điều chỉnh theo diện tích, chiều rộng mặt tiền, số tầng, hướng nhà, lộ giới, tình trạng pháp lý. Độ chính xác đạt 92% so với giá giao dịch thực. Định giá miễn phí trong 5 phút ngay trên ứng dụng SGS LAND.',
            },
        ],
        relatedProjects: [
            { name: 'Khu Đô Thị Thủ Thiêm', slug: 'thu-thiem' },
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
            { name: 'The Global City', slug: 'the-global-city' },
        ],
    },
    'vinhomes-can-gio': {
        slug: 'vinhomes-can-gio',
        name: 'Vinhomes Cần Giờ',
        developer: 'Vinhomes (Tập Đoàn Vingroup)',
        location: 'Huyện Cần Giờ, TP.HCM',
        locationSlug: 'marketplace',
        heroDescription:
            'Vinhomes Cần Giờ — còn gọi là Vinhomes Green Paradise — là siêu đô thị du lịch nghỉ dưỡng lấn biển quy mô 2.870ha do Vinhomes (Vingroup) phát triển tại huyện Cần Giờ, TP.HCM. Đây là dự án bất động sản lớn nhất Việt Nam từ trước đến nay, nằm kế Khu dự trữ sinh quyển thế giới Cần Giờ — UNESCO công nhận năm 2000. Với cầu Cần Giờ vốn 11.000 tỷ đồng dự kiến hoàn thành 2028, thời gian từ trung tâm TP.HCM đến dự án rút xuống còn 30-40 phút. SGS LAND là đại lý phân phối chính thức, hỗ trợ đặt chỗ ưu tiên và tư vấn đầu tư miễn phí.',
        priceRange: 'Từ 12 tỷ đồng',
        projectType: 'Siêu Đô Thị Lấn Biển',
        scale: '2.870 ha',
        details: [
            { label: 'Chủ đầu tư', value: 'Vinhomes (Tập đoàn Vingroup)' },
            { label: 'Quy mô', value: '2.870 ha — lớn nhất Việt Nam' },
            { label: 'Vị trí', value: 'Huyện Cần Giờ, TP.HCM' },
            { label: 'Khoảng cách TP.HCM', value: '~30-40 phút (sau cầu Cần Giờ 2028)' },
            { label: 'Loại hình', value: 'Biệt thự biển, shophouse biển, căn hộ resort, condotel, cao tầng' },
            { label: 'Mức giá tham khảo', value: 'Từ 12 tỷ (căn hộ) — biệt thự biển 50-200 tỷ' },
            { label: 'Pháp lý', value: 'Thủ tướng phê duyệt chủ trương; quy hoạch 1/500 theo từng phân kỳ' },
            { label: 'Tiến độ', value: 'Khởi công 2025 — mở bán phân kỳ 2026 — bàn giao từ 2028' },
        ],
        amenities: [
            {
                title: 'Tiện ích nghỉ dưỡng đẳng cấp quốc tế',
                items: [
                    'Bãi biển nhân tạo dài 7km — lớn nhất Việt Nam',
                    'Vinwonders Cần Giờ — công viên giải trí đại dương',
                    'Sân golf 18 lỗ chuẩn quốc tế ven biển',
                    'Marina & bến du thuyền — cảng tàu cao tốc Sài Gòn – Cần Giờ 30 phút',
                    'Chuỗi resort & khách sạn 5 sao (Vinpearl, Marriott, Intercontinental)',
                    'Trung tâm hội nghị & MICE quốc tế',
                    'Bệnh viện Vinmec đa khoa trong khuôn viên',
                    'Trường học Vinschool liên cấp quốc tế',
                    'Vincom Mega Mall — trung tâm thương mại tích hợp',
                    'Công viên sinh thái rừng ngập mặn UNESCO',
                ],
            },
            {
                title: 'Hạ tầng kết nối chiến lược',
                items: [
                    'Cầu Cần Giờ: vốn 11.000 tỷ, khởi công 2025, hoàn thành 2028',
                    'Tuyến tàu cao tốc Sài Gòn – Cần Giờ (25-30 phút)',
                    'Đường Rừng Sác – Cần Giờ đang nâng cấp 4 làn xe',
                    'Phà Bình Khánh kết nối hiện tại (45-60 phút từ Q4)',
                    'Cao tốc Bến Lức – Long Thành kết nối vùng kinh tế phía Nam',
                    'Sân bay Long Thành (30 phút) — cửa ngõ quốc tế Đông Nam Bộ',
                ],
            },
        ],
        faqs: [
            {
                q: 'Vinhomes Cần Giờ là dự án gì và quy mô như thế nào?',
                a: 'Vinhomes Cần Giờ (tên thương mại Vinhomes Green Paradise) là siêu đô thị du lịch nghỉ dưỡng lấn biển 2.870ha do Vinhomes – Vingroup phát triển tại huyện Cần Giờ, TP.HCM. Đây là dự án bất động sản có quy mô lớn nhất Việt Nam từ trước đến nay, tích hợp nhà ở, nghỉ dưỡng, thương mại, giải trí và dịch vụ đẳng cấp quốc tế trong một đô thị biển hoàn chỉnh.',
            },
            {
                q: 'Giá bán Vinhomes Cần Giờ bao nhiêu tiền năm 2026?',
                a: 'Giá tham khảo Vinhomes Cần Giờ năm 2026: căn hộ resort từ 12-25 tỷ; shophouse biển từ 20-50 tỷ; biệt thự song lập từ 30-80 tỷ; biệt thự đơn lập mặt biển từ 80-200 tỷ; condotel từ 8-15 tỷ. Đây là giá mở bán phân kỳ đầu — kỳ vọng tăng 20-40% sau khi cầu Cần Giờ hoàn thành (2028). Liên hệ SGS LAND để đặt chỗ ưu tiên phân kỳ 1.',
            },
            {
                q: 'Vinhomes Cần Giờ cách trung tâm TP.HCM bao xa và đi bằng cách nào?',
                a: 'Hiện tại: cách Q1 khoảng 50km, qua phà Bình Khánh mất 45-60 phút. Sau 2028 khi cầu Cần Giờ hoàn thành: chỉ còn 30-40 phút qua cầu dài 3,2km vốn 11.000 tỷ đồng. Ngoài ra, tuyến tàu cao tốc Sài Gòn – Cần Giờ đang được quy hoạch rút ngắn xuống 25-30 phút. Hạ tầng kết nối là yếu tố then chốt làm tăng giá trị dự án.',
            },
            {
                q: 'Cầu Cần Giờ khi nào hoàn thành và ảnh hưởng thế nào đến giá BĐS?',
                a: 'Cầu Cần Giờ có tổng vốn đầu tư 11.000 tỷ đồng, chính thức khởi công năm 2025 và dự kiến hoàn thành vào năm 2028. Cầu dài 3,2km nối huyện Nhà Bè và Cần Giờ, rút ngắn thời gian di chuyển xuống còn 15-20 phút. Lịch sử tại Nhơn Trạch và Long An cho thấy BĐS tăng 30-60% trong vòng 2 năm sau khi hạ tầng hoàn chỉnh.',
            },
            {
                q: 'Vinhomes Cần Giờ có những loại sản phẩm bất động sản nào?',
                a: 'Vinhomes Cần Giờ cung cấp đa dạng sản phẩm: (1) Căn hộ resort view biển từ 12 tỷ; (2) Condotel vận hành bởi chuỗi Vinpearl/Marriott; (3) Shophouse biển mặt tiền đại lộ từ 20 tỷ; (4) Biệt thự song lập/đơn lập ven biển từ 30 tỷ; (5) Villa mặt biển ultra-luxury từ 80 tỷ; (6) Tổ hợp căn hộ cao tầng view toàn cảnh. Mỗi phân kỳ mở bán một phân khúc sản phẩm riêng.',
            },
            {
                q: 'Pháp lý Vinhomes Cần Giờ đến đâu rồi và có an toàn để đầu tư?',
                a: 'Vinhomes Cần Giờ đã được Thủ tướng Chính phủ phê duyệt chủ trương đầu tư. Quy hoạch 1/500 đang được hoàn thiện và phê duyệt theo từng phân kỳ. Vinhomes (Vingroup) là tập đoàn BĐS số 1 Việt Nam với lịch sử pháp lý sạch, bàn giao đúng tiến độ. SGS LAND kiểm tra pháp lý từng phân kỳ miễn phí trước khi khách đặt cọc.',
            },
            {
                q: 'Tại sao Vinhomes Cần Giờ được gọi là siêu dự án lớn nhất Việt Nam?',
                a: 'Vinhomes Cần Giờ 2.870ha vượt xa bất kỳ dự án BĐS nào tại Việt Nam về quy mô — gấp 10 lần Vinhomes Grand Park (271ha), gấp 24 lần The Global City (117ha). Dự án tích hợp bãi biển nhân tạo 7km, Vinwonders, sân golf 18 lỗ, marina và chuỗi resort 5 sao — tạo nên đô thị biển hoàn chỉnh và lớn nhất chưa từng có tại Việt Nam.',
            },
            {
                q: 'Đầu tư Vinhomes Cần Giờ có tiềm năng sinh lời không?',
                a: 'Ba yếu tố tạo tiềm năng sinh lời: (1) Hạ tầng: cầu Cần Giờ 2028 + tàu cao tốc — kết nối rút ngắn kéo giá tăng 30-60%; (2) Scarcity: đất biển TP.HCM ngày càng hiếm, không thể tái tạo; (3) Vinhomes brand: dự án Vinhomes thường tăng 15-30% từ lúc mở bán đến bàn giao. Kỳ vọng tăng giá 3-5 năm: 40-80% từ mức giá mở bán phân kỳ đầu.',
            },
            {
                q: 'Vinhomes Cần Giờ có ảnh hưởng đến sinh quyển UNESCO Cần Giờ không?',
                a: 'Vinhomes Cần Giờ được phát triển theo đúng quy hoạch của TP.HCM, trong vùng phát triển đô thị được phê duyệt — không xâm phạm vùng lõi và vùng đệm bảo vệ nghiêm ngặt của Khu dự trữ sinh quyển thế giới Cần Giờ (UNESCO 2000). Dự án lấn biển ra ngoài đất liền, bảo tồn nguyên vẹn hệ sinh thái rừng ngập mặn đặc trưng.',
            },
            {
                q: 'SGS LAND hỗ trợ khách hàng mua Vinhomes Cần Giờ như thế nào?',
                a: 'SGS LAND là đại lý phân phối chính thức Vinhomes Cần Giờ — hỗ trợ toàn diện: (1) Đặt chỗ ưu tiên phân kỳ đầu trước khi mở bán rộng rãi; (2) Tư vấn chiến lược đầu tư theo ngân sách và mục tiêu; (3) Kiểm tra pháp lý từng phân khu miễn phí; (4) Kết nối vay ngân hàng lãi suất tốt (VCB, BIDV, TCB, VPBank) tối đa 70%; (5) Không thu phí từ người mua — hoa hồng do Vinhomes trả. Hotline 0971 132 378.',
            },
            {
                q: 'So sánh Vinhomes Cần Giờ và Vinhomes Grand Park — đâu nên mua năm 2026?',
                a: 'Vinhomes Grand Park (271ha, Thủ Đức): đã bàn giao, sổ hồng đầy đủ, Metro số 1, từ 3 tỷ — phù hợp ở thực, an toàn, thanh khoản cao. Vinhomes Cần Giờ (2.870ha, Cần Giờ): mở bán từ 12 tỷ, tiềm năng tăng 40-80% trong 3-5 năm, nghỉ dưỡng-đầu tư cao cấp. Chọn Grand Park nếu ưu tiên ở thực an toàn; chọn Cần Giờ nếu ưu tiên đầu tư biên lợi nhuận cao.',
            },
        ],
        relatedProjects: [
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'The Global City', slug: 'the-global-city' },
        ],
    },
    'diamond-sky-van-phuc-city': {
        slug: 'diamond-sky-van-phuc-city',
        name: 'Diamond Sky – Vạn Phúc City',
        developer: 'Tập đoàn Vạn Phúc (Van Phuc Group)',
        location: 'KĐT Vạn Phúc City, Hiệp Bình Phước, TP Thủ Đức, TP.HCM',
        locationSlug: 'bat-dong-san-thu-duc',
        heroDescription:
            'Diamond Sky là tháp căn hộ cao tầng điểm nhấn 20 tầng nằm trong Khu đô thị Vạn Phúc City — đại đô thị 198ha ven sông Sài Gòn do Tập đoàn Vạn Phúc phát triển tại phường Hiệp Bình Phước, TP Thủ Đức, TP.HCM (giáp ranh Thuận An, Bình Dương). Dự án cung cấp 1–3 phòng ngủ với view sông Sài Gòn, hồ Đại Nhật và kênh Sông Trăng, sổ hồng lâu dài, dự kiến mở bán Q3/2026 và bàn giao 2028. SGS LAND là đại lý phân phối chính thức Diamond Sky.',
        priceRange: 'Từ 9,6 tỷ (1PN ~ 50m²) – Từ 190 triệu/m²',
        projectType: 'Căn Hộ Cao Tầng View Sông',
        scale: '20 tầng (KĐT 198 ha)',
        details: [
            { label: 'Tên dự án', value: 'Diamond Sky – Vạn Phúc City' },
            { label: 'Chủ đầu tư', value: 'Tập đoàn Vạn Phúc (Van Phuc Group)' },
            { label: 'Vị trí', value: 'Đường số 15 & số 34, Hiệp Bình Phước, TP Thủ Đức, TP.HCM' },
            { label: 'Quy mô tháp', value: '20 tầng nổi + tầng mái tiện ích, ~520 căn hộ' },
            { label: 'Quy mô KĐT Vạn Phúc City', value: '198 ha, ven sông Sài Gòn' },
            { label: 'Loại hình', value: 'Căn hộ chung cư cao tầng (1PN, 2PN, 3PN)' },
            { label: 'Diện tích căn hộ', value: '50 – 110 m²' },
            { label: 'Giá tham khảo', value: 'Từ 9,6 tỷ/căn — từ 190 triệu/m² (hạng sang)' },
            { label: 'Pháp lý', value: 'Sổ hồng riêng lâu dài từng căn' },
            { label: 'Tiến độ dự kiến', value: 'Mở bán Q3/2026 – Bàn giao Q4/2028' },
            { label: 'Khoảng cách Quận 1', value: '~25 phút qua Phạm Văn Đồng / Quốc lộ 13' },
            { label: 'Khoảng cách Thuận An, Bình Dương', value: '~10 phút qua cầu Vĩnh Bình / QL13' },
        ],
        amenities: [
            {
                title: 'Tiện ích nội khu Diamond Sky',
                items: [
                    'Hồ bơi vô cực tầng mái (Rooftop Ban Công Trăng)',
                    'Vườn BBQ Hoàng Hôn & Vườn BBQ Ánh Sao trên cao',
                    'Bình Minh Lounge & Vườn Trên Mây panoramic',
                    'Lối Dạo Bộ Hoa Nắng, Vườn An Nhiên thiền định',
                    'Phòng gym & yoga tiêu chuẩn quốc tế',
                    '2 sân tennis + sân bóng rổ tầng đế',
                    'Hồ bơi người lớn 25m + hồ bơi trẻ em',
                    'Sảnh lobby đôi, lễ tân 24/7, smart access',
                    'Hầm xe 2 tầng kết nối thang máy thẳng lên căn hộ',
                ],
            },
            {
                title: 'Tiện ích Vạn Phúc City 198 ha',
                items: [
                    'Hồ Đại Nhật trung tâm 16ha với nhạc nước',
                    'Kênh Sông Trăng & quảng trường trung tâm',
                    'TTTM Vạn Phúc Mall, phố thương mại Lakeview',
                    'Trường liên cấp Western Australia (WASS) trong khu',
                    'Bệnh viện quốc tế Hạnh Phúc, phòng khám đa khoa',
                    'Công viên cây xanh hơn 30 ha, đường ven sông 4 km',
                    'Bến du thuyền, marina sông Sài Gòn',
                ],
            },
            {
                title: 'Kết nối hạ tầng chiến lược',
                items: [
                    'Mặt tiền Quốc lộ 13 mở rộng 60m (đang nâng cấp 2026–2028)',
                    'Cách Vành đai 3 TP.HCM 4 km — kết nối toàn vùng Đông Nam Bộ',
                    'Cầu Vĩnh Bình & cầu Bình Triệu nối Bình Dương – TP.HCM',
                    '~25 phút về Quận 1 qua Phạm Văn Đồng / cầu Bình Lợi',
                    '~30 phút sân bay Tân Sơn Nhất',
                    'Tuyến metro số 3B (quy hoạch) chạy dọc QL13',
                    'Cao tốc TP.HCM – Thủ Dầu Một – Chơn Thành (đang triển khai)',
                ],
            },
        ],
        faqs: [
            {
                q: 'Diamond Sky Vạn Phúc City ở đâu?',
                a: 'Diamond Sky tọa lạc trong Khu đô thị Vạn Phúc City — phường Hiệp Bình Phước, TP Thủ Đức, TP.HCM, ven sông Sài Gòn, mặt tiền Quốc lộ 13. Vị trí giáp ranh TP Thuận An (Bình Dương), cách trung tâm Quận 1 khoảng 25 phút và Thuận An khoảng 10 phút di chuyển.',
            },
            {
                q: 'Giá căn hộ Diamond Sky bao nhiêu tiền năm 2026?',
                a: 'Giá tham khảo Diamond Sky từ 190 triệu/m² (phân khúc hạng sang ven sông). Căn 1 phòng ngủ (~50m²) từ 9,6 tỷ; căn 2 phòng ngủ (70–80m²) từ 13,5 – 15,5 tỷ; căn 3 phòng ngủ (95–110m²) từ 18,2 – 21 tỷ; penthouse tầng 20 từ 25 tỷ. Chính sách thanh toán 18 đợt kéo dài 30 tháng, ngân hàng VCB – BIDV – TCB hỗ trợ vay tới 70% và ân hạn gốc 24 tháng.',
            },
            {
                q: 'Diamond Sky có bao nhiêu tầng và bao nhiêu căn hộ?',
                a: 'Diamond Sky cao 20 tầng nổi cộng 1 tầng mái tiện ích, cung cấp khoảng 520 căn hộ. Tầng 5–19 là tầng căn hộ điển hình với 17 căn/sàn (mã căn A1–A12, B1–B11, C1–C7, P1–P4); tầng 20 là tầng penthouse với 11 căn diện tích lớn; tầng mái dành riêng cho tiện ích cộng đồng (BBQ, lounge, sky garden).',
            },
            {
                q: 'Diamond Sky bàn giao năm nào?',
                a: 'Theo kế hoạch của Tập đoàn Vạn Phúc, Diamond Sky mở bán chính thức Quý 3/2026, cất nóc Quý 2/2028 và bàn giao căn hộ thô + hoàn thiện cơ bản trong Quý 4/2028. Cư dân chính thức về ở dự kiến đầu năm 2029.',
            },
            {
                q: 'Căn hộ Diamond Sky có sổ hồng không?',
                a: 'Có. Diamond Sky được cấp sổ hồng riêng (Giấy chứng nhận quyền sở hữu) lâu dài cho từng căn hộ, áp dụng cho cả người mua trong nước và người nước ngoài (theo hạn mức 30% mỗi tòa, 50 năm gia hạn). Tập đoàn Vạn Phúc cam kết bàn giao sổ trong vòng 12 tháng kể từ ngày nhận nhà.',
            },
            {
                q: 'Vạn Phúc City là khu đô thị của ai và có quy mô như thế nào?',
                a: 'Vạn Phúc City là đại đô thị 198 ha ven sông Sài Gòn do Tập đoàn Vạn Phúc (Van Phuc Group, thành lập 1995) làm chủ đầu tư từ năm 2004. Khu đô thị có hồ Đại Nhật 16ha, hơn 7.000 căn nhà phố – biệt thự đã bàn giao, trường WASS, TTTM Vạn Phúc Mall và bến du thuyền. Diamond Sky là tháp căn hộ cao tầng đầu tiên trong giai đoạn lõi đô thị.',
            },
            {
                q: 'Diamond Sky có view sông Sài Gòn không?',
                a: 'Có. Diamond Sky nằm trên trục view trực tiếp sông Sài Gòn ở mặt Đông – Đông Nam, view hồ Đại Nhật ở mặt Bắc và view kênh Sông Trăng nội khu ở mặt Tây. Khoảng 60% căn hộ có view sông trực tiếp; 100% căn hộ tầng 10 trở lên đều có view nước (sông hoặc hồ).',
            },
            {
                q: 'Diện tích căn hộ Diamond Sky từ bao nhiêu m²?',
                a: 'Diện tích thông thuỷ Diamond Sky: 1 phòng ngủ từ 50–55 m²; 2 phòng ngủ từ 68–82 m²; 3 phòng ngủ từ 95–110 m²; penthouse tầng 20 từ 130–180 m². Tỷ lệ căn 2PN chiếm khoảng 55% tổng số căn — phù hợp gia đình trẻ và nhà đầu tư cho thuê.',
            },
            {
                q: 'Từ Diamond Sky đến trung tâm TP.HCM mất bao lâu?',
                a: 'Từ Diamond Sky về trung tâm Quận 1 mất khoảng 25 phút theo trục Phạm Văn Đồng – cầu Bình Lợi (12 km). Đi sân bay Tân Sơn Nhất khoảng 30 phút, đến Landmark 81 (Bình Thạnh) 15 phút, đến TP Thuận An (Bình Dương) chỉ 10 phút qua cầu Vĩnh Bình.',
            },
            {
                q: 'Diamond Sky có phù hợp để đầu tư cho thuê không?',
                a: 'Diamond Sky thuộc phân khúc hạng sang ven sông, phù hợp cho thuê chuyên gia cao cấp và lưu trú dài hạn: (1) Trong KĐT Vạn Phúc City đông cư dân thượng lưu, có TTTM, trường quốc tế WASS — nhu cầu thuê ổn định; (2) Mặt tiền QL13 và gần các KCN Bình Dương — thu hút giám đốc/chuyên gia cấp cao Hàn, Nhật, Singapore; (3) Giá thuê tham khảo 1PN 30–40 triệu/tháng, 2PN 55–75 triệu/tháng, 3PN 90–120 triệu/tháng — tỷ suất 3,5–4,5%/năm, kèm tiềm năng tăng giá vốn 8–12%/năm khi khu trung tâm Vạn Phúc City hoàn thiện 2028.',
            },
        ],
        relatedProjects: [
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
            { name: 'The Global City', slug: 'the-global-city' },
            { name: 'BĐS Thủ Đức', slug: 'bat-dong-san-thu-duc' },
        ],
    },
};
