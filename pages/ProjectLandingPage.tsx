import React, { useState } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { SeoHead } from '../components/SeoHead';

const PROJECT_SEO_META: Record<string, { title: string; description: string }> = {
    'aqua-city': {
        title: 'Aqua City Novaland | Căn Hộ, Biệt Thự Đồng Nai - SGS LAND',
        description: 'Aqua City Novaland Đồng Nai: tổng quan dự án, vị trí, tiện ích đẳng cấp, bảng giá và pháp lý cập nhật. Tư vấn và đặt chỗ miễn phí tại SGS LAND.',
    },
    'izumi-city': {
        title: 'Izumi City Nam Long | Đô Thị Chuẩn Nhật Bản Đồng Nai - SGS LAND',
        description: 'Izumi City Nam Long Biên Hòa: đô thị tích hợp 170ha chuẩn Nhật Bản, siêu thị Fuji Mart, trường học Nhật. Bảng giá nhà phố, biệt thự và tư vấn tại SGS LAND.',
    },
    'manhattan': {
        title: 'Grand Manhattan Novaland | Căn Hộ Hạng Sang Novaland TP.HCM - SGS LAND',
        description: 'Grand Manhattan Novaland: căn hộ hạng sang biểu tượng của Novaland tại trung tâm TP.HCM, từ 120 triệu/m². Xem bảng giá, penthouse và sky villa tại SGS LAND.',
    },
    'vinhomes-grand-park': {
        title: 'Vinhomes Grand Park | Siêu Đô Thị 271ha Thủ Đức - SGS LAND',
        description: 'Vinhomes Grand Park Quận 9 TP Thủ Đức: căn hộ, shophouse, biệt thự siêu đô thị 271ha. Công viên 36ha, Metro số 1, Vinmec, Vinschool. Bảng giá tại SGS LAND.',
    },
    'vinhomes-central-park': {
        title: 'Vinhomes Central Park | Căn Hộ Cao Cấp Bình Thạnh Landmark 81 - SGS LAND',
        description: 'Vinhomes Central Park Bình Thạnh: 44 tòa cao tầng, Landmark 81, bể bơi vô cực ven sông Sài Gòn. Căn hộ từ 50 triệu/m², cho thuê 15-60 triệu/tháng. Tư vấn tại SGS LAND.',
    },
    'thu-thiem': {
        title: 'Khu Đô Thị Thủ Thiêm | BĐS Hạng Sang Trung Tâm Tài Chính - SGS LAND',
        description: 'Bất động sản Khu Đô Thị Mới Thủ Thiêm 657ha — trung tâm tài chính tương lai TP.HCM. Empire City, Metropole, The River. Giá từ 80 triệu/m². Tư vấn tại SGS LAND.',
    },
    'son-kim-land': {
        title: 'Sơn Kim Land | BĐS Thương Mại Cao Cấp TP.HCM & Hà Nội - SGS LAND',
        description: 'Sơn Kim Land — danh mục BĐS cao cấp: Gem Riverside Q4, Metropole Thủ Thiêm, Seasons Avenue HN. GEM Center, GS25. Giá 40-150 triệu/m². Tư vấn tại SGS LAND.',
    },
    'masterise-homes': {
        title: 'Masterise Homes | Căn Hộ Hạng Sang Masteri, Lumière, Grand Marina - SGS LAND',
        description: 'Masterise Homes — BĐS hạng sang Việt Nam: Masteri Thảo Điền, Lumière Boulevard, Grand Marina Saigon. Giá 60-300 triệu/m². Vận hành bởi chuỗi khách sạn 5 sao. Tư vấn SGS LAND.',
    },
    'the-global-city': {
        title: 'The Global City Masterise | Đại Đô Thị 117ha An Phú Thủ Đức - SGS LAND',
        description: 'The Global City Masterise Homes An Phú Thủ Đức: đại đô thị 117ha chuẩn Singapore, cạnh Metro số 1. Nhà phố từ 15 tỷ, biệt thự từ 30 tỷ. Tư vấn tại SGS LAND.',
    },
    'nha-pho-trung-tam': {
        title: 'Nhà Phố Trung Tâm TP.HCM | Mặt Tiền, Nhà Hẻm, Shophouse - SGS LAND',
        description: 'Mua bán nhà phố trung tâm TP.HCM: mặt tiền Q1 từ 500 triệu/m², nhà hẻm Q3 từ 100 triệu/m². Định giá AI miễn phí, kiểm tra pháp lý độc lập tại SGS LAND.',
    },
};

