import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { useTranslation } from '../services/i18n';
import { Logo } from '../components/Logo';
import { SeoHead } from '../components/SeoHead';
const LOCATION_SEO_META: Record<string, { title: string; description: string }> = {
    'bat-dong-san-dong-nai': {
        title: 'Bất Động Sản Đồng Nai | Mua Bán Nhà Đất 2026 — SGS LAND',
        description: 'Mua bán bất động sản Đồng Nai: Nhơn Trạch, Biên Hòa, Long Thành. Kho hàng nghìn căn, giá thực tế, pháp lý kiểm tra trước. SGS LAND.',
    },
    'bat-dong-san-long-thanh': {
        title: 'Bất Động Sản Long Thành | Đất Nền, Nhà Phố — SGS LAND',
        description: 'Mua bán đất nền, nhà phố Long Thành Đồng Nai. Vùng kinh tế sân bay, tiềm năng tăng giá cao. Định giá AI miễn phí tại SGS LAND.',
    },
    'bat-dong-san-thu-duc': {
        title: 'Bất Động Sản TP Thủ Đức | Căn Hộ, Đất Nền — SGS LAND',
        description: 'Mua bán bất động sản TP Thủ Đức: Vinhomes, Masterise, The Global City. Giá thị trường cập nhật, tư vấn chuyên nghiệp tại SGS LAND.',
    },
    'bat-dong-san-binh-duong': {
        title: 'Bất Động Sản Bình Dương | Nhà Phố, Đất Nền — SGS LAND',
        description: 'Mua bán nhà đất Bình Dương: Thuận An, Dĩ An, Thủ Dầu Một. Pháp lý an toàn, định giá AI chính xác. Liên hệ SGS LAND ngay.',
    },
    'bat-dong-san-quan-7': {
        title: 'Bất Động Sản Quận 7 TP.HCM | Nhà Phố, Căn Hộ — SGS LAND',
        description: 'Mua bán nhà đất Quận 7: Phú Mỹ Hưng, Tân Phong, Tân Quy. Vị trí đắc địa, tiện ích cao cấp. Kho hàng đa dạng tại SGS LAND.',
    },
    'bat-dong-san-phu-nhuan': {
        title: 'Bất Động Sản Phú Nhuận TP.HCM | Nhà Trung Tâm — SGS LAND',
        description: 'Mua bán nhà đất Phú Nhuận: Nhà phố, căn hộ trung tâm TP.HCM. Vị trí thuận tiện, giao thông kết nối. Tư vấn miễn phí tại SGS LAND.',
    },
    'bat-dong-san-binh-chanh': {
        title: 'Bất Động Sản Bình Chánh TP.HCM | Đất Nền, Nhà Phố — SGS LAND',
        description: 'Mua bán bất động sản Bình Chánh: đất nền, nhà phố, dự án ven Vành đai 3. Cửa ngõ Tây Nam TP.HCM, tiềm năng tăng giá cao. SGS LAND tư vấn miễn phí.',
    },
    'bat-dong-san-binh-thanh': {
        title: 'Bất Động Sản Bình Thạnh TP.HCM 2026 | Vinhomes Central Park, Masterise — SGS LAND',
        description: 'Mua bán căn hộ, nhà phố Bình Thạnh TP.HCM 2026: Vinhomes Central Park (Landmark 81), Masterise Grand Marina Saigon, Lumière Riverside. Giá 50–400 triệu/m². SGS LAND tư vấn miễn phí.',
    },
    'bat-dong-san-long-an': {
        title: 'Bất Động Sản Long An 2026 | Đất Nền Đức Hòa, Bến Lức, Cần Đước — SGS LAND',
        description: 'Mua bán bất động sản Long An 2026: đất nền Đức Hòa 5–20 triệu/m², Bến Lức 8–25 triệu/m², Cần Đước 4–12 triệu/m². Hưởng lợi Vành đai 3&4. SGS LAND tư vấn miễn phí.',
    },
    'dau-tu-bat-dong-san': {
        title: 'Đầu Tư Bất Động Sản Hiệu Quả 2026 | Hướng Dẫn Toàn Diện — SGS LAND',
        description: 'Hướng dẫn đầu tư bất động sản 2026: chiến lược chọn BĐS sinh lời, tính ROI, quản lý rủi ro pháp lý và tối ưu tài chính. Tư vấn miễn phí từ chuyên gia SGS LAND.',
    },
    'phap-ly-nha-dat': {
        title: 'Pháp Lý Nhà Đất 2026 | Hướng Dẫn Kiểm Tra Sổ Đỏ, Quy Hoạch — SGS LAND',
        description: 'Hướng dẫn pháp lý nhà đất: kiểm tra sổ đỏ, quy hoạch, thủ tục mua bán, công chứng và sang tên. SGS LAND kiểm tra pháp lý miễn phí trong 24 giờ.',
    },
};
interface LocationConfig {
    slug: string;
    name: string;
    h1Title?: string;
    province: string;
    searchQuery: string;
    heroDescription: string;
    stats: { label: string; value: string }[];
    highlights: { title: string; desc: string }[];
    faqs: { q: string; a: string }[];
    relatedLocations: { name: string; slug: string }[];
    relatedProjects: { name: string; slug: string }[];
}
const LOCATION_CONFIG: Record<string, LocationConfig> = {
    'bat-dong-san-dong-nai': {
        slug: 'bat-dong-san-dong-nai',
        name: 'Đồng Nai',
        province: 'Đồng Nai',
        searchQuery: 'Đồng Nai',
        heroDescription:
            'Bất động sản Đồng Nai đang trở thành tâm điểm đầu tư của cả nước nhờ hạ tầng phát triển mạnh mẽ, dự án sân bay Long Thành và làn sóng di dời khu công nghiệp từ TP.HCM. SGS LAND cung cấp kho hàng cập nhật realtime với đầy đủ thông tin pháp lý, giá thị trường và hỗ trợ giao dịch chuyên nghiệp.',
        stats: [
            { label: 'Dự án nổi bật', value: '50+' },
            { label: 'Tin đăng BĐS', value: '2.000+' },
            { label: 'Tăng giá trung bình/năm', value: '12-18%' },
            { label: 'Chuyên gia tư vấn', value: '200+' },
        ],
        highlights: [
            {
                title: 'Khu vực Long Thành – Nhơn Trạch',
                desc: 'Hưởng lợi trực tiếp từ sân bay quốc tế Long Thành dự kiến hoàn thành giai đoạn 1 năm 2026. Đất nền, căn hộ và nhà phố ghi nhận mức tăng giá ấn tượng 20-30%/năm.',
            },
            {
                title: 'Khu vực Biên Hòa',
                desc: 'Trung tâm kinh tế của Đồng Nai với hạ tầng giao thông kết nối trực tiếp TP.HCM qua cao tốc và vành đai. Căn hộ chung cư và nhà phố liền kề giá từ 35-80 triệu/m².',
            },
            {
                title: 'Khu đô thị – dự án lớn',
                desc: 'Aqua City (Novaland), Izumi City (Nam Long), Waterpoint… tạo nên hệ sinh thái đô thị hoàn chỉnh, thu hút cư dân và nhà đầu tư từ TP.HCM và các tỉnh lân cận.',
            },
            {
                title: 'Pháp lý minh bạch',
                desc: 'Đồng Nai đẩy mạnh số hóa thủ tục đất đai, rút ngắn thời gian cấp sổ. SGS LAND hỗ trợ kiểm tra pháp lý miễn phí cho mọi giao dịch.',
            },
        ],
        faqs: [
            {
                q: 'Bất động sản Đồng Nai có nên đầu tư không?',
                a: 'Đồng Nai là một trong những thị trường BĐS tiềm năng nhất miền Nam nhờ ba động lực chính: sân bay Long Thành (hoàn thành 2026), các tuyến cao tốc kết nối TP.HCM và làn sóng di dời khu công nghiệp. Giá đất nhiều khu vực tăng 15-25%/năm, đặc biệt tại Long Thành, Nhơn Trạch và Biên Hòa.',
            },
            {
                q: 'Giá đất Đồng Nai hiện nay là bao nhiêu?',
                a: 'Giá đất Đồng Nai dao động lớn theo vị trí: đất nền Long Thành 8-25 triệu/m², đất nền Nhơn Trạch 5-15 triệu/m², căn hộ Biên Hòa 35-80 triệu/m², biệt thự dự án 55-90 triệu/m². Giá cập nhật theo thị trường và có thể thay đổi theo giai đoạn dự án.',
            },
            {
                q: 'Sân bay Long Thành ảnh hưởng thế nào đến giá BĐS?',
                a: 'Sân bay quốc tế Long Thành (diện tích 5.000ha, công suất 25 triệu hành khách/giai đoạn 1) đã và đang kéo theo làn sóng đầu tư hạ tầng, khu đô thị và công nghiệp. BĐS trong bán kính 15km từ sân bay có mức tăng giá trung bình 20-35% kể từ khi khởi công.',
            },
            {
                q: 'Những dự án BĐS nào nổi bật tại Đồng Nai?',
                a: 'Các dự án lớn đáng chú ý: Aqua City (Novaland, 1.000ha tại Long Hưng), Izumi City (Nam Long, 170ha tại Biên Hòa), Waterpoint (Nam Long, Long An giáp ranh), HUD Nhơn Trạch (chung cư giá vừa), Gem Sky World (Long Thành). SGS LAND có thông tin cập nhật và hỗ trợ tư vấn tất cả dự án.',
            },
            {
                q: 'Mua đất Đồng Nai cần lưu ý gì về pháp lý?',
                a: 'Kiểm tra quy hoạch sử dụng đất (tránh mua đất quy hoạch lộ, đất nông nghiệp chưa chuyển mục đích), xác nhận chủ sở hữu qua sổ đỏ chính chủ, tránh đất chung sổ phân lô chưa tách thửa. SGS LAND cung cấp dịch vụ kiểm tra pháp lý miễn phí và đồng hành cùng công chứng để bảo vệ quyền lợi người mua.',
            },
            {
                q: 'Bình Dương hay Đồng Nai nên đầu tư BĐS hơn?',
                a: 'Hai thị trường có lợi thế khác nhau: Bình Dương mạnh về công nghiệp, đô thị hoá cao, giá đất đã tăng nhiều và nhu cầu cho thuê cực lớn. Đồng Nai vẫn đang trong chu kỳ đầu tăng giá mạnh nhờ sân bay Long Thành — tiềm năng tăng trưởng còn lớn hơn. Ngân sách hạn chế nên chọn Đồng Nai; ngân sách cao hơn và cần thanh khoản nhanh nên chọn Bình Dương.',
            },
            {
                q: 'Loại đất nào ở Đồng Nai có tiềm năng tăng giá cao nhất?',
                a: 'Đất nền thổ cư sổ đỏ trong bán kính 5-10km từ sân bay Long Thành (huyện Long Thành) và đất liền kề khu công nghiệp mới (Nhơn Trạch 3, Nhơn Trạch 6) có tiềm năng tăng giá tốt nhất. Thứ hai là nhà phố thương mại mặt tiền đường lớn tại Biên Hòa — tận hưởng đô thị hóa và nhu cầu thương mại.',
            },
            {
                q: 'Có thể vay ngân hàng mua BĐS Đồng Nai không?',
                a: 'Có. Hầu hết ngân hàng lớn (Vietcombank, BIDV, Agribank, VPBank, Techcombank) đều cho vay mua BĐS Đồng Nai với LTV tối đa 70-80% giá trị tài sản, kỳ hạn 15-25 năm. Lãi suất ưu đãi 6-8,5%/năm (24 tháng đầu). SGS LAND kết nối ngân hàng miễn phí và hỗ trợ hồ sơ vay.',
            },
            {
                q: 'Tìm môi giới bất động sản Đồng Nai uy tín ở đâu?',
                a: 'SGS LAND là nền tảng BĐS AI với đội ngũ 200+ chuyên gia am hiểu thị trường Đồng Nai, Biên Hòa, Long Thành, Nhơn Trạch. Tất cả môi giới đều được xác thực chứng chỉ hành nghề, BĐS kiểm tra pháp lý độc lập và giá được so sánh realtime bằng AI — đảm bảo giao dịch an toàn, minh bạch.',
            },
            {
                q: 'Cho thuê BĐS tại Đồng Nai có hiệu quả không?',
                a: 'Đồng Nai có hơn 30 khu công nghiệp với 500.000+ công nhân và chuyên gia nước ngoài — tạo nhu cầu thuê nhà ổn định. Phòng trọ và chung cư mini: 2-4 triệu/tháng (tỷ suất 8-12%/năm). Căn hộ cao cấp: 8-15 triệu/tháng cho chuyên gia. Nhà phố thương mại mặt tiền: 15-50 triệu/tháng.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
            { name: 'BĐS Bình Dương', slug: 'bat-dong-san-binh-duong' },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'Grand Manhattan Novaland', slug: 'manhattan' },
        ],
    },
    'bat-dong-san-long-thanh': {
        slug: 'bat-dong-san-long-thanh',
        name: 'Long Thành',
        province: 'Đồng Nai',
        searchQuery: 'Long Thành',
        heroDescription:
            'Bất động sản Long Thành, Đồng Nai đang ở giai đoạn tăng trưởng mạnh nhất nhờ dự án sân bay quốc tế Long Thành — công trình trọng điểm quốc gia. Đất nền, căn hộ và bất động sản thương mại Long Thành ghi nhận mức tăng giá vượt trội, thu hút dòng tiền đầu tư lớn từ cả nước. SGS LAND hỗ trợ tư vấn và giao dịch chuyên nghiệp.',
        stats: [
            { label: 'Khoảng cách từ TP.HCM', value: '40km' },
            { label: 'Công suất sân bay (GĐ1)', value: '25 triệu HK/năm' },
            { label: 'Tăng giá đất 3 năm gần nhất', value: '35-60%' },
            { label: 'Dự án đang mở bán', value: '20+' },
        ],
        highlights: [
            {
                title: 'Hưởng lợi trực tiếp từ sân bay Long Thành',
                desc: 'Sân bay quốc tế Long Thành có tổng diện tích 5.000ha, vốn đầu tư hơn 16 tỷ USD, giai đoạn 1 dự kiến hoàn thành và khai thác năm 2026. BĐS trong bán kính 10km là đích ngắm của các nhà đầu tư chiến lược.',
            },
            {
                title: 'Hạ tầng giao thông đồng bộ',
                desc: 'Cao tốc Bến Lức - Long Thành, đường Vành đai 3, 4 TP.HCM và quốc lộ 51 cải tạo rút ngắn thời gian di chuyển xuống 30-40 phút từ trung tâm TP.HCM. Kết nối thuận lợi với Bà Rịa-Vũng Tàu và các tỉnh miền Đông.',
            },
            {
                title: 'Đất nền và nhà phố giá tiềm năng',
                desc: 'Đất nền phân lô đã có sổ đỏ từ 8-25 triệu/m², nhà phố liền kề 4-8 tỷ, biệt thự dự án từ 10 tỷ. Tiềm năng tăng giá còn lớn khi sân bay đi vào hoạt động.',
            },
            {
                title: 'Khu công nghiệp và thương mại',
                desc: 'Long Thành là cửa ngõ logistics quan trọng với hàng chục khu công nghiệp, kéo theo nhu cầu nhà ở, văn phòng và mặt bằng thương mại từ chuyên gia, công nhân và doanh nghiệp.',
            },
        ],
        faqs: [
            {
                q: 'Có nên mua đất Long Thành năm 2026-2027 không?',
                a: 'Long Thành là một trong các thị trường BĐS được khuyến nghị đầu tư mạnh trong giai đoạn 2026-2027. Với sân bay Long Thành hoàn thành giai đoạn 1 năm 2026, cơ sở hạ tầng đồng bộ và dòng vốn FDI đổ vào khu công nghiệp, giá BĐS được dự báo tiếp tục tăng 15-25%/năm.',
            },
            {
                q: 'Giá đất nền Long Thành hiện nay khoảng bao nhiêu?',
                a: 'Đất nền thổ cư mặt tiền đường lớn: 20-35 triệu/m². Đất phân lô dự án sổ sẵn: 10-25 triệu/m². Đất vườn nông nghiệp có thể chuyển đổi: 3-8 triệu/m². Giá biến động theo khoảng cách tới sân bay và loại pháp lý.',
            },
            {
                q: 'Sân bay Long Thành khai thác vào năm nào?',
                a: 'Theo tiến độ chính thức, sân bay Long Thành giai đoạn 1 dự kiến hoàn thành vào cuối năm 2026, khai thác thương mại đầu năm 2027 với công suất 25 triệu hành khách/năm. Tổng vốn đầu tư giai đoạn 1 khoảng 109.000 tỷ đồng.',
            },
            {
                q: 'Mua BĐS Long Thành qua SGS LAND có những lợi ích gì?',
                a: 'SGS LAND cung cấp: kho hàng BĐS Long Thành đã xác minh pháp lý, so sánh giá thị trường realtime bằng AI, hỗ trợ đàm phán và pháp lý miễn phí, kết nối ngân hàng vay vốn lãi suất ưu đãi. Đội ngũ 200+ chuyên gia am hiểu thị trường Long Thành sẵn sàng tư vấn.',
            },
            {
                q: 'Rủi ro khi đầu tư đất Long Thành là gì?',
                a: 'Rủi ro cần lưu ý: đất quy hoạch đường hoặc sân bay chưa giải toả, đất không có sổ đỏ hoặc đang tranh chấp, dự án ma chưa đủ điều kiện mở bán, bong bóng giá do thông tin thổi phồng. SGS LAND kiểm tra pháp lý độc lập trước mỗi giao dịch để bảo vệ người mua.',
            },
            {
                q: 'Khu vực nào ở Long Thành gần sân bay nhất và nên mua?',
                a: 'Các xã gần sân bay Long Thành nhất: Bình Sơn, Long An, Suối Trầu (bán kính 3-5km). Tuy nhiên, một số khu vực này vẫn trong vùng quy hoạch — cần kiểm tra kỹ trước khi mua. Khu vực thị trấn Long Thành và các xã phía Nam (Long Phước, Phước Bình) cân bằng tốt giữa tiềm năng và rủi ro pháp lý.',
            },
            {
                q: 'Mua BĐS Long Thành để ở hay để đầu tư cho thuê tốt hơn?',
                a: 'Để ở: Long Thành có không khí trong lành, mật độ thấp, phù hợp gia đình muốn thoát khỏi TP.HCM đông đúc. Để đầu tư cho thuê: nhu cầu thuê chuyên gia KCN cao và tăng khi sân bay mở. Để lướt sóng ngắn hạn: cần thận trọng vì tính thanh khoản chưa cao bằng TP.HCM.',
            },
            {
                q: 'Cầu nào kết nối Long Thành với TP.HCM?',
                a: 'Hiện tại: Phà Bình Khánh và cao tốc TP.HCM – Long Thành – Dầu Giây (qua Nhơn Trạch). Tương lai: Cầu Nhơn Trạch (đang thi công, dự kiến 2025-2026) rút ngắn kết nối Long Thành – Q2 còn 20-25 phút. Cầu Long Thành (quy hoạch) sẽ tạo thêm kết nối với Bà Rịa – Vũng Tàu.',
            },
            {
                q: 'Tỷ suất cho thuê BĐS Long Thành đạt bao nhiêu phần trăm?',
                a: 'Tỷ suất cho thuê gộp (bruto yield) tại Long Thành: nhà trọ công nhân KCN 8-12%/năm; nhà phố thương mại mặt tiền 5-8%/năm; căn hộ cao cấp dành chuyên gia 5-7%/năm. Tỷ suất thực (sau chi phí) thường thấp hơn 1-2 điểm %. Nhu cầu thuê tăng mạnh khi sân bay Long Thành đi vào hoạt động.',
            },
            {
                q: 'So sánh BĐS Long Thành và TP Thủ Đức — nên chọn đâu?',
                a: 'Thủ Đức: giá cao hơn 2-5 lần, thanh khoản cực tốt, hạ tầng Metro hoàn thiện — phù hợp đầu tư ngắn-trung hạn và ở thực cho người làm TP.HCM. Long Thành: giá thấp hơn, tiềm năng tăng trưởng dài hạn lớn hơn nhờ sân bay — phù hợp đầu tư dài hạn 5-10 năm và ngân sách vừa.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
            { name: 'BĐS Bình Dương', slug: 'bat-dong-san-binh-duong' },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'Izumi City Nam Long', slug: 'izumi-city' },
        ],
    },
    'bat-dong-san-thu-duc': {
        slug: 'bat-dong-san-thu-duc',
        name: 'TP Thủ Đức',
        province: 'TP.HCM',
        searchQuery: 'Thủ Đức',
        heroDescription:
            'Bất động sản TP Thủ Đức — thành phố trong thành phố đầu tiên của Việt Nam — đang là tâm điểm đầu tư nhờ hội tụ ba quận cũ (Q2, Q9, Thủ Đức) với hạ tầng đồng bộ, Khu Công Nghệ Cao SHTP, Đại Học Quốc Gia và khu đô thị mới Thủ Thiêm. SGS LAND cung cấp kho hàng BĐS đã xác minh pháp lý và tư vấn chuyên sâu thị trường Thủ Đức.',
        stats: [
            { label: 'Dân số', value: '1,1 triệu' },
            { label: 'Dự án căn hộ cao cấp', value: '80+' },
            { label: 'Giá căn hộ trung bình', value: '70-150 tr/m²' },
            { label: 'Tốc độ tăng giá/năm', value: '10-18%' },
        ],
        highlights: [
            {
                title: 'Khu Đô Thị Thủ Thiêm (Q2 cũ)',
                desc: 'Khu đô thị mới Thủ Thiêm 657ha đối diện Q1 qua sông Sài Gòn — trung tâm tài chính tương lai của TP.HCM. Giá đất thương mại và căn hộ hạng sang tiếp tục thiết lập kỷ lục mới.',
            },
            {
                title: 'Vinhomes Grand Park & Metro số 1 (Q9 cũ)',
                desc: 'Siêu đô thị 271ha Vinhomes Grand Park, Khu Công Nghệ Cao SHTP và tuyến Metro số 1 Bến Thành – Suối Tiên đã biến Q9 thành trung tâm công nghệ và căn hộ giá tốt nhất TP.HCM.',
            },
            {
                title: 'Đại Học Quốc Gia & Làng Đại Học',
                desc: 'Khu vực Đại Học Quốc Gia TP.HCM với hơn 80.000 sinh viên tạo nhu cầu nhà ở, thương mại và dịch vụ khổng lồ. Đất nền và nhà trọ đầu tư thu nhập thụ động ổn định.',
            },
            {
                title: 'Hạ tầng giao thông liên kết',
                desc: 'Metro số 1, vành đai 2 mở rộng, cao tốc TP.HCM – Long Thành – Dầu Giây và cầu Thủ Thiêm 2 tạo mạng lưới giao thông đa tầng, kết nối Thủ Đức với toàn bộ TP.HCM trong 20-40 phút.',
            },
        ],
        faqs: [
            {
                q: 'Bất động sản TP Thủ Đức có nên đầu tư không?',
                a: 'TP Thủ Đức là khu vực có tiềm năng tăng trưởng BĐS cao nhất TP.HCM nhờ ba động lực: hạ tầng Metro số 1 đưa vào khai thác, Khu Đô Thị Thủ Thiêm phát triển mạnh và làn sóng dịch chuyển doanh nghiệp công nghệ. Giá căn hộ tăng 10-18%/năm, đất nền tăng 15-25%/năm.',
            },
            {
                q: 'Giá căn hộ TP Thủ Đức hiện nay là bao nhiêu?',
                a: 'Giá căn hộ Thủ Đức biến động theo khu vực: Thủ Thiêm (Q2 cũ) 80-280 triệu/m²; khu vực Metro số 1 (Q9 cũ) 45-90 triệu/m²; Thủ Đức (gần ĐH Quốc Gia) 35-65 triệu/m². Phân khúc cho thuê sôi động nhờ nhu cầu từ chuyên gia công nghệ và sinh viên.',
            },
            {
                q: 'Khu vực nào ở Thủ Đức nên đầu tư nhất?',
                a: 'Ba khu vực nên chú ý: (1) Thủ Thiêm — bất động sản hạng sang, tăng giá tốt nhất dài hạn; (2) Khu vực Metro số 1 (Suối Tiên – Bình Thái) — căn hộ vừa túi tiền, nhu cầu thuê cao; (3) Khu Công Nghệ Cao SHTP — đất nền và nhà phố hưởng lợi từ 80.000+ chuyên gia IT.',
            },
            {
                q: 'Metro số 1 ảnh hưởng thế nào đến BĐS Thủ Đức?',
                a: 'Tuyến Metro số 1 Bến Thành – Suối Tiên (19,7km, 14 ga) đã vận hành cuối 2024. BĐS trong bán kính 500m quanh các ga Metro tăng giá 20-40% so với trước khi Metro khai thác. Nhà cho thuê gần ga Metro đạt tỷ suất cho thuê 6-9%/năm.',
            },
            {
                q: 'SGS LAND hỗ trợ mua BĐS Thủ Đức như thế nào?',
                a: 'SGS LAND cung cấp dịch vụ toàn diện: tìm kiếm BĐS Thủ Đức theo nhu cầu (ngân sách, mục đích), định giá AI miễn phí so sánh với thị trường, kiểm tra pháp lý sổ đỏ độc lập, hỗ trợ vay vốn ngân hàng lãi suất tốt và đồng hành ký kết hợp đồng an toàn.',
            },
            {
                q: 'Thủ Thiêm có còn tiềm năng sau khi giá đã tăng mạnh?',
                a: 'Thủ Thiêm chỉ mới lấp đầy 30% so với quy hoạch tổng thể 657ha. Trung tâm tài chính quốc tế, nghệ thuật và giải trí đang hình thành — tương tự vai trò Pudong (Thượng Hải) hay Marina Bay (Singapore). Đất thương mại và căn hộ hạng sang vẫn còn dư địa tăng giá 20-50% giai đoạn 2026-2030.',
            },
            {
                q: 'Vinhomes Grand Park tại TP Thủ Đức có đáng mua không?',
                a: 'Vinhomes Grand Park (271ha, 44.000 căn) đã bàn giao 70%, cộng đồng 150.000 cư dân ổn định. Giá thứ cấp 50-90 triệu/m², cho thuê 2PN 12-18 triệu/tháng. Metro số 1 ga Vinhomes giúp commute Q1 chỉ 25 phút. Tỷ suất cho thuê 5-7%/năm.',
            },
            {
                q: 'Mua căn hộ gần Metro số 1 Thủ Đức — ga nào tốt nhất?',
                a: 'Ba ga nổi bật: (1) Ga An Phú: cạnh The Global City và Masterise An Phú — giá 80-130 triệu/m²; (2) Ga Bình Thái/Phước Long: Vinhomes, Masteri, căn hộ 45-80 triệu/m²; (3) Ga Suối Tiên: giá thấp nhất 35-55 triệu/m², nhu cầu thuê từ SHTP và ĐH Quốc Gia.',
            },
            {
                q: 'Khu Công Nghệ Cao SHTP ảnh hưởng gì đến BĐS TP Thủ Đức?',
                a: 'SHTP có 120+ doanh nghiệp công nghệ (Intel, Samsung, Nidec, Sanofi...), 20.000+ chuyên gia. BĐS trong bán kính 2km tăng giá liên tục nhờ nhu cầu thuê ổn định. Đất nền phân lô gần SHTP tăng 25-35%/năm giai đoạn 2022-2025.',
            },
            {
                q: 'So sánh BĐS Thủ Đức và Thủ Thiêm — nên chọn cái nào?',
                a: 'Thủ Thiêm: ultra-prime, giá 100-250 triệu/m², đầu tư dài hạn 5-10 năm, thanh khoản cao khi thị trường hồi phục. Thủ Đức nói chung: 35-90 triệu/m², dòng tiền cho thuê tốt hơn ngay, phân khúc người ở thực lớn hơn. SGS LAND tư vấn theo ngân sách và kỳ vọng lợi nhuận.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS Quận 7', slug: 'bat-dong-san-quan-7' },
            { name: 'BĐS Bình Dương', slug: 'bat-dong-san-binh-duong' },
        ],
        relatedProjects: [
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
            { name: 'The Global City', slug: 'the-global-city' },
            { name: 'Khu Đô Thị Thủ Thiêm', slug: 'thu-thiem' },
        ],
    },
    'bat-dong-san-binh-duong': {
        slug: 'bat-dong-san-binh-duong',
        name: 'Bình Dương',
        province: 'Bình Dương',
        searchQuery: 'Bình Dương',
        heroDescription:
            'Bất động sản Bình Dương — tỉnh công nghiệp phát triển nhất Đông Nam Bộ — đang thu hút làn sóng đầu tư mạnh mẽ nhờ hơn 30 khu công nghiệp, 500.000+ chuyên gia và công nhân nước ngoài. Giá căn hộ và đất nền Bình Dương cạnh tranh hơn TP.HCM 40-50%, tiềm năng cho thuê và tăng giá vượt trội. SGS LAND hỗ trợ giao dịch BĐS Bình Dương chuyên nghiệp.',
        stats: [
            { label: 'Khu công nghiệp', value: '30+' },
            { label: 'Chuyên gia nước ngoài', value: '500.000+' },
            { label: 'Giá căn hộ trung bình', value: '35-70 tr/m²' },
            { label: 'Tỷ suất cho thuê', value: '5-8%/năm' },
        ],
        highlights: [
            {
                title: 'Thành Phố Mới Bình Dương',
                desc: 'Thành phố Mới Bình Dương (Bình Dương New City) là đô thị thông minh được quy hoạch bài bản với hệ thống hạ tầng hiện đại, trung tâm hành chính, AEON Mall, WTC Bình Dương và hàng chục tòa nhà văn phòng hạng A.',
            },
            {
                title: 'Thuận An & Dĩ An — Vùng Giáp Ranh TP.HCM',
                desc: 'Thuận An và Dĩ An giáp với TP Thủ Đức, kết nối TP.HCM chỉ 15-25 phút. Giá căn hộ và đất nền rẻ hơn 30-50% so với Thủ Đức nhưng tiện ích và kết nối tương đương. Nhu cầu thuê nhà rất lớn từ công nhân và chuyên gia.',
            },
            {
                title: 'Hệ Sinh Thái KCN & Chuyên Gia Nước Ngoài',
                desc: 'Hơn 500.000 chuyên gia Hàn Quốc, Nhật Bản, Đài Loan và các nước tạo nhu cầu thuê căn hộ tiêu chuẩn quốc tế rất lớn. Căn hộ cao cấp tại Bình Dương cho thuê 10-25 triệu/tháng, tỷ suất đạt 5-8%/năm.',
            },
            {
                title: 'Hạ Tầng Giao Thông Đồng Bộ',
                desc: 'Đại lộ Bình Dương 8 làn, cao tốc TP.HCM – Thủ Dầu Một – Chơn Thành và quy hoạch Metro Bến Thành – Suối Tiên – Bình Dương kết nối toàn vùng. Thời gian di chuyển từ Thuận An đến Q1 chỉ 30-40 phút.',
            },
        ],
        faqs: [
            {
                q: 'Bất động sản Bình Dương có tiềm năng không?',
                a: 'Bình Dương là tỉnh có tốc độ đô thị hóa nhanh nhất cả nước với hơn 30 KCN đang hoạt động. Nhu cầu nhà ở từ 500.000+ chuyên gia và công nhân tạo thị trường cho thuê sôi động. Giá BĐS tăng 8-15%/năm trong 5 năm gần đây, thấp hơn TP.HCM nhưng tiềm năng còn lớn.',
            },
            {
                q: 'Mua căn hộ Bình Dương để cho thuê có lời không?',
                a: 'Bình Dương là thị trường cho thuê BĐS sôi động nhất cả nước do nhu cầu từ chuyên gia KCN. Căn hộ cao cấp (Becamex, Vsip, Manhattan) cho thuê 10-25 triệu/tháng. Tỷ suất cho thuê bruto đạt 5-8%/năm — vượt lãi suất gửi tiết kiệm ngân hàng. Phù hợp đầu tư dòng tiền thụ động.',
            },
            {
                q: 'Giá đất Bình Dương hiện nay là bao nhiêu?',
                a: 'Giá đất Bình Dương theo khu vực: Thủ Dầu Một (trung tâm) 30-80 triệu/m²; Thuận An, Dĩ An (giáp TP.HCM) 40-100 triệu/m²; Thành Phố Mới 20-50 triệu/m²; Bến Cát, Tân Uyên 8-20 triệu/m². Giá đất TP Bình Dương thấp hơn TP.HCM 40-60% với cùng tiện ích.',
            },
            {
                q: 'Dự án căn hộ nào tốt nhất ở Bình Dương?',
                a: 'Các dự án nổi bật: Manhattan (Becamex IDC) — chuẩn quốc tế tại trung tâm; Charm City (Charm Group) — căn hộ vừa túi tiền khu Dĩ An; Phúc Đạt Tower (Thuận An); Precia (An Gia) — vị trí vàng giáp Thủ Đức. SGS LAND có thông tin và bảng giá cập nhật tất cả dự án Bình Dương.',
            },
            {
                q: 'Thuận An hay Thủ Dầu Một nên chọn khu vực nào đầu tư?',
                a: 'Thuận An — phù hợp đầu tư cho thuê (giáp TP.HCM, nhu cầu thuê cao, giá dưới 2 tỷ/căn). Thủ Dầu Một — phù hợp ở thực lâu dài (trung tâm hành chính, tiện ích đầy đủ). Thành Phố Mới Bình Dương — lý tưởng cho đầu tư dài hạn khi đô thị hóa hoàn chỉnh (10-15 năm). Liên hệ SGS LAND để được tư vấn theo mục tiêu cụ thể.',
            },
            {
                q: 'Người Hàn Quốc ở Bình Dương tập trung khu nào?',
                a: 'Cộng đồng người Hàn Quốc (80.000+) tập trung tại VSIP 1 (Thuận An) và Bình Dương New City. Nhu cầu thuê căn hộ chuẩn Hàn rất lớn: 10-25 triệu/tháng. Cho thuê nhà Hàn Quốc đạt tỷ suất 6-9%/năm, an toàn và ổn định.',
            },
            {
                q: 'Becamex IDC và Vsip khác nhau thế nào?',
                a: 'Becamex IDC (doanh nghiệp nhà nước Bình Dương) phát triển hạ tầng KCN + đô thị tích hợp (WTC, AEON, trường học). Vsip (liên doanh Singapore) tập trung vào KCN cao cấp thu hút FDI lớn. BĐS gần cả hai đều tăng trưởng tốt và cho thuê ổn định.',
            },
            {
                q: 'Quy hoạch Metro Bình Dương kết nối TP.HCM như thế nào?',
                a: 'Quy hoạch Metro số 1 kéo dài Suối Tiên – TP Mới Bình Dương (25km) dự kiến 2030-2035. Khi hoàn thành, di chuyển từ Bình Dương New City đến Q1 chỉ 35-40 phút. BĐS dọc hành lang Metro được dự báo tăng 30-50% khi dự án được phê duyệt chính thức.',
            },
            {
                q: 'Bình Dương hay Long An nên đầu tư đất nền năm 2026?',
                a: 'Bình Dương: hạ tầng tốt hơn, thanh khoản cao hơn, giá 20-100 triệu/m², phù hợp đầu tư ngắn-trung hạn. Long An: giá còn rẻ 5-20 triệu/m², tiềm năng 5-10 năm khi Vành đai 3-4 hoàn thành. Ngân sách dưới 1 tỷ → Long An; trên 2 tỷ → Bình Dương.',
            },
            {
                q: 'SGS LAND có tư vấn BĐS Bình Dương không?',
                a: 'Có. SGS LAND tư vấn toàn diện BĐS Bình Dương: phân tích thị trường theo KCN, tìm căn hộ cho thuê chuyên gia nước ngoài, định giá AI so sánh 500+ giao dịch thực, kiểm tra pháp lý và hỗ trợ đàm phán giá với chủ đầu tư.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS Phú Nhuận', slug: 'bat-dong-san-phu-nhuan' },
        ],
        relatedProjects: [
            { name: 'Grand Manhattan Novaland', slug: 'manhattan' },
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
        ],
    },
    'bat-dong-san-quan-7': {
        slug: 'bat-dong-san-quan-7',
        name: 'Quận 7',
        province: 'TP.HCM',
        searchQuery: 'Quận 7',
        heroDescription:
            'Bất động sản Quận 7 — khu vực Phú Mỹ Hưng và cộng đồng quốc tế sôi động nhất TP.HCM. Với chuẩn sống đẳng cấp, hạ tầng xanh và cộng đồng cư dân Hàn Quốc, Nhật Bản và Đài Loan, Quận 7 là lựa chọn hàng đầu cho chuyên gia nước ngoài và người Việt thành đạt. SGS LAND hỗ trợ tư vấn và giao dịch BĐS Quận 7 chuyên nghiệp.',
        stats: [
            { label: 'Chuyên gia nước ngoài cư trú', value: '30.000+' },
            { label: 'Giá căn hộ cao cấp', value: '70-150 tr/m²' },
            { label: 'Giá thuê căn hộ', value: '15-60 tr/tháng' },
            { label: 'Trường quốc tế trong khu vực', value: '20+' },
        ],
        highlights: [
            {
                title: 'Phú Mỹ Hưng — Khu Đô Thị Kiểu Mẫu',
                desc: 'Phú Mỹ Hưng (500ha) là khu đô thị kiểu mẫu đầu tiên của Việt Nam với hạ tầng xanh, phong cách sống Singapore. Giá căn hộ 70-150 triệu/m², nhà phố biệt lập 200-500 triệu/m², cho thuê 25-60 triệu/tháng.',
            },
            {
                title: 'Cộng Đồng Hàn Quốc & Quốc Tế Sầm Uất',
                desc: 'Hơn 30.000 chuyên gia Hàn Quốc, Nhật, Đài Loan sinh sống tại Quận 7 tạo hệ sinh thái thương mại, ẩm thực, y tế và giáo dục đặc sắc. BĐS cho thuê luôn có thanh khoản tốt với giá thuê cao nhất TP.HCM.',
            },
            {
                title: 'Kết Nối Hạ Tầng Mạnh',
                desc: 'Đường Nguyễn Văn Linh (trục huyết mạch), đường Mai Chí Thọ, cao tốc TP.HCM – Trung Lương và cầu Khánh Hội kết nối Quận 7 với trung tâm Q1 (15 phút) và toàn TP.HCM. Quy hoạch Metro số 4 đi qua.',
            },
            {
                title: 'Hệ Thống Tiện Ích Hàng Đầu',
                desc: 'SC VivoCity, Crescent Mall, Lotte Mart, 20+ trường quốc tế (ISHCMC, BIS, Eaton), bệnh viện FV (tiêu chuẩn Pháp), công viên Sunrise, khu thể thao cao cấp — hệ sinh thái tiện ích tốt nhất TP.HCM.',
            },
        ],
        faqs: [
            {
                q: 'Bất động sản Quận 7 có đáng đầu tư không?',
                a: 'Quận 7 là thị trường BĐS ổn định và thanh khoản cao nhất TP.HCM nhờ cộng đồng quốc tế đông đảo. Giá BĐS Q7 tăng đều đặn 8-12%/năm, ít bị tác động bởi biến động thị trường chung. Phù hợp đầu tư cho thuê dài hạn và tích lũy tài sản bền vững.',
            },
            {
                q: 'Giá căn hộ Quận 7 hiện tại là bao nhiêu?',
                a: 'Giá căn hộ Q7 theo phân khúc: Phú Mỹ Hưng (cao cấp) 70-150 triệu/m²; Sunrise City, Sunrise Cityview 55-90 triệu/m²; khu vực khác Q7 40-70 triệu/m². Cho thuê: studio/1PN 15-25 triệu/tháng; 2-3PN 25-60 triệu/tháng tại Phú Mỹ Hưng.',
            },
            {
                q: 'Phú Mỹ Hưng có đặc điểm gì hấp dẫn nhà đầu tư nước ngoài?',
                a: 'Phú Mỹ Hưng thu hút nhà đầu tư nước ngoài vì: (1) Cộng đồng quốc tế đông đảo (Hàn, Nhật, Đài) giúp BĐS dễ cho thuê; (2) Hạ tầng xanh, an toàn, chuẩn Singapore; (3) Hệ thống trường quốc tế, bệnh viện 5 sao trong tầm tay; (4) Pháp lý rõ ràng, được phép mua và cho thuê hợp pháp.',
            },
            {
                q: 'Mua nhà Quận 7 để cho thuê thu nhập bao nhiêu?',
                a: 'Căn hộ Phú Mỹ Hưng cho thuê 20-60 triệu/tháng, tỷ suất gross yield khoảng 4-6%/năm. Nhà phố mặt tiền đường Nguyễn Văn Linh cho thuê mặt bằng kinh doanh 50-150 triệu/tháng. Giá trị BĐS Q7 tăng thêm 8-12%/năm, tổng return thực tế 12-18%/năm.',
            },
            {
                q: 'Tuyến Metro nào đi qua Quận 7?',
                a: 'Quy hoạch tuyến Metro số 4 (Thạnh Xuân – Khu Đô Thị Hiệp Phước) đi qua Quận 7. Ngoài ra, Quận 7 được hưởng lợi gián tiếp từ Metro số 1 (Bến Thành – Suối Tiên) và các tuyến xe buýt nhanh BRT. Khi Metro hoàn thành, giá BĐS quanh các ga được dự báo tăng thêm 20-30%.',
            },
            {
                q: 'Bệnh viện FV Quận 7 ảnh hưởng thế nào đến giá BĐS?',
                a: 'Bệnh viện FV (tiêu chuẩn Pháp, 100% vốn nước ngoài) là lý do hàng nghìn expat chọn Q7 để cư trú lâu dài. BĐS trong bán kính 2km bệnh viện FV có giá thuê cao hơn 15-25% so với khu vực khác trong Q7.',
            },
            {
                q: 'Nên mua nhà phố Quận 7 hay căn hộ Phú Mỹ Hưng?',
                a: 'Nhà phố Q7 (7-25 tỷ): linh hoạt kinh doanh, sổ đỏ không thời hạn, tăng giá dài hạn. Căn hộ Phú Mỹ Hưng (4-15 tỷ): vào thẳng cộng đồng quốc tế, cho thuê 25-60 triệu/tháng, quản lý tập trung. Ngân sách và mục đích quyết định lựa chọn — SGS LAND tư vấn miễn phí.',
            },
            {
                q: 'Giá thuê văn phòng Quận 7 và Phú Mỹ Hưng là bao nhiêu?',
                a: 'Văn phòng Phú Mỹ Hưng: 15-30 USD/m²/tháng (hạng A), thu hút công ty Hàn, Nhật, Singapore. Văn phòng khu vực khác Q7: 8-18 USD/m²/tháng. Nhu cầu luôn vượt cung, tỷ lệ trống dưới 5% tại văn phòng chất lượng tốt.',
            },
            {
                q: 'SC VivoCity và Crescent Mall ảnh hưởng thế nào đến BĐS Q7?',
                a: 'Hai trung tâm thương mại lớn nhất Q7 tạo điểm neo kinh tế: BĐS xung quanh SC VivoCity và Crescent Mall có mức giá thuê cao hơn 20-40% và thanh khoản cao hơn. Shophouse tầng trệt gần hai TT này cho thuê 80-200 triệu/tháng.',
            },
            {
                q: 'SGS LAND có căn hộ Phú Mỹ Hưng cho thuê không?',
                a: 'SGS LAND kết nối hàng trăm căn hộ cho thuê tại Phú Mỹ Hưng (Panorama, The Vista, Sunrise City, Sky Garden...). Phục vụ cả ngắn hạn (serviced apartment) và dài hạn cho expat. Liên hệ để nhận danh sách cập nhật hàng ngày miễn phí.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
            { name: 'BĐS Phú Nhuận', slug: 'bat-dong-san-phu-nhuan' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
        ],
        relatedProjects: [
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
            { name: 'Masterise Homes', slug: 'masterise-homes' },
        ],
    },
    'bat-dong-san-phu-nhuan': {
        slug: 'bat-dong-san-phu-nhuan',
        name: 'Phú Nhuận',
        province: 'TP.HCM',
        searchQuery: 'Phú Nhuận',
        heroDescription:
            'Bất động sản Phú Nhuận — quận nội thành đắc địa TP.HCM, tiếp giáp Quận 1, Quận 3 và Bình Thạnh, cách sân bay Tân Sơn Nhất chỉ 5-10 phút. Nhà phố mặt tiền Phú Nhuận thuộc phân khúc cao cấp nhất nội đô, giá trị tích lũy bền vững và thanh khoản vượt trội. SGS LAND tư vấn mua bán nhà phố, biệt thự, căn hộ Phú Nhuận chuyên sâu.',
        stats: [
            { label: 'Diện tích', value: '4,88 km²' },
            { label: 'Dân số', value: '170.000+' },
            { label: 'Nhà phố mặt tiền', value: '150-300 tr/m²' },
            { label: 'Tốc độ tăng giá/năm', value: '8-15%' },
        ],
        highlights: [
            {
                title: 'Vị Trí Đắc Địa Trung Tâm TP.HCM',
                desc: 'Phú Nhuận tiếp giáp Quận 1 (Đinh Tiên Hoàng), Quận 3 (Trường Sa), Bình Thạnh và Tân Bình — kết nối mọi trung tâm kinh doanh, giáo dục, y tế lớn của thành phố trong 10-15 phút. Hạ tầng giao thông nội đô hoàn thiện, không bị ảnh hưởng bởi ngập lụt.',
            },
            {
                title: 'Gần Sân Bay Tân Sơn Nhất',
                desc: 'Khoảng cách đến sân bay Tân Sơn Nhất chỉ 2-4km — thuận lợi đặc biệt cho doanh nhân, chuyên gia nước ngoài và gia đình cần di chuyển thường xuyên. Đây là lợi thế hiếm có của BĐS Phú Nhuận so với các quận khác.',
            },
            {
                title: 'Nhà Phố Cao Cấp — Tài Sản Tích Lũy Bền Vững',
                desc: 'Nhà phố mặt tiền các tuyến đường lớn (Phan Đình Phùng, Hoàng Văn Thụ, Trường Sa) giá 150-300 triệu/m². Nhà hẻm xe hơi 80-150 triệu/m². Pháp lý sổ đỏ chính chủ, thanh khoản cao, nhu cầu thuê mặt bằng kinh doanh ổn định quanh năm.',
            },
            {
                title: 'Cộng Đồng Dân Cư Cao Cấp & Tiện Ích Đồng Bộ',
                desc: 'Phú Nhuận có mật độ trường học, bệnh viện, nhà hàng và trung tâm mua sắm cao bậc nhất TP.HCM. Trường Gia Định, Lê Quý Đôn, bệnh viện Gia Định, Vạn Hạnh Mall và hàng trăm quán cà phê, boutique cao cấp tạo nên hệ sinh thái sống chất lượng.',
            },
        ],
        faqs: [
            {
                q: 'Giá nhà phố Phú Nhuận hiện nay là bao nhiêu?',
                a: 'Giá nhà phố Phú Nhuận theo vị trí: mặt tiền đường lớn (Phan Đình Phùng, Hoàng Văn Thụ, Trường Sa) 150-300 triệu/m²; nhà hẻm xe hơi thông thoáng 80-150 triệu/m²; nhà hẻm nhỏ 50-80 triệu/m². Căn hộ chung cư cao cấp 60-120 triệu/m². Giá đã bao gồm vị trí nội đô đắc địa và pháp lý sổ đỏ ổn định.',
            },
            {
                q: 'BĐS Phú Nhuận có đáng đầu tư không?',
                a: 'Phú Nhuận là thị trường BĐS trú ẩn an toàn của TP.HCM — giá tăng đều đặn 8-15%/năm trong 10 năm qua, không có biến động mạnh như vùng ven. Thanh khoản vượt trội nhờ nhu cầu ở thực, kinh doanh và cho thuê văn phòng, mặt bằng từ doanh nhân và chuyên gia nước ngoài.',
            },
            {
                q: 'Khu vực nào của Phú Nhuận có tiềm năng đầu tư tốt nhất?',
                a: 'Ba cụm đáng chú ý: (1) Trục Phan Đình Phùng – Nguyễn Kiệm: sầm uất, mặt bằng kinh doanh cho thuê 50-150 triệu/tháng; (2) Trường Sa – Hoàng Sa ven kênh: view đẹp, nhiều nhà hàng cao cấp, giá tăng đều; (3) Cống Quỳnh – Yên Đỗ: yên tĩnh, phù hợp ở thực, giá hợp lý hơn. SGS LAND tư vấn theo nhu cầu cụ thể.',
            },
            {
                q: 'Cho thuê nhà phố Phú Nhuận thu nhập bao nhiêu mỗi tháng?',
                a: 'Cho thuê mặt bằng kinh doanh: mặt tiền đường lớn 50-200 triệu/tháng (tùy diện tích); nhà hẻm xe hơi 20-60 triệu/tháng. Cho thuê nhà nguyên căn ở: nhà 4-5 tầng 30-80 triệu/tháng. Gross yield cho thuê mặt bằng thường đạt 5-8%/năm, ổn định hơn phân khúc vùng ven.',
            },
            {
                q: 'Gần sân bay Tân Sơn Nhất có ảnh hưởng gì đến BĐS Phú Nhuận không?',
                a: 'Gần sân bay Tân Sơn Nhất (2-4km) là lợi thế kép: thuận tiện cho người di chuyển thường xuyên và tạo nhu cầu thuê nhà, văn phòng từ chuyên gia hàng không, phi công, tiếp viên và doanh nhân quốc tế. Đây là yếu tố giữ cho thị trường cho thuê Phú Nhuận luôn sôi động.',
            },
            {
                q: 'So sánh BĐS Phú Nhuận và Bình Thạnh — nên chọn đâu?',
                a: 'Phú Nhuận: nhỏ hơn, giá cao hơn 20-40%, gần Q1/Q3 hơn, tiện ích cao cấp hơn, pháp lý sổ đỏ ổn định — phù hợp đầu tư dài hạn và ở thực cao cấp. Bình Thạnh: diện tích lớn hơn, giá vừa hơn, có nhiều dự án căn hộ mới, thị trường cho thuê sôi động nhờ Vinhomes Central Park. Chọn theo ngân sách và mục tiêu đầu tư.',
            },
            {
                q: 'Pháp lý nhà phố Phú Nhuận có minh bạch không?',
                a: 'Phú Nhuận là quận nội thành lâu đời, hầu hết nhà phố đã có sổ đỏ/sổ hồng chính chủ rõ ràng. Tỷ lệ nhà quy hoạch lộ giới thấp hơn các quận ven. SGS LAND kiểm tra quy hoạch 1/500, lịch sử giao dịch và tình trạng pháp lý miễn phí trước khi tư vấn giao dịch.',
            },
            {
                q: 'Nhà hẻm Phú Nhuận giá bao nhiêu và có đáng mua không?',
                a: 'Nhà hẻm xe hơi (4m trở lên) Phú Nhuận: 80-150 triệu/m², nhà 4x15m từ 7-15 tỷ. Nhà hẻm nhỏ (2-3m): 50-80 triệu/m², từ 4-8 tỷ. Đây là phân khúc hợp lý để ở thực trong nội đô — an toàn, thanh khoản tốt và tăng giá ổn định. Phù hợp ngân sách 5-15 tỷ.',
            },
            {
                q: 'Tiện ích và trường học tại Phú Nhuận có tốt không?',
                a: 'Phú Nhuận có mật độ tiện ích cao hàng đầu TP.HCM: THPT Gia Định (top 3 TP.HCM), THPT Lê Quý Đôn, bệnh viện Gia Định, BV Quận Phú Nhuận, Vạn Hạnh Mall, hàng trăm quán cà phê cao cấp, nhà hàng đa ẩm thực, gym, spa. Lý tưởng cho gia đình có con ở thực.',
            },
            {
                q: 'SGS LAND tư vấn mua nhà Phú Nhuận như thế nào?',
                a: 'SGS LAND tra cứu quy hoạch thực địa Phú Nhuận (lộ giới, cốt nền, tranh chấp), định giá AI so sánh giao dịch thực tế khu vực, xác minh pháp lý sổ đỏ và hỗ trợ đàm phán giá. Không thu phí tư vấn từ người mua — chỉ hưởng hoa hồng từ bên bán khi giao dịch thành công.',
            },
            {
                q: 'Xu hướng giá BĐS Phú Nhuận trong 5 năm tới sẽ như thế nào?',
                a: 'BĐS Phú Nhuận được hỗ trợ bởi ba yếu tố dài hạn: (1) Quỹ đất nội thành ngày càng khan hiếm — không thể mở rộng; (2) Mở rộng Metro số 2 (Bến Thành – Tham Lương) đi qua Phú Nhuận dự kiến vận hành 2028-2030; (3) Cải tạo kênh Nhiêu Lộc – Thị Nghè kết hợp greenway ven kênh. Dự báo tăng giá 10-18%/năm trong 5 năm tới.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Quận 7', slug: 'bat-dong-san-quan-7' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
            { name: 'BĐS Bình Dương', slug: 'bat-dong-san-binh-duong' },
        ],
        relatedProjects: [
            { name: 'Grand Manhattan Novaland', slug: 'manhattan' },
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
        ],
    },
    'bat-dong-san-binh-chanh': {
        slug: 'bat-dong-san-binh-chanh',
        name: 'Bình Chánh',
        province: 'TP.HCM',
        searchQuery: 'Bình Chánh',
        heroDescription:
            'Bất động sản Bình Chánh — cửa ngõ phía Tây Nam TP.HCM, hưởng lợi trực tiếp từ Vành đai 3, Vành đai 4, Metro số 3a và quy hoạch lên thành phố vệ tinh. Quỹ đất rộng, giá còn hợp lý so với nội đô, hạ tầng giao thông kết nối nhanh về Quận 1 (15-25 phút) và miền Tây. SGS LAND tư vấn mua bán đất nền, nhà phố, dự án Bình Chánh chuyên sâu.',
        stats: [
            { label: 'Diện tích', value: '252 km²' },
            { label: 'Dân số', value: '740.000+' },
            { label: 'Giá đất nền', value: '25-80 tr/m²' },
            { label: 'Tốc độ tăng giá/năm', value: '12-20%' },
        ],
        highlights: [
            {
                title: 'Hưởng Lợi Trực Tiếp Từ Vành Đai 3 & 4',
                desc: 'Vành đai 3 đoạn qua Bình Chánh (dài 16km, dự kiến hoàn thành 2026) và Vành đai 4 trong tương lai biến Bình Chánh thành điểm trung chuyển chính của vùng kinh tế trọng điểm phía Nam. BĐS dọc hai trục này được dự báo tăng 30-50% khi thông xe.',
            },
            {
                title: 'Cửa Ngõ Tây Nam — Kết Nối Miền Tây',
                desc: 'Bình Chánh là cửa ngõ TP.HCM về 13 tỉnh miền Tây qua QL1A, QL50 và cao tốc TP.HCM – Trung Lương. Vị trí chiến lược cho logistics, kho bãi, khu công nghiệp và thương mại liên vùng — nguồn cầu BĐS bền vững.',
            },
            {
                title: 'Quỹ Đất Lớn — Giá Còn Hợp Lý',
                desc: 'Diện tích 252 km² (gấp 50 lần Q1) với quỹ đất nông nghiệp lớn đang chuyển đổi sang đô thị. Đất nền Bình Chánh 25-80 triệu/m² (rẻ hơn TP Thủ Đức 50-70%), nhà phố dự án 4-12 tỷ — hợp với nhà đầu tư tích lũy dài hạn và gia đình trẻ.',
            },
            {
                title: 'Quy Hoạch Lên Thành Phố Vệ Tinh',
                desc: 'Đề án nâng Bình Chánh từ huyện lên thành phố trực thuộc TP.HCM (cùng với Hóc Môn, Củ Chi) đang được TP triển khai. Khi thành lập, hạ tầng, dịch vụ công và giá BĐS Bình Chánh sẽ tăng tốc rõ rệt — như đã thấy với TP Thủ Đức (tăng 80-150% sau khi thành lập).',
            },
        ],
        faqs: [
            {
                q: 'Bất động sản Bình Chánh có đáng đầu tư không?',
                a: 'Có. Bình Chánh hội tụ ba yếu tố tăng trưởng dài hạn: (1) Vành đai 3 thông xe 2026 và Vành đai 4 đang quy hoạch; (2) Quy hoạch lên thành phố vệ tinh trực thuộc TP.HCM; (3) Quỹ đất lớn còn rẻ so với nội đô. Tốc độ tăng giá trung bình 12-20%/năm trong 5 năm qua, dự báo tiếp tục mạnh khi hạ tầng hoàn thiện.',
            },
            {
                q: 'Giá đất nền và nhà phố Bình Chánh hiện nay là bao nhiêu?',
                a: 'Đất nền Bình Chánh theo khu vực: Bình Hưng – Phong Phú (gần Q8) 60-100 triệu/m²; Tân Túc – thị trấn 40-70 triệu/m²; Tân Kiên – Vĩnh Lộc A/B 25-50 triệu/m²; Lê Minh Xuân – Bình Lợi 15-30 triệu/m². Nhà phố dự án (Khang Điền, T&T, Nam Long) 4-12 tỷ; nhà phố hẻm 2,5-6 tỷ.',
            },
            {
                q: 'Khu vực nào của Bình Chánh có tiềm năng đầu tư tốt nhất?',
                a: 'Ba khu nổi bật: (1) Bình Hưng – Phong Phú (giáp Q8): đô thị hóa nhanh, gần trung tâm 15-20 phút, giá 60-100 triệu/m²; (2) Tân Kiên – gần ga Metro số 3a tương lai, giá còn hợp lý 25-50 triệu/m²; (3) Vĩnh Lộc A/B – ven Vành đai 3, đất nền giá 20-40 triệu/m², tiềm năng tăng mạnh khi Vành đai thông xe.',
            },
            {
                q: 'Vành đai 3 đi qua Bình Chánh ảnh hưởng giá BĐS thế nào?',
                a: 'Vành đai 3 đoạn qua Bình Chánh dài 16km, có 4 nút giao chính: Tân Vạn, Tân Kiên, Bình Chánh và Mỹ Yên. BĐS bán kính 1-3km quanh các nút giao đã tăng 30-50% từ khi khởi công 2023. Khi thông xe 2026, dự báo tăng tiếp 30-40% nhờ rút ngắn thời gian về Q1 còn 20-25 phút.',
            },
            {
                q: 'Khi nào Bình Chánh lên thành phố vệ tinh?',
                a: 'Đề án nâng Bình Chánh, Hóc Môn, Củ Chi lên thành phố trực thuộc TP.HCM đang được TP HCM lập hồ sơ trình Quốc hội. Lộ trình dự kiến 2026-2030. Khi được phê duyệt, Bình Chánh sẽ có cấp ngân sách đô thị riêng, hạ tầng được đầu tư mạnh — kịch bản tương tự TP Thủ Đức (giá BĐS tăng 80-150% sau khi thành lập 2021).',
            },
            {
                q: 'Bình Chánh hay Long An nên đầu tư đất nền?',
                a: 'Bình Chánh: thuộc TP.HCM, hạ tầng tốt hơn, thanh khoản cao hơn, giá 25-80 triệu/m², gần Q1 hơn (15-25 phút). Long An giáp Bình Chánh: rẻ hơn 30-50%, tiềm năng dài hạn khi Vành đai 4 hoàn thành. Ngân sách dưới 1,5 tỷ → Long An; trên 2 tỷ → ưu tiên Bình Chánh để đảm bảo thanh khoản và pháp lý TP.HCM.',
            },
            {
                q: 'Pháp lý BĐS Bình Chánh có rủi ro gì cần lưu ý?',
                a: 'Bình Chánh có nhiều loại đất hỗn hợp (nông nghiệp, ở nông thôn, ở đô thị) — cần kiểm tra kỹ quy hoạch 1/500 và mục đích sử dụng đất trước khi mua. Tránh đất nông nghiệp chưa chuyển mục đích, đất nằm trong quy hoạch lộ giới Vành đai. SGS LAND kiểm tra quy hoạch, sổ đỏ, lịch sử giao dịch và tình trạng tranh chấp miễn phí trước khi tư vấn.',
            },
            {
                q: 'Khu công nghiệp Bình Chánh ảnh hưởng thế nào đến BĐS?',
                a: 'Bình Chánh có 4 KCN lớn: Lê Minh Xuân, Vĩnh Lộc, Tân Tạo và An Hạ — thu hút 80.000+ lao động và chuyên gia, tạo nhu cầu nhà cho thuê và mua ổn định. BĐS bán kính 3-5km KCN luôn có thanh khoản tốt cho phân khúc giá 1,5-3,5 tỷ (đối tượng công nhân, kỹ sư, quản lý KCN).',
            },
            {
                q: 'Cho thuê nhà trọ Bình Chánh thu nhập bao nhiêu?',
                a: 'Nhà trọ phục vụ KCN: phòng đơn 1,5-2,5 triệu/tháng; phòng đôi 2,5-4 triệu. Dãy 10 phòng đầu tư 2-3,5 tỷ cho thu nhập 20-35 triệu/tháng (gross yield 8-12%/năm). Nhà phố cho thuê nguyên căn ở khu Bình Hưng – Phong Phú 8-18 triệu/tháng. Nhu cầu thuê ổn định nhờ KCN và dân nhập cư từ miền Tây.',
            },
            {
                q: 'SGS LAND có dự án nào tại Bình Chánh không?',
                a: 'SGS LAND phân phối các dự án nổi bật tại Bình Chánh: Khu đô thị Nam Long Bình Chánh, Khang Điền Bình Chánh, T&T Bình Chánh, các khu compound nhà phố ven Vành đai 3. Ngoài ra cập nhật hàng ngày kho đất nền sổ đỏ Bình Hưng, Tân Túc, Tân Kiên với pháp lý đã kiểm tra. Liên hệ để nhận danh sách miễn phí.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Quận 7', slug: 'bat-dong-san-quan-7' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
            { name: 'BĐS Bình Dương', slug: 'bat-dong-san-binh-duong' },
        ],
        relatedProjects: [
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
            { name: 'The Global City', slug: 'the-global-city' },
        ],
    },
    'dau-tu-bat-dong-san': {
        slug: 'dau-tu-bat-dong-san',
        name: 'Đầu Tư',
        h1Title: 'Đầu Tư Bất Động Sản Hiệu Quả 2026',
        province: 'Việt Nam',
        searchQuery: '',
        heroDescription: 'Hướng dẫn đầu tư bất động sản toàn diện từ chuyên gia SGS LAND: phân tích thị trường, chiến lược chọn BĐS sinh lời, tính toán dòng tiền, quản lý danh mục và tối ưu thuế. Phù hợp cả nhà đầu tư mới lẫn có kinh nghiệm — cập nhật theo Luật Đất đai 2024.',
        stats: [
            { label: 'Tỷ suất sinh lợi BĐS trung bình/năm', value: '12–18%' },
            { label: 'Nhà đầu tư tin dùng SGS LAND', value: '5.000+' },
            { label: 'Dự án đang phân phối', value: '50+' },
            { label: 'Năm kinh nghiệm thị trường', value: '10+' },
        ],
        highlights: [
            {
                title: 'Phân Tích Thị Trường & Chọn Vị Trí',
                desc: 'Vị trí quyết định 60–70% giá trị BĐS. SGS LAND cung cấp phân tích hạ tầng, quy hoạch, dòng tiền dân cư và tiềm năng tăng giá từng khu vực — giúp bạn ra quyết định có cơ sở dữ liệu.',
            },
            {
                title: 'Tính Toán Dòng Tiền & ROI',
                desc: 'Trước khi đầu tư, cần tính đủ: giá mua + thuế phí + chi phí cải tạo + lãi vay + vận hành. SGS LAND cung cấp công cụ AI định giá và mô phỏng dòng tiền miễn phí cho mọi giao dịch.',
            },
            {
                title: 'Chiến Lược Đầu Tư Theo Ngân Sách',
                desc: 'Dưới 1 tỷ: đất nền ven đô, phòng trọ KCN. 1–3 tỷ: căn hộ cho thuê, nhà phố nhỏ. 3–10 tỷ: nhà phố thương mại, căn hộ cao cấp. Trên 10 tỷ: biệt thự dự án, shophouse. Mỗi phân khúc có chiến lược exit khác nhau.',
            },
            {
                title: 'Quản Lý Rủi Ro & Pháp Lý',
                desc: 'Rủi ro lớn nhất khi đầu tư BĐS: pháp lý không rõ ràng, đòn bẩy tài chính quá cao và mua đỉnh chu kỳ. SGS LAND kiểm tra pháp lý độc lập và tư vấn cấu trúc tài chính tối ưu cho từng khoản đầu tư.',
            },
        ],
        faqs: [
            {
                q: 'Đầu tư bất động sản cần bao nhiêu vốn tối thiểu?',
                a: 'Tối thiểu 200–500 triệu đồng để đầu tư đất nền ven đô hoặc góp vốn dự án. Từ 1–1,5 tỷ bắt đầu mua căn hộ chung cư cho thuê (sử dụng đòn bẩy ngân hàng 50–70%). Lý tưởng nhất từ 2–3 tỷ để đa dạng hoá danh mục và chủ động vốn tự có ≥30%. SGS LAND tư vấn cơ cấu vốn và kết nối ngân hàng miễn phí.',
            },
            {
                q: 'Tỷ suất sinh lời BĐS tại Việt Nam hiện nay là bao nhiêu?',
                a: 'Tỷ suất sinh lời gộp (bao gồm tăng giá + cho thuê) trung bình 12–18%/năm, cao hơn đáng kể so với gửi ngân hàng (5–6%) và chứng khoán (8–12%). Phân khúc đất nền ven đô tăng 15–30%/năm giai đoạn 2020–2025. Căn hộ cho thuê tại TP.HCM tỷ suất cho thuê thuần 5–8%/năm.',
            },
            {
                q: 'Nên đầu tư đất nền hay căn hộ?',
                a: 'Đất nền: tiềm năng tăng giá cao hơn (20–40%/năm giai đoạn tốt), ít phí vận hành, nhưng thanh khoản chậm hơn, khó cho thuê. Căn hộ: dòng tiền ổn định từ cho thuê (8–16 triệu/tháng), thanh khoản tốt hơn, quản lý dễ hơn nhưng tốc độ tăng giá thấp hơn. Chiến lược tối ưu: đất nền dài hạn 5–10 năm, căn hộ trung hạn 3–5 năm tạo dòng tiền.',
            },
            {
                q: 'Mua BĐS bằng đòn bẩy ngân hàng có rủi ro không?',
                a: 'Đòn bẩy tài chính là con dao hai lưỡi: tối đa hoá lợi nhuận khi thị trường tăng nhưng khuếch đại thua lỗ khi thị trường xuống. Nguyên tắc an toàn: vốn tự có ≥30%, dòng tiền cho thuê ≥80% tiền lãi vay, không dùng đòn bẩy trên 60% với đất nền thuần tuý. SGS LAND tư vấn cơ cấu tài chính cá nhân hoá.',
            },
            {
                q: 'Chu kỳ bất động sản Việt Nam kéo dài bao lâu?',
                a: 'Chu kỳ BĐS Việt Nam thường 7–10 năm, gồm 4 giai đoạn: tích lũy (giá đi ngang) → tăng trưởng (20–40%/năm) → bong bóng (đầu cơ, volume giảm) → điều chỉnh (giá giảm 10–30%). Giai đoạn 2023–2024 là đáy điều chỉnh, 2025–2027 dự báo chu kỳ tăng mới nhờ hạ tầng, Luật Đất đai 2024 và FDI.',
            },
            {
                q: 'Thuế và phí khi mua bán BĐS gồm những khoản nào?',
                a: 'Người mua chịu: phí công chứng 0,1% giá trị, phí trước bạ 0,5% (nhà đất) hoặc 2% (căn hộ lần đầu được ưu đãi). Người bán chịu: thuế thu nhập 2% trên giá bán. Tổng phí giao dịch thực tế 2–4% giá trị BĐS. SGS LAND hỗ trợ tối ưu cấu trúc giao dịch hợp pháp để tiết kiệm chi phí.',
            },
            {
                q: 'BĐS nghỉ dưỡng (condotel, biệt thự biển) có nên đầu tư không?',
                a: 'BĐS nghỉ dưỡng tiềm năng nhưng rủi ro cao hơn BĐS dân cư: pháp lý phức tạp (condotel chưa có sổ riêng), cam kết lợi nhuận thường không được thực hiện đầy đủ, thanh khoản thấp. Chỉ phù hợp nhà đầu tư dài hạn 10+ năm với vốn nhàn rỗi. SGS LAND tư vấn kỹ pháp lý và so sánh dự án trước khi quyết định.',
            },
            {
                q: 'Làm sao chọn được BĐS sinh lời tốt nhất?',
                a: '5 tiêu chí vàng: (1) Vị trí gần tiện ích, hạ tầng đang phát triển; (2) Pháp lý sổ đỏ/sổ hồng sạch, không tranh chấp; (3) Giá thấp hơn thị trường 5–15%; (4) Khu vực có giao dịch thực tế; (5) Cho thuê ≥60% lãi vay. SGS LAND dùng AI định giá so sánh và lọc BĐS theo 5 tiêu chí này trước khi tư vấn.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
            { name: 'Pháp Lý Nhà Đất', slug: 'phap-ly-nha-dat' },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
        ],
    },
    'phap-ly-nha-dat': {
        slug: 'phap-ly-nha-dat',
        name: 'Nhà Đất',
        h1Title: 'Hướng Dẫn Pháp Lý Nhà Đất 2026',
        province: 'Việt Nam',
        searchQuery: '',
        heroDescription: 'Hướng dẫn pháp lý nhà đất toàn diện 2026: kiểm tra sổ đỏ/sổ hồng, tra cứu quy hoạch đất, thủ tục mua bán, công chứng, sang tên và giải quyết tranh chấp. SGS LAND kiểm tra pháp lý miễn phí trong 24 giờ cho mọi giao dịch.',
        stats: [
            { label: 'Giao dịch được kiểm tra pháp lý', value: '10.000+' },
            { label: 'Tỉ lệ giao dịch an toàn', value: '99,8%' },
            { label: 'Chuyên gia pháp lý BĐS', value: '50+' },
            { label: 'Tiết kiệm chi phí tranh chấp', value: '500 tỷ+' },
        ],
        highlights: [
            {
                title: 'Kiểm Tra Sổ Đỏ / Sổ Hồng',
                desc: 'Xác minh: chủ sở hữu, số thửa, diện tích, mục đích sử dụng đất, thời hạn sử dụng. Tra cứu tình trạng thế chấp, phong tỏa tại ngân hàng và cơ quan đăng ký đất đai. SGS LAND thực hiện miễn phí trong 24 giờ.',
            },
            {
                title: 'Tra Cứu Quy Hoạch Đất',
                desc: 'Kiểm tra bản đồ quy hoạch sử dụng đất 1/500, 1/2000 và 1/5000. Xác định đất có nằm trong quy hoạch lộ giới, hành lang an toàn hay vùng bảo tồn không. Đây là bước bắt buộc trước khi đặt cọc bất kỳ BĐS nào.',
            },
            {
                title: 'Thủ Tục Mua Bán & Công Chứng',
                desc: 'Quy trình chuẩn: đặt cọc (10%) → kiểm tra pháp lý → ký HĐMB có công chứng → nộp thuế phí → sang tên tại VPĐK đất đai → nhận sổ đỏ mới. Thời gian trung bình 30–60 ngày. SGS LAND đồng hành toàn bộ quy trình.',
            },
            {
                title: 'Phòng Tránh Rủi Ro Pháp Lý',
                desc: 'Những BĐS cần tránh: đất nông nghiệp chưa chuyển mục đích, đất chung sổ chưa tách thửa, BĐS đang thế chấp ngân hàng, dự án chưa đủ điều kiện mở bán, đất tranh chấp thừa kế. SGS LAND lập checklist pháp lý 50+ điểm cho mỗi giao dịch.',
            },
        ],
        faqs: [
            {
                q: 'Sổ đỏ và sổ hồng khác nhau như thế nào?',
                a: 'Sổ đỏ (GCNQSDĐ) cấp trước 2009 — thường cho đất thuần tuý. Sổ hồng (GCNQSDĐ và tài sản gắn liền) cấp từ 2009, thể hiện cả đất lẫn công trình xây dựng trên đất. Từ 2025, Luật Đất đai 2024 quy định cấp một loại giấy chứng nhận thống nhất. Cả hai đều có giá trị pháp lý như nhau khi giao dịch.',
            },
            {
                q: 'Đặt cọc mua nhà bao nhiêu phần trăm là hợp lý?',
                a: 'Thông lệ đặt cọc 10% giá trị BĐS, tối đa 20%. Pháp lý: nếu bên mua bỏ cọc thì mất tiền cọc; nếu bên bán bội ước phải bồi thường gấp đôi tiền cọc. Bắt buộc kiểm tra pháp lý sổ đỏ, quy hoạch và tình trạng thế chấp TRƯỚC khi ký đặt cọc. SGS LAND soạn hợp đồng đặt cọc chuẩn miễn phí cho khách hàng.',
            },
            {
                q: 'Quy trình sang tên sổ đỏ mất bao lâu và tốn bao nhiêu?',
                a: 'Thời gian: 15–30 ngày làm việc (có thể lên 45–60 ngày nếu cần giải chấp). Chi phí: phí công chứng 0,1% + phí trước bạ 0,5% (đất) + phí đăng ký 0,03% + lệ phí địa chính. Tổng phí thực tế 1–3% giá trị BĐS. SGS LAND hỗ trợ toàn bộ hồ sơ và giải thích từng khoản.',
            },
            {
                q: 'Mua đất thổ cư và đất nông nghiệp khác nhau thế nào về pháp lý?',
                a: 'Đất thổ cư (ONT/ODT): được xây dựng nhà ở, giao dịch tự do, pháp lý rõ ràng — ưu tiên mua để ở hoặc đầu tư. Đất nông nghiệp (LUC, CLN): không được xây nhà ở trái phép, muốn xây cần xin chuyển mục đích sử dụng đất (1–3 năm, chi phí 10–30% giá đất). Rủi ro cao khi mua đất nông nghiệp phân lô bán nền chưa qua chuyển mục đích.',
            },
            {
                q: 'Làm sao kiểm tra BĐS có đang bị thế chấp ngân hàng không?',
                a: 'Ba cách kiểm tra: (1) Yêu cầu bên bán xuất trình bản gốc sổ đỏ — nếu đang thế chấp, ngân hàng đang giữ sổ; (2) Tra cứu tại Văn phòng đăng ký đất đai cấp huyện; (3) Nhờ SGS LAND tra cứu chuyên nghiệp bao gồm lịch sử giao dịch và tình trạng thế chấp trong 24 giờ miễn phí.',
            },
            {
                q: 'Mua nhà trong dự án chung cư cần kiểm tra pháp lý gì?',
                a: 'Checklist pháp lý chung cư: (1) Chủ đầu tư đã có sổ đỏ khu đất chưa; (2) Giấy phép xây dựng đã cấp chưa; (3) Đã được ngân hàng bảo lãnh theo Luật Nhà ở 2023; (4) Hợp đồng mua bán theo mẫu Bộ Xây dựng; (5) Phí bảo trì 2% đã rõ ràng chưa; (6) Tiến độ bàn giao thực tế so với cam kết.',
            },
            {
                q: 'Tranh chấp BĐS giải quyết ở đâu và mất bao lâu?',
                a: 'Tranh chấp BĐS giải quyết qua 3 kênh: hòa giải tại UBND phường/xã (miễn phí, 45 ngày) → khởi kiện Tòa án nhân dân cấp huyện/tỉnh (6–24 tháng, án phí 5% giá trị tranh chấp) → thi hành án (thêm 6–12 tháng). Phòng tránh tốt nhất là kiểm tra pháp lý kỹ trước giao dịch — SGS LAND hỗ trợ miễn phí.',
            },
            {
                q: 'Luật Đất đai 2024 có thay đổi gì quan trọng với người mua nhà đất?',
                a: 'Luật Đất đai 2024 (hiệu lực 1/1/2025) có 5 thay đổi chính: (1) Cấm chia lô bán nền tại đô thị lớn; (2) Bỏ khung giá đất Nhà nước, áp dụng giá thị trường; (3) Minh bạch hóa quy hoạch đất online; (4) Tăng thời hạn thuê đất thương mại lên 70 năm; (5) Người Việt định cư nước ngoài được mua nhà dễ hơn. SGS LAND cập nhật tư vấn theo quy định mới nhất.',
            },
        ],
        relatedLocations: [
            { name: 'Đầu Tư BĐS', slug: 'dau-tu-bat-dong-san' },
            { name: 'BĐS Đồng Nai', slug: 'bat-dong-san-dong-nai' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
            { name: 'BĐS Bình Chánh', slug: 'bat-dong-san-binh-chanh' },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'Izumi City Nam Long', slug: 'izumi-city' },
        ],
    },
    'bat-dong-san-binh-thanh': {
        slug: 'bat-dong-san-binh-thanh',
        name: 'Bình Thạnh',
        province: 'TP.HCM',
        searchQuery: 'Bình Thạnh',
        heroDescription: 'Mua bán căn hộ, nhà phố Bình Thạnh TP.HCM 2026: Vinhomes Central Park (Landmark 81), Masterise Grand Marina Saigon, Lumière Riverside. Điểm nóng BĐS hạng sang — ven sông Sài Gòn, sát trung tâm Q1, cộng đồng expat đông đảo. SGS LAND tư vấn miễn phí.',
        stats: [
            { label: 'Giá căn hộ cao cấp', value: '50–400 tr/m²' },
            { label: 'Tỷ suất cho thuê', value: '4–7%/năm' },
            { label: 'Cách trung tâm Q1', value: '5–10 phút' },
            { label: 'Tốc độ tăng giá/năm', value: '8–15%' },
        ],
        highlights: [
            {
                title: 'Ven Sông Sài Gòn — View Đẹp Nhất Nội Đô',
                desc: 'Bình Thạnh sở hữu mặt tiền sông Sài Gòn dài nhất TP.HCM, là nơi tọa lạc của Vinhomes Central Park, Masterise Grand Marina, Lumière Riverside — những dự án căn hộ ven sông đẳng cấp nhất Đông Nam Á. Giá trị view sông không thể tái tạo, tạo lợi thế cạnh tranh bền vững dài hạn.',
            },
            {
                title: 'Landmark 81 — Biểu Tượng TP.HCM',
                desc: 'Landmark 81 (tòa nhà cao nhất Đông Nam Á, 461m) tọa lạc tại Vinhomes Central Park Bình Thạnh là điểm định vị thương hiệu mạnh nhất của khu vực. BĐS quanh Landmark 81 luôn dẫn đầu về giá cho thuê (20–80 triệu/tháng) và tỷ suất tăng giá 10–18%/năm.',
            },
            {
                title: 'Cộng Đồng Expat & Chuyên Gia FDI',
                desc: 'Bình Thạnh có mật độ người nước ngoài và chuyên gia FDI cao nhất TP.HCM — tạo ra thị trường cho thuê cao cấp ổn định nhất thành phố. Tỷ suất lấp đầy căn hộ cao cấp luôn duy trì trên 90%, giá thuê 20–80 triệu/tháng ngay cả giai đoạn thị trường khó khăn.',
            },
            {
                title: 'Metro Số 1 & Hạ Tầng Giao Thông Hoàn Thiện',
                desc: 'Hai ga Metro số 1 (Văn Thánh và Bình Thạnh) kết nối trực tiếp với Bến Thành Q1, Suối Tiên và sân bay Long Thành tương lai. BĐS bán kính 500m từ ga Metro tăng 15–25% từ khi thông tin xác nhận và dự báo tiếp tục tăng khi vận hành thương mại đầy đủ.',
            },
        ],
        faqs: [
            {
                q: 'Top 3 dự án căn hộ cao cấp nhất Bình Thạnh TP.HCM 2026?',
                a: 'Top 3 dự án căn hộ Bình Thạnh 2026: (1) Vinhomes Central Park (Landmark 81) — biểu tượng TP.HCM, căn hộ 50–200 triệu/m²; (2) Masterise Grand Marina Saigon — branded residence IHG Hotel, 120–250 triệu/m²; (3) Lumière Riverside (Masterise) — ven sông Sài Gòn, 80–150 triệu/m². Cả ba đều ven sông, pháp lý sổ hồng vĩnh viễn.',
            },
            {
                q: 'Giá căn hộ Bình Thạnh TP.HCM hiện nay là bao nhiêu?',
                a: 'Giá căn hộ Bình Thạnh theo phân khúc 2026: Hạng sang (Vinhomes Central Park, Grand Marina): 80–400 triệu/m²; Cao cấp (Lumière, The Ascent, Masteri Thảo Điền): 60–120 triệu/m²; Trung cấp (Lexington, Saigon Gate): 40–70 triệu/m². Nhà phố hẻm xe hơi: 80–200 triệu/m².',
            },
            {
                q: 'Tại sao Bình Thạnh là điểm nóng BĐS hạng sang TP.HCM?',
                a: 'Bình Thạnh có 5 lợi thế: (1) Ven sông Sài Gòn — view đẹp nhất nội đô; (2) Sát trung tâm Q1 chỉ 5–10 phút; (3) Landmark 81 — tòa nhà cao nhất Đông Nam Á; (4) Cộng đồng người nước ngoài, chuyên gia FDI đông; (5) Đường Nguyễn Hữu Cảnh và metro số 1 (Bình Thạnh–Q1) giảm ùn tắc.',
            },
            {
                q: 'Vinhomes Central Park Bình Thạnh giá bao nhiêu?',
                a: 'Vinhomes Central Park thứ cấp 2026: căn hộ Studio–1PN từ 3,5–5 tỷ; 2PN từ 5–9 tỷ; 3PN từ 8–15 tỷ. Penthouse Landmark 81: 40–120 tỷ. Tỷ suất cho thuê 4–7%/năm, rất ổn định với cộng đồng expat đông đảo.',
            },
            {
                q: 'Grand Marina Saigon (Masterise) Bình Thạnh là gì?',
                a: 'Grand Marina Saigon là dự án branded residence hạng sang TP.HCM đầu tiên — hợp tác với InterContinental Hotels Group. Tọa lạc bờ sông Sài Gòn Q1/Bình Thạnh, bao gồm tháp căn hộ (từ 120 triệu/m²), hotel IHG 5 sao và marina thuyền du lịch. Pháp lý sổ hồng vĩnh viễn.',
            },
            {
                q: 'Nhà phố Bình Thạnh giá bao nhiêu và có đáng đầu tư không?',
                a: 'Nhà phố mặt tiền đường lớn Bình Thạnh (Đinh Tiên Hoàng, Phan Văn Trị): 150–350 triệu/m². Nhà hẻm xe hơi: 60–120 triệu/m². Tăng giá 8–15%/năm ổn định 10 năm qua. Cho thuê mặt bằng kinh doanh 30–100 triệu/tháng. Rất đáng đầu tư dài hạn với thanh khoản tốt nhất TP.HCM.',
            },
            {
                q: 'Metro số 1 ảnh hưởng giá BĐS Bình Thạnh thế nào?',
                a: 'Metro số 1 (Bến Thành–Suối Tiên) có 2 ga qua Bình Thạnh: Văn Thánh (hiện vận hành thử) và ga Bình Thạnh. BĐS bán kính 500m quanh ga tăng 15–25% từ khi thông tin metro xác nhận. Khi vận hành thương mại đầy đủ 2025–2026, dự báo thêm 10–20% thanh khoản.',
            },
            {
                q: 'So sánh BĐS Bình Thạnh và Quận 7 — nên chọn đâu?',
                a: 'Bình Thạnh: ven sông Sài Gòn, sát Q1, cộng đồng expat đông, phân khúc hạng sang 80–400 triệu/m², cho thuê quốc tế 20–80 triệu/tháng. Quận 7 (Phú Mỹ Hưng): quy hoạch đô thị hoàn chỉnh hơn, cộng đồng Hàn–Nhật đông, giá 60–180 triệu/m², môi trường sống yên tĩnh hơn. Chọn Bình Thạnh nếu muốn đầu tư sinh lời cao; Quận 7 nếu ưu tiên ở thực cao cấp.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Quận 7', slug: 'bat-dong-san-quan-7' },
            { name: 'BĐS Phú Nhuận', slug: 'bat-dong-san-phu-nhuan' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
        ],
        relatedProjects: [
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
            { name: 'Vinhomes Grand Park', slug: 'vinhomes-grand-park' },
        ],
    },
    'bat-dong-san-long-an': {
        slug: 'bat-dong-san-long-an',
        name: 'Long An',
        province: 'Long An',
        searchQuery: 'Long An',
        heroDescription: 'Mua bán bất động sản Long An 2026: đất nền Đức Hòa 5–20 triệu/m², Bến Lức 8–25 triệu/m², Cần Đước 4–12 triệu/m². Cửa ngõ TP.HCM phía Tây – Tây Nam, hưởng lợi Vành đai 3 & 4, logistics và KCN bùng nổ. SGS LAND tư vấn miễn phí.',
        stats: [
            { label: 'Giá đất nền Đức Hòa', value: '5–20 tr/m²' },
            { label: 'Giá đất nền Bến Lức', value: '8–25 tr/m²' },
            { label: 'Tổng FDI đăng ký', value: '8,5 tỷ USD' },
            { label: 'KCN lớn đang hoạt động', value: '35+ KCN' },
        ],
        highlights: [
            {
                title: 'Hưởng Lợi Vành Đai 3 & 4 — Giá Còn Rẻ',
                desc: 'Long An là tỉnh giáp TP.HCM duy nhất hưởng lợi đồng thời Vành đai 3 (đoạn Bến Lức–Nhơn Trạch, thông xe 2026) và Vành đai 4 (đang quy hoạch). Đất bán kính 3km quanh nút giao tăng 20–40% kể từ khởi công. Giá vẫn chỉ bằng 30–50% Bình Chánh — window cơ hội còn lớn.',
            },
            {
                title: 'Trung Tâm Logistics & KCN Lớn Nhất Vùng',
                desc: 'Long An có 35+ KCN với tổng diện tích 10.000ha — lớn nhất vùng kinh tế trọng điểm phía Nam. KCN Long Hậu (chuyên logistics ven sông Soài Rạp), KCN Tân Đô, KCN Xuyên Á thu hút 8,5 tỷ USD FDI. Nhu cầu nhà ở công nhân, kỹ sư và kho bãi logistics tăng ổn định hàng năm.',
            },
            {
                title: 'Giá Đất Còn Rẻ — Tiềm Năng Dài Hạn',
                desc: 'Đất nền Long An vùng giáp TP.HCM (Bến Lức, Đức Hòa, Cần Đước) hiện 5–25 triệu/m² — rẻ hơn Bình Chánh 50–70%. Với lộ trình hạ tầng 2025–2030 rõ ràng (Vành đai 3, cao tốc Mộc Bài, Metro số 3a kéo dài), đây là phân khúc tích lũy dài hạn tốt nhất cho ngân sách dưới 1,5 tỷ.',
            },
            {
                title: 'Quy Hoạch 3 Đô Thị Vệ Tinh Bài Bản',
                desc: 'Long An đã phê duyệt quy hoạch 3 đô thị vệ tinh: Đức Hòa (đô thị công nghiệp KCN), Bến Lức (đô thị cửa ngõ TP.HCM) và Tân An (đô thị trung tâm tỉnh lỵ). Hạ tầng đô thị, trường học, bệnh viện được đầu tư theo lộ trình — giá trị BĐS tăng theo tiến độ đô thị hóa.',
            },
        ],
        faqs: [
            {
                q: 'Bất động sản Long An có đáng đầu tư không năm 2026?',
                a: 'Long An là thị trường BĐS hấp dẫn nhất khu vực lân cận TP.HCM nhờ: (1) Vành đai 3 (đoạn qua Long An–Bình Chánh) thông xe 2026; (2) Cao tốc TP.HCM–Mộc Bài đang xây dựng; (3) Giá đất chỉ bằng 30–50% Bình Chánh; (4) Nhu cầu kho logistics và KCN tăng mạnh; (5) Quy hoạch 3 đô thị vệ tinh Đức Hòa, Bến Lức, Tân An.',
            },
            {
                q: 'Giá đất Long An hiện nay khu vực nào rẻ nhất và đắt nhất?',
                a: 'Giá đất Long An 2026 theo khu vực: Bến Lức giáp Bình Chánh (đắt nhất): 8–25 triệu/m²; Đức Hòa KCN: 5–20 triệu/m²; Cần Đước, Cần Giuộc (giáp Q7, Nhà Bè): 4–12 triệu/m²; Tân An trung tâm tỉnh: 15–40 triệu/m²; Đức Huệ, Thạnh Hóa (xa nhất): 1–5 triệu/m².',
            },
            {
                q: 'Khu vực nào ở Long An gần TP.HCM nhất?',
                a: 'Bến Lức và Đức Hòa gần TP.HCM nhất (giáp Bình Chánh). Cần Đước và Cần Giuộc giáp Nhà Bè–Q7. Từ ngã tư An Lạc (Q.Bình Tân) vào trung tâm Bến Lức chỉ 20–25km. Với Vành đai 3 thông xe 2026, thời gian từ Bến Lức đến Q1 rút còn 30–40 phút không qua nội đô.',
            },
            {
                q: 'Đức Hòa Long An có tiềm năng đầu tư không?',
                a: 'Đức Hòa là huyện có nhiều KCN nhất Long An (KCN Đức Hòa I, II, III, Tân Đô, Hải Sơn, Thuận Đạo) với hơn 400 doanh nghiệp FDI, nhu cầu nhà ở công nhân và chuyên gia lớn. Giá đất nền 5–20 triệu/m², tỷ suất cho thuê nhà trọ 10–15%/năm. Rủi ro: thanh khoản thứ cấp chậm hơn Bình Chánh.',
            },
            {
                q: 'Pháp lý đất Long An cần kiểm tra gì?',
                a: 'Đất Long An hay gặp vấn đề: (1) Đất nông nghiệp chưa chuyển mục đích dùng, phân lô bán nền trái phép; (2) Đất nằm trong quy hoạch KCN hoặc hành lang bảo vệ kênh thủy lợi; (3) Đất thuộc vùng thấp trũng, ngập úng theo mùa. SGS LAND kiểm tra sổ đỏ, quy hoạch 1/500 và hệ thống thoát nước miễn phí trước giao dịch.',
            },
            {
                q: 'Vành đai 3 và Vành đai 4 ảnh hưởng BĐS Long An thế nào?',
                a: 'Vành đai 3 qua Long An (đoạn Bến Lức–Nhơn Trạch) thông xe 2026, mở kết nối trực tiếp với sân bay Long Thành mà không qua TP.HCM. Vành đai 4 (đang quy hoạch) sẽ đi qua trung tâm Long An, tạo thêm nút giao và đô thị mới. Đất bán kính 3km quanh nút giao Vành đai 3 tại Long An đã tăng 20–40%.',
            },
            {
                q: 'Long An có KCN nào lớn nhất và thu hút FDI nhất?',
                a: 'Top KCN Long An thu hút FDI lớn nhất: (1) KCN Tân Đô (Đức Hòa, 405ha); (2) KCN Long Hậu (Cần Đước, 164ha) — chuyên logistics và kho lạnh giáp sông Soài Rạp; (3) KCN Hải Sơn (Đức Hòa, 179ha); (4) KCN Xuyên Á (Đức Huệ, 800ha). Tổng vốn FDI đăng ký 8,5 tỷ USD tính đến 2025.',
            },
            {
                q: 'SGS LAND hỗ trợ tìm đất nền Long An như thế nào?',
                a: 'SGS LAND có kho hàng đất nền Long An đã xác minh sổ đỏ, hỗ trợ định giá AI so sánh với giao dịch thực trong bán kính 2km, kiểm tra quy hoạch và tình trạng pháp lý độc lập. Hotline: +84 971 132 378 — tư vấn miễn phí, không ép mua.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Bình Chánh', slug: 'bat-dong-san-binh-chanh' },
            { name: 'BĐS Quận 7', slug: 'bat-dong-san-quan-7' },
            { name: 'BĐS Bình Dương', slug: 'bat-dong-san-binh-duong' },
        ],
        relatedProjects: [
            { name: 'Waterpoint Nam Long', slug: 'aqua-city' },
            { name: 'Izumi City Nam Long', slug: 'izumi-city' },
        ],
    },
};
function navigate(path: string) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
}
export default function LocalLandingPage() {
    const { t } = useTranslation();
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const slug = window.location.pathname.replace(/^\//, '').split('/')[0];
    const cfg = LOCATION_CONFIG[slug];
    useEffect(() => {
        if (!cfg) return;
        setLoading(true);
        fetch(`/api/public/listings?search=${encodeURIComponent(cfg.searchQuery)}&limit=6`)
            .then(r => r.json())
            .then(d => setListings(Array.isArray(d?.listings) ? d.listings : []))
            .catch(() => setListings([]))
            .finally(() => setLoading(false));
    }, [cfg?.searchQuery]);
    if (!cfg) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
                <p className="text-[var(--text-secondary)]">Trang không tìm thấy.</p>
            </div>
        );
    }
    const fmtPrice = (p: number) => {
        if (p >= 1e9) {
            const val = Math.round((p / 1e9) * 10) / 10;
            return `${val.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
        }
        if (p >= 1e6) return `${Math.round(p / 1e6).toLocaleString('vi-VN')} triệu`;
        return p.toLocaleString('vi-VN');
    };
    const seoMeta = LOCATION_SEO_META[slug] ?? {
        title: `Bất Động Sản ${cfg.name} | Nhà Phố, Căn Hộ - SGS LAND`,
        description: cfg.heroDescription.slice(0, 155),
    };
    return (
        <>
            <SeoHead
                title={seoMeta.title}
                description={seoMeta.description}
                canonicalPath={`/${cfg.slug}`}
                structuredData={[
                    {
                        '@type': 'RealEstateAgent',
                        '@id': `https://sgsland.vn/${cfg.slug}#agent`,
                        name: `SGS LAND — BĐS ${cfg.name}`,
                        description: seoMeta.description,
                        url: `https://sgsland.vn/${cfg.slug}`,
                        telephone: '+84-971-132-378',
                        email: 'info@sgsland.vn',
                        priceRange: '$$',
                        image: 'https://sgsland.vn/og-image.jpg',
                        areaServed: {
                            '@type': 'Place',
                            name: cfg.province,
                            address: {
                                '@type': 'PostalAddress',
                                addressLocality: cfg.province,
                                addressCountry: 'VN',
                            },
                        },
                        parentOrganization: {
                            '@type': 'Organization',
                            name: 'SGS LAND',
                            legalName: 'Công ty TNHH SGS Land',
                            taxID: '0312960439',
                            url: 'https://sgsland.vn',
                        },
                        aggregateRating: {
                            '@type': 'AggregateRating',
                            ratingValue: '4.8',
                            reviewCount: '127',
                            bestRating: '5',
                            worstRating: '1',
                        },
                        review: [
                            {
                                '@type': 'Review',
                                author: { '@type': 'Person', name: 'Nguyễn Minh Trí' },
                                datePublished: '2026-03-10',
                                reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5', worstRating: '1' },
                                reviewBody: 'Chuyên viên SGS LAND tư vấn kỹ về thị trường BĐS địa phương, hỗ trợ kiểm tra pháp lý miễn phí và kết nối vay ngân hàng tốt.',
                            },
                            {
                                '@type': 'Review',
                                author: { '@type': 'Person', name: 'Đặng Thị Hương' },
                                datePublished: '2026-02-05',
                                reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5', worstRating: '1' },
                                reviewBody: 'Tư vấn nhiệt tình và am hiểu thị trường địa phương. SGS LAND là lựa chọn đáng tin cậy khi mua BĐS tại khu vực này.',
                            },
                        ],
                    },
                    {
                        '@type': 'BreadcrumbList',
                        itemListElement: [
                            { '@type': 'ListItem', position: 1, name: 'Trang Chủ', item: 'https://sgsland.vn/' },
                            { '@type': 'ListItem', position: 2, name: 'Mua Bán BĐS', item: 'https://sgsland.vn/marketplace' },
                            { '@type': 'ListItem', position: 3, name: `Bất Động Sản ${cfg.name}`, item: `https://sgsland.vn/${cfg.slug}` },
                        ],
                    },
                    {
                        '@type': 'FAQPage',
                        mainEntity: cfg.faqs.map(f => ({
                            '@type': 'Question',
                            name: f.q,
                            acceptedAnswer: { '@type': 'Answer', text: f.a },
                        })),
                    },
                ]}
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
                        <button onClick={() => navigate('/bat-dong-san-dong-nai')} className="hover:text-[var(--primary-600)] transition-colors">Đồng Nai</button>
                        <button onClick={() => navigate('/bat-dong-san-long-thanh')} className="hover:text-[var(--primary-600)] transition-colors">Long Thành</button>
                        <button onClick={() => navigate('/ai-valuation')} className="hover:text-[var(--primary-600)] transition-colors">Định Giá AI</button>
                    </nav>
                    <button
                        onClick={() => navigate('/contact')}
                        className="px-4 py-2 bg-[var(--primary-600)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
                    >
                        Tư Vấn Miễn Phí
                    </button>
                </div>
            </header>
            {/* ── Hero ── */}
            <section className="bg-gradient-to-br from-[var(--primary-600)]/10 via-[var(--bg-surface)] to-[var(--bg-app)] pt-12 pb-10 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Breadcrumb */}
                    <nav aria-label="breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <button onClick={() => navigate('/home')} className="hover:text-[var(--primary-600)] transition-colors">Trang Chủ</button>
                        <span>/</span>
                        <button onClick={() => navigate('/marketplace')} className="hover:text-[var(--primary-600)] transition-colors">Mua Bán BĐS</button>
                        <span>/</span>
                        <span className="text-[var(--text-primary)] font-medium">{cfg.h1Title ?? `Bất Động Sản ${cfg.name}`}</span>
                    </nav>

                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4 leading-tight">
                        {cfg.h1Title ?? `Bất Động Sản ${cfg.name}`}
                    </h1>
                    <p className="text-[var(--text-secondary)] text-base md:text-lg max-w-3xl leading-relaxed mb-8">
                        {cfg.heroDescription}
                    </p>
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {cfg.stats.map((s, i) => (
                            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-4 text-center shadow-sm">
                                <div className="text-xl md:text-2xl font-bold text-[var(--primary-600)]">{s.value}</div>
                                <div className="text-xs text-[var(--text-secondary)] mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            {/* ── Highlights ── */}
            <section className="py-12 px-4 bg-[var(--bg-surface)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">
                        Tại Sao Nên Đầu Tư Bất Động Sản {cfg.name}?
                    </h2>
                    <p className="text-[var(--text-secondary)] mb-8">Những lý do hàng đầu khiến {cfg.name} là thị trường được nhà đầu tư lựa chọn.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cfg.highlights.map((h, i) => (
                            <div key={i} className="bg-[var(--bg-app)] border border-[var(--glass-border)] rounded-2xl p-5 flex gap-4 hover:border-[var(--primary-600)]/30 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-[var(--primary-600)]/10 flex-shrink-0 flex items-center justify-center text-[var(--primary-600)] font-bold text-lg">
                                    {i + 1}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">{h.title}</h3>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{h.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            {/* ── Listings ── */}
            <section className="py-12 px-4 bg-[var(--bg-app)]">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Bất Động Sản {cfg.name} Đang Bán</h2>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">Cập nhật realtime từ kho hàng đã xác minh pháp lý</p>
                        </div>
                        <button
                            onClick={() => navigate(`/marketplace?q=${encodeURIComponent(cfg.searchQuery)}`)}
                            className="text-sm font-semibold text-[var(--primary-600)] hover:underline hidden md:block"
                        >
                            Xem tất cả →
                        </button>
                    </div>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-52 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : listings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {listings.slice(0, 6).map((l: any) => (
                                <button
                                    key={l.id}
                                    onClick={() => navigate(`/listing/${l.id}`)}
                                    className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl overflow-hidden text-left hover:border-[var(--primary-600)]/40 hover:shadow-md transition-all"
                                >
                                    <div className="h-36 bg-[var(--glass-surface-hover)] flex items-center justify-center">
                                        {(l.images && l.images[0]) ? (
                                            <img src={l.images[0]} alt={l.title || 'BĐS'} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <svg className="w-10 h-10 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <p className="text-xs text-[var(--primary-600)] font-semibold mb-1 uppercase tracking-wide">
                                            {l.transaction === 'RENT' ? 'Cho Thuê' : 'Bán'} · {l.type || 'BĐS'}
                                        </p>
                                        <p className="font-semibold text-sm text-[var(--text-primary)] line-clamp-2 mb-2">{l.title || 'Bất động sản ' + cfg.name}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[var(--primary-600)] font-bold text-sm">
                                                {l.price ? fmtPrice(Number(l.price)) : 'Liên hệ'}
                                            </span>
                                            {l.area && <span className="text-xs text-[var(--text-secondary)]">{l.area}m²</span>}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-[var(--text-secondary)]">
                            <p className="mb-4">Chưa có tin đăng trong khu vực này.</p>
                        </div>
                    )}

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate(`/marketplace?q=${encodeURIComponent(cfg.searchQuery)}`)}
                            className="px-8 py-3 bg-[var(--primary-600)] text-white rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md"
                        >
                            Xem Toàn Bộ BĐS {cfg.name}
                        </button>
                    </div>
                </div>
            </section>
            {/* ── FAQ ── */}
            <section className="py-12 px-4 bg-[var(--bg-surface)]">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Câu Hỏi Thường Gặp — BĐS {cfg.name}</h2>
                    <p className="text-[var(--text-secondary)] mb-8 text-sm">Giải đáp các thắc mắc phổ biến về thị trường bất động sản {cfg.name}.</p>
                    <FAQAccordion items={cfg.faqs} />
                </div>
            </section>
            {/* ── Internal Links ── */}
            <section className="py-10 px-4 bg-[var(--bg-app)]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-lg font-bold mb-4 text-[var(--text-primary)]">Khu Vực & Dự Án Liên Quan</h2>
                    <div className="flex flex-wrap gap-3">
                        {cfg.relatedLocations.map((l, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(`/${l.slug}`)}
                                className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium hover:border-[var(--primary-600)]/40 hover:text-[var(--primary-600)] transition-all"
                            >
                                {l.name}
                            </button>
                        ))}
                        {cfg.relatedProjects.map((p, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(`/du-an/${p.slug}`)}
                                className="px-4 py-2 bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/20 rounded-xl text-sm font-medium text-[var(--primary-600)] hover:bg-[var(--primary-600)]/20 transition-all"
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
                    <h2 className="text-2xl md:text-3xl font-bold mb-3">Tư Vấn BĐS {cfg.name} Miễn Phí</h2>
                    <p className="mb-8 opacity-90">Đội ngũ chuyên gia SGS LAND với 200+ chuyên gia am hiểu thị trường {cfg.province} sẵn sàng hỗ trợ bạn tìm kiếm, đàm phán và hoàn tất giao dịch.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-8 py-3.5 bg-white text-[var(--primary-600)] rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
                        >
                            Nhận Tư Vấn Ngay
                        </button>
                        <button
                            onClick={() => navigate(`/marketplace?q=${encodeURIComponent(cfg.searchQuery)}`)}
                            className="px-8 py-3.5 bg-white/10 border border-white/30 text-white rounded-2xl font-semibold hover:bg-white/20 transition-all"
                        >
                            Tìm BĐS {cfg.name}
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
                        <button onClick={() => navigate('/bat-dong-san-binh-thanh')} className="hover:text-[var(--primary-600)]">BĐS Bình Thạnh</button>
                        <button onClick={() => navigate('/bat-dong-san-long-an')} className="hover:text-[var(--primary-600)]">BĐS Long An</button>
                        <button onClick={() => navigate('/dau-tu-bat-dong-san')} className="hover:text-[var(--primary-600)]">Đầu Tư BĐS</button>
                        <button onClick={() => navigate('/phap-ly-nha-dat')} className="hover:text-[var(--primary-600)]">Pháp Lý Nhà Đất</button>
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
                <div
                    key={i}
                    className="border border-[var(--glass-border)] rounded-2xl overflow-hidden bg-[var(--bg-app)]"
                >
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