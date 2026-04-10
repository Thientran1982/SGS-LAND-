import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { useTranslation } from '../services/i18n';
import { Logo } from '../components/Logo';

interface LocationConfig {
    slug: string;
    name: string;
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
                a: 'Giá đất Đồng Nai dao động lớn theo vị trí: đất nền Long Thành 8-25 triệu/m², đất nền Nhơn Trạch 5-15 triệu/m², căn hộ Biên Hòa 35-80 triệu/m², biệt thự dự án 15-50 triệu/m². Giá cập nhật theo thị trường và có thể thay đổi theo giai đoạn dự án.',
            },
            {
                q: 'Sân bay Long Thành ảnh hưởng thế nào đến giá BĐS?',
                a: 'Sân bay quốc tế Long Thành (diện tích 5.000ha, công suất 25 triệu hành khách/giai đoạn 1) đã và đang kéo theo làn sóng đầu tư hạ tầng, khu đô thị và công nghiệp. BĐS trong bán kính 15km từ sân bay có mức tăng giá trung bình 20-35% kể từ khi khởi công.',
            },
            {
                q: 'Những dự án BĐS nào nổi bật tại Đồng Nai?',
                a: 'Các dự án lớn đáng chú ý: Aqua City (Novaland, 1.000ha tại Nhơn Trạch), Izumi City (Nam Long, 170ha tại Biên Hòa), Waterpoint (Nam Long, Long An giáp ranh), HUD Nhơn Trạch (chung cư giá vừa), Gem Sky World (Long Thành). SGS LAND có thông tin cập nhật và hỗ trợ tư vấn tất cả dự án.',
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
            { name: 'Dự Án Manhattan', slug: 'manhattan' },
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
                q: 'Có nên mua đất Long Thành năm 2025-2026 không?',
                a: 'Long Thành là một trong các thị trường BĐS được khuyến nghị đầu tư mạnh trong giai đoạn 2024-2027. Với sân bay Long Thành hoàn thành giai đoạn 1 năm 2026, cơ sở hạ tầng đồng bộ và dòng vốn FDI đổ vào khu công nghiệp, giá BĐS được dự báo tiếp tục tăng 15-25%/năm.',
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
                a: 'Giá căn hộ Thủ Đức biến động theo khu vực: Thủ Thiêm (Q2 cũ) 80-250 triệu/m²; khu vực Metro số 1 (Q9 cũ) 45-90 triệu/m²; Thủ Đức (gần ĐH Quốc Gia) 35-65 triệu/m². Phân khúc cho thuê sôi động nhờ nhu cầu từ chuyên gia công nghệ và sinh viên.',
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
            { name: 'BĐS Bình Chánh', slug: 'bat-dong-san-binh-chanh' },
        ],
        relatedProjects: [
            { name: 'Dự Án Manhattan Bình Dương', slug: 'manhattan' },
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
            { name: 'BĐS Bình Chánh', slug: 'bat-dong-san-binh-chanh' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
        ],
        relatedProjects: [
            { name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' },
            { name: 'Masterise Homes', slug: 'masterise-homes' },
        ],
    },
    'bat-dong-san-binh-chanh': {
        slug: 'bat-dong-san-binh-chanh',
        name: 'Bình Chánh',
        province: 'TP.HCM',
        searchQuery: 'Bình Chánh',
        heroDescription:
            'Bất động sản Bình Chánh — huyện ngoại thành phía Tây Nam TP.HCM đang trong quá trình đô thị hóa mạnh mẽ với hàng loạt dự án khu dân cư và đô thị mới. Giá đất Bình Chánh hấp dẫn, tiềm năng tăng giá cao khi hạ tầng vành đai 3 và vành đai 4 hoàn thành. SGS LAND tư vấn và giao dịch BĐS Bình Chánh an toàn, hiệu quả.',
        stats: [
            { label: 'Diện tích', value: '252 km²' },
            { label: 'Dân số', value: '700.000+' },
            { label: 'Giá đất mặt tiền', value: '20-60 tr/m²' },
            { label: 'Tốc độ tăng giá/năm', value: '12-20%' },
        ],
        highlights: [
            {
                title: 'Hưởng Lợi Từ Vành Đai 3 & 4',
                desc: 'Đường Vành đai 3 TP.HCM (dự kiến hoàn thành 2025-2026) đi qua Bình Chánh, kết nối trực tiếp với Bình Dương, Đồng Nai và Long An. Đường Vành đai 4 quy hoạch tiếp tục mở rộng không gian phát triển. BĐS quanh vành đai tăng giá mạnh.',
            },
            {
                title: 'Khu Đô Thị Mới Bình Chánh',
                desc: 'Nhiều dự án khu đô thị lớn đang triển khai: Akari City (Nam Long), Vinhomes Grand Park giai đoạn mở rộng, Tên Lửa Complex và hàng chục dự án nhà ở xã hội, nhà ở vừa túi tiền phục vụ người dân TP.HCM.',
            },
            {
                title: 'Giá Đất Hấp Dẫn, Còn Nhiều Dư Địa',
                desc: 'Giá đất Bình Chánh thấp hơn nội thành 50-70%, phù hợp ngân sách 2-5 tỷ đồng. Đất nền phân lô sổ đỏ từ 15-40 triệu/m², nhà phố dự án từ 4-8 tỷ. Tiềm năng tăng giá còn lớn khi hạ tầng hoàn thiện.',
            },
            {
                title: 'Kết Nối Cao Tốc & Logistics',
                desc: 'Bình Chánh nằm trên trục cao tốc TP.HCM – Trung Lương (về miền Tây), quốc lộ 1A và kết nối Bến Lức – Long Thành. Nhiều khu công nghiệp và trung tâm logistics lớn tạo nhu cầu nhà ở công nhân và chuyên gia.',
            },
        ],
        faqs: [
            {
                q: 'Đất Bình Chánh hiện nay giá bao nhiêu?',
                a: 'Giá đất Bình Chánh theo vị trí: mặt tiền quốc lộ 1A 40-80 triệu/m²; đường lớn trong thị trấn 20-45 triệu/m²; đất nền phân lô dự án 15-35 triệu/m²; đất ruộng/vườn chuyển mục đích 3-10 triệu/m². Khu giáp Q8, Q7 giá cao hơn 20-30%.',
            },
            {
                q: 'Có nên mua đất Bình Chánh để đầu tư không?',
                a: 'Bình Chánh là thị trường đầu tư trung và dài hạn tiềm năng. Vành đai 3 hoàn thành sẽ kéo theo đô thị hóa mạnh, tăng giá 20-40%. Phù hợp ngân sách 2-5 tỷ, mua đất nền hoặc nhà phố dự án. Lưu ý chọn sản phẩm đã có sổ đỏ và kiểm tra quy hoạch trước khi mua.',
            },
            {
                q: 'Dự án nào đáng mua nhất ở Bình Chánh hiện nay?',
                a: 'Các dự án uy tín tại Bình Chánh: Akari City (Nam Long) — căn hộ pháp lý chuẩn, giá hợp lý; Tên Lửa Complex — nhà phố thương mại; các dự án HUD Bình Chánh — nhà ở xã hội giá ưu đãi. SGS LAND có danh sách đầy đủ dự án Bình Chánh và hỗ trợ tư vấn miễn phí.',
            },
            {
                q: 'Bình Chánh có nguy cơ ngập lụt không?',
                a: 'Một số khu vực Bình Chánh có nguy cơ ngập theo triều cường, đặc biệt gần sông Bến Lức, kênh Đôi. Nên chọn dự án có nền cao, hệ thống thoát nước bài bản. SGS LAND kiểm tra thực địa và lịch sử ngập lụt trước khi tư vấn mua, bảo đảm an toàn đầu tư.',
            },
            {
                q: 'Vành đai 3 ảnh hưởng thế nào đến BĐS Bình Chánh?',
                a: 'Đường Vành đai 3 (dự kiến hoàn thành 2025-2026) đi qua Bình Chánh giúp kết nối trực tiếp với Bình Dương, Đồng Nai và Long An trong 20-30 phút. BĐS trong bán kính 1-2km quanh các nút giao vành đai 3 tại Bình Chánh được dự báo tăng giá 30-50% sau khi thông đường.',
            },
            {
                q: 'Akari City Nam Long Bình Chánh giá bao nhiêu năm 2026?',
                a: 'Akari City (Nam Long, Q. Bình Tân giáp Bình Chánh): căn hộ 2PN ~65-85 triệu/m², giá từ 3-4 tỷ. Cho thuê 8-12 triệu/tháng. Pháp lý sổ hồng rõ ràng, bàn giao đúng hạn, phù hợp người mua ở thực và đầu tư dài hạn.',
            },
            {
                q: 'Cao tốc Trung Lương – Bình Chánh mở ra cơ hội gì?',
                a: 'Bình Chánh là cửa ngõ cao tốc TP.HCM – Trung Lương, huyết mạch kết nối miền Tây 13 tỉnh thành. Logistics, nhà kho và đất công nghiệp tăng giá mạnh. Nhà phố trục quốc lộ 1A cho thuê kinh doanh 20-50 triệu/tháng.',
            },
            {
                q: 'Khu dân cư tốt nhất ở Bình Chánh là khu nào?',
                a: 'Bốn khu vực đáng cân nhắc: (1) Phong Phú (giáp Q8, Q7): dân cư đông, tiện ích đầy đủ; (2) Bình Hưng: gần Phú Mỹ Hưng, giá hợp lý; (3) Tân Kiên (gần trung tâm H. Bình Chánh): đất nền giá tốt; (4) Vĩnh Lộc A/B: phát triển công nghiệp-nhà ở công nhân.',
            },
            {
                q: 'Nhà ở xã hội Bình Chánh có dễ mua không?',
                a: 'TP.HCM đang đẩy mạnh nhà ở xã hội tại Bình Chánh (Vĩnh Lộc, Bình Hưng). Giá 15-22 triệu/m², cần đủ điều kiện (chưa có nhà, thu nhập dưới ngưỡng). SGS LAND hướng dẫn hồ sơ đăng ký nhà ở xã hội miễn phí.',
            },
            {
                q: 'SGS LAND tư vấn mua đất Bình Chánh như thế nào?',
                a: 'SGS LAND kiểm tra quy hoạch đất Bình Chánh (tránh đất lộ giới, đất nông nghiệp), định giá AI so sánh thị trường, xác minh pháp lý sổ đỏ và lịch sử ngập lụt trước khi tư vấn. Không thu phí tư vấn từ người mua.',
            },
        ],
        relatedLocations: [
            { name: 'BĐS Quận 7', slug: 'bat-dong-san-quan-7' },
            { name: 'BĐS Long Thành', slug: 'bat-dong-san-long-thanh' },
            { name: 'BĐS TP Thủ Đức', slug: 'bat-dong-san-thu-duc' },
        ],
        relatedProjects: [
            { name: 'Aqua City Novaland', slug: 'aqua-city' },
            { name: 'Dự Án Manhattan', slug: 'manhattan' },
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
        if (p >= 1e9) return `${(p / 1e9).toFixed(1)} tỷ`;
        if (p >= 1e6) return `${Math.round(p / 1e6)} triệu`;
        return p.toLocaleString('vi-VN');
    };

    return (
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
                        <span className="text-[var(--text-primary)] font-medium">Bất Động Sản {cfg.name}</span>
                    </nav>

                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4 leading-tight">
                        Bất Động Sản {cfg.name}
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
                        <button onClick={() => navigate('/contact')} className="hover:text-[var(--primary-600)]">Liên Hệ</button>
                    </div>
                </div>
            </footer>
        </div>
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