interface ProjectConfig {
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

const PROJECT_CONFIG: Record<string, ProjectConfig> = {
    'aqua-city': {
        slug: 'aqua-city',
        name: 'Aqua City Novaland',
        developer: 'Novaland Group',
        location: 'Nhơn Trạch, Đồng Nai',
        locationSlug: 'bat-dong-san-dong-nai',
        heroDescription:
            'Aqua City là đại đô thị sinh thái quy mô 1.000ha do Novaland phát triển tại Nhơn Trạch, Đồng Nai. Với vị trí cách trung tâm TP.HCM chỉ 30 phút qua cầu Nhơn Trạch, Aqua City đang trở thành lựa chọn hàng đầu cho cư dân TP.HCM tìm kiếm không gian sống xanh, tiện nghi và đầu tư dài hạn. SGS LAND hỗ trợ tư vấn và giao dịch Aqua City chuyên nghiệp.',
        priceRange: 'Từ 3 tỷ — 50 tỷ đồng',
        projectType: 'Đại Đô Thị Sinh Thái',
        scale: '1.000 ha',
        details: [
            { label: 'Chủ đầu tư', value: 'Novaland Group' },
            { label: 'Quy mô', value: '1.000 ha' },
            { label: 'Vị trí', value: 'Nhơn Trạch, Đồng Nai' },
            { label: 'Khoảng cách TP.HCM', value: '~30 phút (cầu Nhơn Trạch)' },
            { label: 'Loại hình', value: 'Căn hộ, Nhà phố, Biệt thự, Shophouse' },
            { label: 'Mức giá tham khảo', value: 'Từ 3 tỷ — 50+ tỷ đồng' },
            { label: 'Pháp lý', value: 'Sổ hồng riêng' },
            { label: 'Tiến độ', value: 'Đang bàn giao nhiều phân khu' },
        ],
        amenities: [
            {
                title: 'Tiện ích đẳng cấp',
                items: [
                    'Hơn 100.000m² mặt nước (sông, hồ, kênh)',
                    'Trung tâm thương mại Nova Mall',
                    'Bệnh viện đa khoa 500 giường',
                    'Trường học liên cấp quốc tế',
                    'Sân golf 18 lỗ ven sông',
                    'Marina & bến thuyền cao cấp',
                    'Chuỗi resort & spa 5 sao',
                    'Công viên chủ đề, khu vui chơi trẻ em',
                ],
            },
            {
                title: 'Kết nối hạ tầng',
                items: [
                    'Cầu Nhơn Trạch (đang hoàn thiện) — rút ngắn 15 phút vào TP.HCM',
                    'Cao tốc Bến Lức – Long Thành kết nối trực tiếp',
                    'Sân bay Long Thành chỉ 20 phút',
                    'Tuyến Metro số 1 kết nối về tương lai',
                    'Bến phà Bình Khánh — kết nối Cần Giờ, TP.HCM',
                ],
            },
        ],
        faqs: [
            {
                q: 'Aqua City Novaland có đáng mua không?',
                a: 'Aqua City là dự án đại đô thị sinh thái quy mô nhất của Novaland, với hơn 100.000m² mặt nước, tiện ích 5 sao và vị trí đắc địa kế cận TP.HCM. Sau giai đoạn tái cơ cấu của Novaland, dự án đã trở lại hoạt động bình thường với nhiều phân khu đang bàn giao. Đây là lựa chọn phù hợp cho người mua ở thực và đầu tư dài hạn.',
            },
            {
                q: 'Giá căn hộ Aqua City hiện nay là bao nhiêu?',
                a: 'Giá căn hộ Aqua City tham khảo: căn hộ 1-2 phòng ngủ từ 3-5 tỷ; nhà phố liền kề từ 6-12 tỷ; biệt thự đơn lập từ 15-50 tỷ. Giá thực tế phụ thuộc vào phân khu, tầng, view và thời điểm giao dịch. Liên hệ SGS LAND để nhận bảng giá cập nhật nhất.',
            },
            {
                q: 'Aqua City cách TP.HCM bao xa?',
                a: 'Aqua City tọa lạc tại Nhơn Trạch, Đồng Nai, cách trung tâm TP.HCM khoảng 35-40km. Khi cầu Nhơn Trạch hoàn thành và đưa vào sử dụng, thời gian di chuyển đến quận 2 (TP Thủ Đức) chỉ còn khoảng 20-25 phút. Hiện tại qua phà Bình Khánh mất khoảng 45-60 phút.',
            },
            {
                q: 'Pháp lý Aqua City có an toàn không?',
                a: 'Aqua City được cấp sổ hồng riêng (sổ đỏ) cho từng căn, đây là một điểm cộng lớn so với nhiều dự án khác. Sau giai đoạn tái cơ cấu tài chính, Novaland đã hoàn thành nghĩa vụ pháp lý và tiếp tục bàn giao nhiều phân khu. SGS LAND hỗ trợ kiểm tra pháp lý miễn phí trước khi giao dịch.',
            },
            {
                q: 'Mua Aqua City để đầu tư hay ở thực tốt hơn?',
                a: 'Aqua City phù hợp cho cả hai mục đích. Để ở thực: hưởng trọn tiện ích 5 sao, không khí trong lành và không gian sống xanh vượt trội so với nội thành. Để đầu tư: tiềm năng tăng giá từ cầu Nhơn Trạch + sân bay Long Thành, sinh lời cho thuê từ cư dân và chuyên gia nước ngoài làm việc tại khu vực.',
            },
            {
                q: 'Aqua City đã có sổ hồng riêng chưa?',
                a: 'Một số phân khu Aqua City đã được cấp sổ hồng riêng từng căn, đây là điểm cộng lớn so với nhiều dự án tại Nhơn Trạch. Tuy nhiên, tình trạng pháp lý từng phân khu khác nhau — SGS LAND hỗ trợ tra cứu và xác minh sổ hồng cụ thể theo từng căn trước khi bạn đặt cọc.',
            },
            {
                q: 'Novaland có còn tài chính ổn định không sau tái cơ cấu?',
                a: 'Novaland đã hoàn thành tái cơ cấu tài chính năm 2024, đạt thoả thuận với trái chủ quốc tế và tiếp tục bàn giao các phân khu tại Aqua City. Tập đoàn vẫn là chủ đầu tư BĐS tư nhân lớn nhất Việt Nam với quỹ đất trên 10.600ha. Rủi ro tài chính đã giảm đáng kể so với giai đoạn 2022-2023.',
            },
            {
                q: 'So sánh Aqua City và Izumi City — nên chọn dự án nào?',
                a: 'Aqua City (1.000ha, Nhơn Trạch): quy mô lớn hơn, tiện ích nhiều hơn (golf, marina, bệnh viện), giá biệt thự cao hơn, cách TP.HCM 35-40km. Izumi City (170ha, Biên Hòa): chuẩn Nhật Bản, Fuji Mart, Nam Long có track record bàn giao tốt, giá nhà phố thấp hơn, gần TP.HCM hơn (30 phút). Chọn Aqua City nếu ưu tiên quy mô và tiện ích; Izumi City nếu ưu tiên uy tín chủ đầu tư và vị trí gần.',
            },
            {
                q: 'Cho thuê căn hộ/nhà phố Aqua City được bao nhiêu tiền?',
                a: 'Giá cho thuê tham khảo: Căn hộ studio 1PN: 4-7 triệu/tháng; nhà phố liền kề: 8-15 triệu/tháng; biệt thự đơn lập: 30-60 triệu/tháng. Phân khúc cho thuê chuyên gia Nhật, Hàn tại các KCN Nhơn Trạch đang tăng mạnh. Tỷ suất cho thuê biệt thự cao cấp ước đạt 4-6%/năm.',
            },
            {
                q: 'Aqua City có dịch vụ quản lý và vận hành tòa nhà không?',
                a: 'Aqua City được vận hành bởi đội ngũ quản lý tòa nhà chuyên nghiệp của Novaland với dịch vụ an ninh 24/7, vệ sinh môi trường, bảo trì hạ tầng và chăm sóc cư dân. Phí quản lý tòa nhà thông thường 10.000-15.000 đồng/m²/tháng tùy phân khu và loại hình bất động sản.',
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
        priceRange: 'Nhà phố từ 5 tỷ — Biệt thự từ 10 tỷ',
        projectType: 'Đô Thị Tích Hợp Chuẩn Nhật',
        scale: '170 ha',
        details: [
            { label: 'Chủ đầu tư', value: 'Nam Long Group & Hankyu Hanshin (Nhật Bản)' },
            { label: 'Vị trí', value: 'Biên Hòa, Đồng Nai' },
            { label: 'Quy mô', value: '170 ha' },
            { label: 'Khoảng cách TP.HCM', value: '~30 phút (cao tốc)' },
            { label: 'Loại hình', value: 'Nhà phố, biệt thự, căn hộ Akari' },
            { label: 'Mức giá tham khảo', value: 'Nhà phố 5-12 tỷ; biệt thự 10-25 tỷ' },
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
                a: 'Nhà phố liền kề Izumi City từ 5-12 tỷ tùy diện tích và vị trí trong dự án. Biệt thự song lập từ 10-18 tỷ; biệt thự đơn lập từ 15-25 tỷ. Căn hộ Akari (phân khu căn hộ trong Izumi) từ 2-5 tỷ. Liên hệ SGS LAND để nhận bảng giá cập nhật và chính sách ưu đãi.',
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
        priceRange: 'Căn hộ từ 2,5 tỷ — Shophouse từ 10 tỷ',
        projectType: 'Siêu Đô Thị',
        scale: '271 ha',
        details: [
            { label: 'Chủ đầu tư', value: 'Vinhomes (Vingroup)' },
            { label: 'Vị trí', value: 'Quận 9 (TP Thủ Đức), TP.HCM' },
            { label: 'Quy mô', value: '271 ha' },
            { label: 'Số tòa tháp', value: '44 tòa cao tầng' },
            { label: 'Loại hình', value: 'Căn hộ, shophouse, biệt thự' },
            { label: 'Mức giá tham khảo', value: 'Căn hộ 2,5-6 tỷ; shophouse 10 tỷ+' },
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
        priceRange: 'Từ 40 triệu/m² — 150 triệu/m²',
        projectType: 'BĐS Thương Mại & Căn Hộ Cao Cấp',
        scale: 'Nhiều dự án tại TP.HCM & Hà Nội',
        details: [
            { label: 'Chủ đầu tư', value: 'Sơn Kim Land (Sơn Kim Group)' },
            { label: 'Thị trường', value: 'TP.HCM, Hà Nội' },
            { label: 'Phân khúc', value: 'Căn hộ trung cao cấp, BĐS thương mại, nghỉ dưỡng' },
            { label: 'Dự án tiêu biểu', value: 'Gem Riverside, Seasons Avenue, Metropole Thủ Thiêm' },
            { label: 'Mức giá tham khảo', value: 'Căn hộ 40-150 triệu/m²' },
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
                a: 'Gem Riverside tại Quận 4 TP.HCM là dự án căn hộ cao cấp ven sông Sài Gòn. Vị trí cực kỳ hiếm — mặt tiền sông trong nội thành, cách Q1 chỉ 10 phút. Giá 65-100 triệu/m², phù hợp đầu tư dài hạn hoặc ở thực tại trung tâm thành phố với view sông đắt giá.',
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
                a: 'Gem Riverside tại Quận 4, mặt tiền sông Sài Gòn, thị trường thứ cấp 2025-2026: căn 2PN (70-80m²) khoảng 5-8 tỷ, 3PN (90-110m²) khoảng 8-12 tỷ. Cho thuê 2PN 20-30 triệu/tháng, 3PN 30-45 triệu/tháng. Vị trí hiếm view sông nội thành, tiềm năng tăng giá bền vững.',
            },
            {
                q: 'GS25 của Sơn Kim Land có ý nghĩa gì với dự án BĐS?',
                a: 'Sơn Kim Group vận hành GS25 Việt Nam (chuỗi convenience store Hàn Quốc, 700+ điểm). Trong dự án Sơn Kim Land thường có GS25 nội khu, tạo tiện ích sống đầy đủ cho cư dân. Hệ sinh thái GS25 + GEM Center + BĐS tạo ra cộng đồng lifestyle tích hợp, khác biệt với chủ đầu tư thông thường.',
            },
            {
                q: 'So sánh Sơn Kim Land và Masterise Homes — khác nhau thế nào?',
                a: 'Sơn Kim Land: tích hợp thương mại-lifestyle mạnh (GEM Center, GS25, hotel), giá từ 50-130 triệu/m², cộng đồng quốc tế vừa phải. Masterise: ultra-luxury (branded residence, 60-300 triệu/m²), vận hành bởi Marriott/IHG, cộng đồng doanh nhân/expat cấp cao. Chọn Sơn Kim nếu giá vừa hơn; chọn Masterise nếu cần prestige cao nhất.',
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
        priceRange: 'Từ 60 triệu/m² — Penthouse 300+ triệu/m²',
        projectType: 'Bất Động Sản Hạng Sang & Ultra Luxury',
        scale: 'Nhiều dự án tại TP.HCM, Hà Nội, Phú Quốc',
        details: [
            { label: 'Chủ đầu tư', value: 'Masterise Homes (Masterise Group)' },
            { label: 'Phân khúc', value: 'Hạng sang đến ultra-luxury' },
            { label: 'Dự án tiêu biểu', value: 'Masteri Thảo Điền, Lumière, Grand Marina' },
            { label: 'Mức giá', value: '60-300 triệu/m²' },
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
                a: 'Giá Masterise theo dự án: Masteri Thảo Điền 65-100 triệu/m²; Masteri An Phú 60-90 triệu/m²; Lumière Boulevard 90-150 triệu/m²; Grand Marina Saigon 130-300 triệu/m² (luxury). Cho thuê: Masteri Thảo Điền 25-60 triệu/tháng; căn hộ Lumière 40-80 triệu/tháng. Liên hệ SGS LAND để báo giá cập nhật.',
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
            { label: 'Loại hình', value: 'Nhà phố, biệt thự, shophouse thương mại' },
            { label: 'Mức giá', value: 'Nhà phố 15-40 tỷ; biệt thự 30-120 tỷ' },
            { label: 'Tiêu chuẩn', value: 'Chuẩn Singapore (Capitaland, Keppel)' },
            { label: 'Pháp lý', value: 'Sổ hồng riêng, quy hoạch 1/500 rõ ràng' },
        ],
        amenities: [
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
        ],
        relatedProjects: [
            { name: 'Masterise Homes', slug: 'masterise-homes' },
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
};

function navigate(path: string) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function ProjectLandingPage() {
    const parts = window.location.pathname.replace(/^\//, '').split('/');
    const projectSlug = parts[1] || '';
    const cfg = PROJECT_CONFIG[projectSlug];

    if (!cfg) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
                <div className="text-center">
                    <p className="text-[var(--text-secondary)] mb-4">Dự án không tìm thấy.</p>
                    <button
                        onClick={() => navigate('/marketplace')}
                        className="px-6 py-2.5 bg-[var(--primary-600)] text-white rounded-xl font-bold text-sm"
                    >
                        Xem Tất Cả Dự Án
                    </button>
                </div>
            </div>
        );
    }

    const seoMeta = PROJECT_SEO_META[projectSlug] ?? {
        title: `${cfg.name} | ${cfg.projectType} ${cfg.location} — SGS LAND`,
        description: cfg.heroDescription.slice(0, 155),
    };

    return (
        <>
            <SeoHead
                title={seoMeta.title}
                description={seoMeta.description}
                canonicalPath={`/du-an/${cfg.slug}`}
                structuredData={{
                    '@context': 'https://schema.org',
                    '@type': 'ApartmentComplex',
                    name: cfg.name,
                    description: seoMeta.description,
                    url: `https://sgsland.vn/du-an/${cfg.slug}`,
                    address: {
                        '@type': 'PostalAddress',
                        addressLocality: cfg.location,
                        addressCountry: 'VN',
                    },
                    additionalProperty: {
                        '@type': 'PropertyValue',
                        name: 'Chủ đầu tư',
                        value: cfg.developer,
                    },
                }}
            />
        <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
            {/* ── Nav ── */}
            <header className="sticky top-0 z-50 bg-[var(--bg-surface)]/95 backdrop-blur border-b border-[var(--glass-border)]">
                <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/home')}
                        className="flex items-center gap-2 font-bold text-[var(--primary-600)] text-lg"
                        aria-label="SGS LAND - Trang chủ"
                    >
                        <Logo className="w-6 h-6" />
                        SGS LAND
                    </button>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)] transition-colors">Mua Bán BĐS</button>
                        <button onClick={() => navigate('/bat-dong-san-dong-nai')} className="hover:text-[var(--primary-600)] transition-colors">BĐS Đồng Nai</button>
                        <button onClick={() => navigate('/bat-dong-san-long-thanh')} className="hover:text-[var(--primary-600)] transition-colors">BĐS Long Thành</button>
                        <button onClick={() => navigate('/ai-valuation')} className="hover:text-[var(--primary-600)] transition-colors">Định Giá AI</button>
                    </nav>
                    <button
                        onClick={() => navigate('/contact')}
                        className="px-4 py-2 bg-[var(--primary-600)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
                    >
                        Tư Vấn Ngay
                    </button>
                </div>
            </header>

            {/* ── Hero ── */}
            <section className="bg-gradient-to-br from-[var(--primary-600)]/10 via-[var(--bg-surface)] to-[var(--bg-app)] pt-12 pb-10 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Breadcrumb */}
                    <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/home')} className="hover:text-[var(--primary-600)] transition-colors">Trang Chủ</button>
                        <span>/</span>
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)] transition-colors">Dự Án BĐS</button>
                        <span>/</span>
                        <span className="text-[var(--text-primary)] font-medium">{cfg.name}</span>
                    </nav>

                    <div className="flex flex-wrap items-start gap-3 mb-3">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--primary-600)]/10 text-[var(--primary-600)] border border-[var(--primary-600)]/20">
                            {cfg.projectType}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {cfg.priceRange}
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4 leading-tight">
                        {cfg.name}
                    </h1>
                    <p className="text-[var(--text-secondary)] text-base md:text-lg max-w-3xl leading-relaxed mb-3">
                        <strong className="text-[var(--text-primary)]">{cfg.location}</strong> — {cfg.developer}
                    </p>
                    <p className="text-[var(--text-secondary)] text-sm md:text-base max-w-3xl leading-relaxed mb-8">
                        {cfg.heroDescription}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-7 py-3 bg-[var(--primary-600)] text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-md"
                        >
                            Đăng Ký Nhận Bảng Giá
                        </button>
                        <button
                            onClick={() => navigate('/ai-valuation')}
                            className="px-7 py-3 bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--text-primary)] rounded-2xl font-semibold hover:border-[var(--primary-600)]/40 transition-all"
                        >
                            Định Giá AI Miễn Phí
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Project Details ── */}
            <section className="py-12 px-4 bg-[var(--bg-surface)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl font-bold mb-6 text-[var(--text-primary)]">Thông Tin Dự Án {cfg.name}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cfg.details.map((d, i) => (
                            <div key={i} className="flex items-start gap-3 bg-[var(--bg-app)] border border-[var(--glass-border)] rounded-2xl p-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-600)] mt-2 flex-shrink-0" />
                                <div>
                                    <span className="text-xs text-[var(--text-secondary)] block">{d.label}</span>
                                    <span className="font-semibold text-sm text-[var(--text-primary)]">{d.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Amenities ── */}
            <section className="py-12 px-4 bg-[var(--bg-app)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Tiện Ích & Hạ Tầng</h2>
                    <p className="text-sm text-[var(--text-secondary)] mb-8">Hệ sinh thái tiện ích toàn diện tại dự án {cfg.name}.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {cfg.amenities.map((group, gi) => (
                            <div key={gi} className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-6">
                                <h3 className="font-bold text-[var(--text-primary)] mb-4 text-base">{group.title}</h3>
                                <ul className="space-y-2.5">
                                    {group.items.map((item, ii) => (
                                        <li key={ii} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                                            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="py-12 px-4 bg-[var(--bg-surface)]">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Câu Hỏi Thường Gặp — {cfg.name}</h2>
                    <p className="text-sm text-[var(--text-secondary)] mb-8">Giải đáp các thắc mắc phổ biến về dự án {cfg.name}.</p>
                    <FAQAccordion items={cfg.faqs} />
                </div>
            </section>

            {/* ── Internal Links ── */}
            <section className="py-10 px-4 bg-[var(--bg-app)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-lg font-bold mb-4 text-[var(--text-primary)]">Dự Án & Khu Vực Liên Quan</h2>
                    <div className="flex flex-wrap gap-3">
                        {cfg.relatedProjects.map((p, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(
                                    p.slug.startsWith('bat-dong-san') ? `/${p.slug}` : `/du-an/${p.slug}`
                                )}
                                className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium hover:border-[var(--primary-600)]/40 hover:text-[var(--primary-600)] transition-all"
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="py-14 px-4 bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-600)]/80 text-white">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-2xl md:text-3xl font-bold mb-3">Quan Tâm Đến {cfg.name}?</h2>
                    <p className="mb-8 opacity-90">Chuyên gia SGS LAND cung cấp tư vấn độc lập, không phụ thuộc chủ đầu tư — bao gồm kiểm tra pháp lý, phân tích giá và hỗ trợ đàm phán miễn phí.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-8 py-3.5 bg-white text-[var(--primary-600)] rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
                        >
                            Nhận Tư Vấn Miễn Phí
                        </button>
                        <button
                            onClick={() => navigate('/ai-valuation')}
                            className="px-8 py-3.5 bg-white/10 border border-white/30 text-white rounded-2xl font-semibold hover:bg-white/20 transition-all"
                        >
                            Định Giá AI Ngay
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="bg-[var(--bg-surface)] border-t border-[var(--glass-border)] py-8 px-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Logo className="w-5 h-5 text-[var(--text-primary)]" />
                            <p className="font-bold text-[var(--text-primary)]">SGS LAND</p>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">Nền tảng BĐS AI hàng đầu Việt Nam</p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)]">Mua Bán BĐS</button>
                        <button onClick={() => navigate('/ai-valuation')} className="hover:text-[var(--primary-600)]">Định Giá AI</button>
                        <button onClick={() => navigate('/ky-gui-bat-dong-san')} className="hover:text-[var(--primary-600)]">Ký Gửi BĐS</button>
                        <button onClick={() => navigate('/news')} className="hover:text-[var(--primary-600)]">Tin Tức</button>
                        <button onClick={() => navigate('/contact')} className="hover:text-[var(--primary-600)]">Liên Hệ</button>
                    </div>
                </div>
            </footer>
        </div>
        </>
    );
}

function FAQAccordion({ items }: { items: { q: string; a: string }[] }) {
    const [open, setOpen] = useState<number | null>(null);
    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="border border-[var(--glass-border)] rounded-2xl overflow-hidden bg-[var(--bg-app)]">
                    <button
                        onClick={() => setOpen(open === i ? null : i)}
                        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 font-semibold text-sm text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] transition-colors"
                        aria-expanded={open === i}
                    >
                        <span>{item.q}</span>
                        <svg
                            className={`w-5 h-5 flex-shrink-0 text-[var(--primary-600)] transition-transform ${open === i ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {open === i && (
                        <div className="px-5 pb-5 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--glass-border)]">
                            <p className="pt-4">{item.a}</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
