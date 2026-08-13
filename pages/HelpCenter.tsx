import React, { useState, useEffect, useMemo } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { SeoHead } from '../components/SeoHead';
import { db } from '../services/dbApi';
import { User } from '../types';
const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    SEARCH: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    CHEVRON_DOWN: <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
    HOME: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    AI: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
    CONSIGN: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    BANK: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m4-11v11m4-11v11m4-11v11m4-11v11" /></svg>,
    HOT: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 6.5c1.5 2 1.34 5.6.657 6.5C19 14.5 18.5 17 17.657 18.657z" /></svg>,
    DEPOSIT: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    THUMB_UP: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>,
    THUMB_DOWN: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>,
};
type Article = { id: number; q: string; a: string; cat: string };
const ARTICLES: Article[] = [
    // ── 1. MUA BÁN & PHÁP LÝ ─────────────────────────────────────────────
    { id: 1, cat: 'mua-ban-phap-ly',
        q: 'Quy trình mua bất động sản qua SGS Land như thế nào?',
        a: 'Quy trình mua BĐS qua SGS Land gồm 5 bước: (1) Tìm kiếm và lọc sản phẩm phù hợp tại sgsland.vn/marketplace. (2) Liên hệ chuyên viên tư vấn miễn phí qua hotline 0971 132 378. (3) Khảo sát thực tế và ký hợp đồng đặt cọc thiện chí. (4) Hoàn thiện thủ tục pháp lý + thanh toán theo tiến độ chủ đầu tư. (5) Bàn giao sản phẩm + cấp sổ hồng. Đội pháp lý SGS Land hỗ trợ kiểm tra 2 lớp toàn bộ quy trình từ A đến Z.',
    },
    { id: 2, cat: 'mua-ban-phap-ly',
        q: 'Cần những giấy tờ gì để mua căn hộ hoặc đất nền?',
        a: 'Hồ sơ mua BĐS tại Việt Nam gồm: (1) CCCD/CMND còn hiệu lực của người mua. (2) Giấy xác nhận tình trạng hôn nhân (nếu kết hôn cần giấy tờ cả vợ chồng). (3) Chứng từ tài chính nếu vay ngân hàng (sao kê 6 tháng + hợp đồng lao động). (4) Người nước ngoài cần hộ chiếu + thị thực cư trú hợp lệ. SGS Land hỗ trợ kiểm tra và hoàn thiện hồ sơ miễn phí trước khi ký công chứng.',
    },
    { id: 3, cat: 'mua-ban-phap-ly',
        q: 'Sổ hồng và sổ đỏ khác nhau như thế nào?',
        a: 'Trước 2009: Sổ đỏ cấp cho đất, Sổ hồng cấp cho nhà + đất ở. Từ 2009 hai loại đã hợp nhất thành Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất theo Luật Đất đai 2013 (cập nhật theo Luật Đất đai 2024). Hiện chỉ là cách gọi theo màu sắc cũ. Sổ hồng RIÊNG = quyền sở hữu duy nhất 1 chủ; Sổ CHUNG = đồng sở hữu nhiều người, có rủi ro pháp lý cao hơn khi chuyển nhượng. Tham khảo: Luật Đất đai 2024 (chinhphu.vn) + hướng dẫn pháp lý SGS Land tại sgsland.vn/help-center.',
    },
    { id: 4, cat: 'mua-ban-phap-ly',
        q: 'Người nước ngoài có được mua nhà tại Việt Nam không?',
        a: 'Theo Luật Nhà ở 2014 (sửa đổi 2023, văn bản gốc trên thuvienphapluat.vn), người nước ngoài được mua và sở hữu nhà ở tại Việt Nam với điều kiện: (1) Có thị thực nhập cảnh hợp lệ. (2) Tổng số căn hộ ngoại kiều không vượt 30%/toà chung cư hoặc 250 căn/phường. (3) Thời hạn sở hữu 50 năm và có thể gia hạn 50 năm tiếp. (4) Không được sở hữu nhà tại khu vực an ninh quốc phòng. SGS Land có chuyên viên riêng phụ trách khách quốc tịch nước ngoài — liên hệ tư vấn miễn phí tại sgsland.vn/contact.',
    },
    { id: 5, cat: 'mua-ban-phap-ly',
        q: 'Vi bằng có giá trị pháp lý như sổ hồng không?',
        a: 'KHÔNG. Vi bằng chỉ là văn bản ghi nhận sự kiện do Thừa phát lại lập, dùng làm chứng cứ tại toà — không xác lập quyền sở hữu BĐS. Mua nhà bằng vi bằng có 4 rủi ro lớn: (1) Không sang tên được. (2) Không vay ngân hàng được. (3) Tranh chấp khi chủ cũ bán cho người khác. (4) Bị thu hồi nếu đất quy hoạch. SGS Land KHÔNG nhận giao dịch vi bằng/giấy tay; mọi sản phẩm đều có sổ hồng hoặc HĐMB chính chủ.',
    },
    // ── 2. ĐỊNH GIÁ AI ──────────────────────────────────────────────────
    { id: 6, cat: 'dinh-gia-ai',
        q: 'AI định giá BĐS hoạt động như thế nào?',
        a: 'AI định giá của SGS Land tại sgsland.vn/ai-valuation hoạt động qua 3 lớp: (1) Location embedding — phân tích toạ độ + lộ giới + tiện ích lân cận. (2) Transaction graph — đối chiếu 1.200+ giao dịch thực tế Q1/2026 đã công chứng trong bán kính 2km. (3) Adjustment coefficients — Kd (lộ giới), Kp (pháp lý), Ka (diện tích), Kdir (hướng), Kfl (tầng), Kmf (mặt tiền), Kfurn (nội thất), Kage (tuổi nhà). Kết quả trả về trong dưới 30s, kèm khoảng tin cậy ±5%.',
    },
    { id: 7, cat: 'dinh-gia-ai',
        q: 'AI định giá có chính xác không?',
        a: 'Sai số trung bình ±5% (MAPE) so với giá công chứng thực tế, đối chiếu trên bộ test 1.200 giao dịch Q1/2026 tại Đông Nam Bộ. Khu vực có nhiều giao dịch (Q1, Q7, TP Thủ Đức, Phú Mỹ Hưng, Aqua City, Vinhomes Grand Park) đạt độ tin cậy 65-72%; khu vực ít giao dịch (đất nông nghiệp, vùng ven) độ tin cậy 50-57%. Hệ thống hiển thị mức confidence ngay trên kết quả.',
    },
    { id: 8, cat: 'dinh-gia-ai',
        q: 'Định giá AI có mất phí không?',
        a: 'Hoàn toàn miễn phí. Khách vãng lai được 1 lần/ngày; tài khoản đăng ký miễn phí được 5 lần/ngày; tài khoản môi giới Pro không giới hạn. Truy cập sgsland.vn/ai-valuation, nhập địa chỉ + diện tích + loại BĐS, chọn pháp lý + lộ giới (tuỳ chọn). Kết quả gồm: giá thị trường, khoảng giá min-max, độ tin cậy, market trend 12 tháng và 5 dự án so sánh tham chiếu.',
    },
    { id: 9, cat: 'dinh-gia-ai',
        q: 'AI có định giá được đất nông nghiệp và nhà xưởng không?',
        a: 'Có, hỗ trợ 13 loại BĐS: căn hộ nội đô / ngoại ô, penthouse, biệt thự, shophouse, kho xưởng, văn phòng, đất nông nghiệp, đất KCN, đất ngoại thành, đất thổ cư, off-plan, nhà phố nội đô, nhà phố ngoại thành. Hệ thống tự nhận dạng loại từ địa chỉ; bạn có thể override. Đất nông nghiệp và nhà xưởng có model riêng dùng dữ liệu JLL Industrial + Savills Logistics Q4/2025.',
    },
    // ── 3. KÝ GỬI & ĐĂNG TIN ────────────────────────────────────────────
    { id: 10, cat: 'ky-gui',
        q: 'Quy trình ký gửi BĐS qua SGS Land mất bao lâu?',
        a: 'Trung bình 45 ngày từ khi ký hợp đồng đến khi giao dịch hoàn tất, gồm 4 giai đoạn: (1) Kiểm tra pháp lý 2 lớp (3-5 ngày): sổ + quy hoạch + tranh chấp + công nợ. (2) Định giá AI + chuyên viên thẩm định (1-2 ngày). (3) Đăng tin lên marketplace + 9 nền tảng đối tác + push CRM cho 15.000 môi giới (cùng ngày). (4) Tư vấn khách + thương lượng + ký công chứng (30-40 ngày tuỳ phân khúc). Giải ngân ngay sau công chứng.',
    },
    { id: 11, cat: 'ky-gui',
        q: 'Phí ký gửi BĐS qua sàn là bao nhiêu?',
        a: 'Phí môi giới chuẩn theo phân khúc: 1-2% giá bán đối với căn hộ chung cư; 2-3% đối với nhà phố / shophouse / biệt thự; 2-2,5% đối với đất nền / đất nông nghiệp. Chỉ thu khi giao dịch thành công (no win — no fee). Không thu phí kiểm tra pháp lý, định giá, đăng tin hoặc chụp ảnh. Hợp đồng ký gửi không độc quyền, bạn vẫn được bán qua kênh khác.',
    },
    { id: 12, cat: 'ky-gui',
        q: 'Tôi có thể đăng tin BĐS lên SGS Land không?',
        a: 'Có. Cá nhân: đăng nhập → Dashboard → Đăng tin mới (5 tin miễn phí/tháng). Môi giới chuyên nghiệp: đăng ký gói CRM Pro (không giới hạn tin + 15 tính năng). Mỗi tin cần: loại BĐS, địa chỉ, giá, diện tích, ≥5 ảnh chất lượng cao, thông tin pháp lý. Tin được kiểm duyệt 2 lớp (AI + chuyên viên) trong 24h, loại bỏ tin ảo / treo giá / sai pháp lý.',
    },
    { id: 13, cat: 'ky-gui',
        q: 'SGS Land có nhận ký gửi đất nông nghiệp không?',
        a: 'Có, sau khi kiểm tra pháp lý 2 lớp đầy đủ. Tập trung khu vực Đồng Nai (Long Thành, Nhơn Trạch, Xuân Lộc), Bình Dương (Bến Cát, Phú Giáo), Long An (Đức Hoà, Cần Giuộc), Bà Rịa-Vũng Tàu (Châu Đức, Xuyên Mộc). Yêu cầu sổ đỏ rõ ràng, không tranh chấp, không nằm trong vùng quy hoạch chuyển đổi mục đích sử dụng. Phí 2-2,5%, thời gian giao dịch trung bình 60 ngày.',
    },
    // ── 4. LÃI SUẤT VAY ─────────────────────────────────────────────────
    { id: 14, cat: 'lai-suat-vay',
        q: 'Lãi suất vay mua nhà 2026 hiện tại là bao nhiêu?',
        a: 'Lãi suất tham chiếu 6/2026: cố định 24 tháng đầu dao động 7,5-9,5%/năm; sau đó thả nổi theo lãi suất tham chiếu + biên độ 3-3,5%/năm. Top 5 ngân hàng cố định <8%: Vietcombank (7,5%), BIDV (7,7%), Techcombank (7,9%), MB Bank (7,9%), VPBank (8,0%). Tham khảo: biểu lãi suất tham chiếu Ngân hàng Nhà nước Việt Nam (sbv.gov.vn) + bảng so sánh realtime + công cụ tính trả góp tại sgsland.vn/bank-rates.',
    },
    { id: 15, cat: 'lai-suat-vay',
        q: 'Có thể vay tối đa bao nhiêu phần trăm giá trị BĐS?',
        a: 'Tỷ lệ vay (LTV) chuẩn: 70-80% với BĐS đã có sổ hồng; 60-70% với BĐS hình thành tương lai (HĐMB từ CĐT uy tín); 50-60% với đất nền / đất nông nghiệp. Kỳ hạn vay tối đa 25 năm. Khả năng được duyệt phụ thuộc vào DTI (debt-to-income) ≤ 40-45% thu nhập, lịch sử CIC sạch, và tài sản đảm bảo có pháp lý rõ ràng. SGS Land hỗ trợ kết nối + chuẩn bị hồ sơ miễn phí.',
    },
    { id: 16, cat: 'lai-suat-vay',
        q: 'Phạt trả nợ trước hạn là bao nhiêu?',
        a: 'Phạt trả trước hạn dao động 1-3% giá trị dư nợ tuỳ ngân hàng và thời điểm trả: trong năm 1-2 thường phạt 2-3%; năm 3-5 phạt 1-2%; sau năm 5 thường miễn phạt. Một số ngân hàng (BIDV, Vietcombank) miễn phạt nếu trả trước hạn dưới 30% dư nợ/năm. Đọc kỹ điều khoản "Phí trả nợ trước hạn" trong hợp đồng tín dụng trước khi ký.',
    },
    { id: 17, cat: 'lai-suat-vay',
        q: 'SGS Land có hỗ trợ làm hồ sơ vay không?',
        a: 'Có, hoàn toàn miễn phí. SGS Land là đối tác chiến lược của 15+ ngân hàng (Vietcombank, BIDV, Techcombank, MB Bank, VPBank, ACB, Sacombank, OCB, TPBank, HDBank…). Quy trình: (1) Chọn dự án/sản phẩm. (2) SGS Land nộp hồ sơ song song 3-5 ngân hàng. (3) Bạn so sánh điều kiện + chọn ngân hàng tốt nhất. (4) Ký công chứng + giải ngân. Thời gian duyệt trung bình 5-10 ngày làm việc.',
    },
    // ── 5. KHU VỰC HOT ──────────────────────────────────────────────────
    { id: 18, cat: 'khu-vuc-hot',
        q: 'BĐS Long Thành Đồng Nai có nên đầu tư 2026 không?',
        a: 'Có, nhưng cần chọn đúng phân khu. Long Thành là vùng kinh tế sân bay (sân bay Long Thành dự kiến vận hành 2027 theo công bố ACV — vietnamairport.vn), giá đất nền 8-35 triệu/m² đã tăng 15-25%/năm 3 năm liên tiếp (đối chiếu báo cáo CBRE Vietnam Q1/2026). Phân khu nên ưu tiên: Long Đức, Phước Bình, Bình Sơn (gần sân bay + cao tốc HLD-Dầu Giây). Cảnh báo: tránh đất phân lô tự phát chưa có quy hoạch 1/500. Chi tiết phân tích tại sgsland.vn/bat-dong-san-long-thanh.',
    },
    { id: 19, cat: 'khu-vuc-hot',
        q: 'Phú Mỹ Hưng và Tân Phong nên đầu tư khu nào?',
        a: 'Phú Mỹ Hưng: 433ha, giá 70-150 triệu/m², cộng đồng Hàn-Nhật-Đài 50.000+ chuyên gia, thanh khoản tốt nhất khu Nam, phù hợp ở thực + cho thuê chuyên gia (40-100 triệu/tháng). Tân Phong: giáp Phú Mỹ Hưng, giá 40-70 triệu/m² (thấp hơn 40%), tiềm năng tăng giá tốt khi quy hoạch mở rộng Nguyễn Lương Bằng. Đầu tư dài hạn → Phú Mỹ Hưng. Đầu tư đòn bẩy giá thấp → Tân Phong.',
    },
    { id: 20, cat: 'khu-vuc-hot',
        q: 'Vinhomes Cần Giờ khi nào mở bán giai đoạn 1?',
        a: 'Theo công bố từ Vinhomes, dự án Vinhomes Cần Giờ (Green Paradise) — siêu đô thị lấn biển 2.870ha (lớn nhất Việt Nam) — dự kiến mở bán giai đoạn 1 trong Q3/2026. Giá khởi điểm dự kiến từ 12 tỷ/căn cho biệt thự ven biển. SGS Land là đại lý nhận đặt chỗ ưu tiên giai đoạn 1 với mức giữ chỗ 100 triệu (hoàn 100% nếu đổi ý trong 30 ngày). Đăng ký tại sgsland.vn/du-an/vinhomes-can-gio.',
    },
    { id: 21, cat: 'khu-vuc-hot',
        q: 'Top 3 dự án căn hộ TP. Thủ Đức 2026 đáng mua nhất?',
        a: 'Top 3 căn hộ TP. Thủ Đức 2026 theo SGS Land: (1) Vinhomes Grand Park 271ha — đã bàn giao The Origami/Beverly/Rainbow, căn 2PN từ 3,1 tỷ, sổ hồng riêng, gần Metro số 1. (2) The Global City Masterise 117ha — căn hộ branded từ 7,5 tỷ, vị trí An Phú đắc địa. (3) Vạn Phúc City — căn hộ ven sông Sài Gòn từ 4,5 tỷ, tiện ích nội khu hoàn thiện. Chi tiết tại sgsland.vn/bat-dong-san-thu-duc.',
    },
    { id: 22, cat: 'khu-vuc-hot',
        q: 'BĐS Bình Dương 2026 nên đầu tư khu nào?',
        a: 'Top 3 khu vực Bình Dương 2026: (1) Thuận An — giáp TP.HCM, giá 40-100 triệu/m², thanh khoản cao nhất tỉnh nhờ kết nối Bình Triệu + Vành đai 3. (2) Dĩ An — gần Metro số 1 + ĐH Quốc Gia, giá 30-90 triệu/m², nhu cầu thuê sinh viên ổn định. (3) TP Mới Bình Dương — quy hoạch bài bản, giá 20-50 triệu/m², tiềm năng tăng giá dài hạn lớn nhất. Phân tích chi tiết tại sgsland.vn/bat-dong-san-binh-duong.',
    },
    // ── 6. ĐẶT CỌC & THANH TOÁN ─────────────────────────────────────────
    { id: 23, cat: 'dat-coc',
        q: 'Đặt cọc giữ chỗ và đặt cọc thiện chí khác nhau ra sao?',
        a: 'Đặt cọc GIỮ CHỖ (50-100 triệu): chỉ giữ priority quyền chọn căn, hoàn 100% nếu đổi ý trong 7-30 ngày tuỳ chính sách CĐT, không thuộc Bộ Luật Dân sự. Đặt cọc THIỆN CHÍ / HĐĐC (5-15% giá bán): ràng buộc pháp lý theo Điều 328 BLDS 2015 — bên đặt cọc đổi ý mất cọc, bên nhận cọc đổi ý đền gấp đôi. Luôn yêu cầu hợp đồng có công chứng + biên nhận đầy đủ.',
    },
    { id: 24, cat: 'dat-coc',
        q: 'Tiến độ thanh toán dự án mới phổ biến thế nào?',
        a: 'Tiến độ chuẩn cho dự án căn hộ off-plan: (1) Đặt cọc 5-10% khi ký HĐĐC. (2) Thanh toán 20-25% khi ký HĐMB. (3) 5-7% mỗi 3 tháng theo tiến độ xây dựng (tổng 50-55% trong 18-24 tháng). (4) 25-30% khi nhận thông báo bàn giao. (5) 5% khi nhận sổ hồng (12-24 tháng sau bàn giao). Một số CĐT (Vinhomes, Masterise) có gói "ân hạn nợ gốc 24 tháng" hỗ trợ vay ngân hàng.',
    },
    { id: 25, cat: 'dat-coc',
        q: 'Có thể đặt cọc giữ chỗ online không?',
        a: 'Có với một số dự án mở bán mới. SGS Land hỗ trợ đặt cọc online qua chuyển khoản đến tài khoản company (không qua cá nhân) + biên nhận điện tử có chữ ký số. Mức giữ chỗ thường 50-100 triệu, hoàn 100% trong 7 ngày nếu đổi ý. Lưu ý: KHÔNG chuyển tiền cho cá nhân môi giới — yêu cầu hoá đơn hoặc biên nhận của pháp nhân SGS Land hoặc CĐT trực tiếp.',
    },
    { id: 26, cat: 'dat-coc',
        q: 'Mất cọc trong trường hợp nào?',
        a: 'Theo Điều 328 BLDS 2015, bên đặt cọc mất cọc khi: (1) Đơn phương huỷ HĐĐC mà không thuộc trường hợp bất khả kháng. (2) Không thực hiện nghĩa vụ thanh toán đúng hạn ghi trong HĐĐC (kể cả lý do vay ngân hàng không được duyệt — trừ khi HĐĐC có điều khoản loại trừ). (3) Cung cấp sai thông tin pháp nhân khi ký kết. SGS Land luôn rà soát điều khoản miễn trừ vay ngân hàng trước khi khách ký HĐĐC.',
    },
    { id: 27, cat: 'dat-coc',
        q: 'Phí công chứng và thuế khi mua BĐS là bao nhiêu?',
        a: 'Tổng phí + thuế khi sang tên BĐS (theo Luật Thuế TNCN 2007 sửa đổi + Nghị định 10/2022/NĐ-CP về lệ phí trước bạ — văn bản gốc trên thuvienphapluat.vn): (1) Thuế thu nhập cá nhân của bên BÁN: 2% giá trị giao dịch (theo giá ghi trên hợp đồng hoặc bảng giá nhà nước, tuỳ giá nào cao hơn). (2) Lệ phí trước bạ của bên MUA: 0,5% giá trị BĐS. (3) Phí công chứng: 0,1-0,3% giá trị giao dịch (tối đa 70 triệu). (4) Phí thẩm định hồ sơ + cấp sổ: 200k-500k. Thông thường bên bán-mua tự thoả thuận ai chịu phần nào trong HĐĐC. Hỗ trợ tư vấn miễn phí tại sgsland.vn/contact.',
    },
];
const CATEGORIES = [
    { id: 'mua-ban-phap-ly', label: 'Mua Bán & Pháp Lý',  color: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]',  icon: ICONS.HOME },
    { id: 'dinh-gia-ai',     label: 'Định Giá AI',          color: 'bg-emerald-50 text-emerald-600', icon: ICONS.AI },
    { id: 'ky-gui',          label: 'Ký Gửi & Đăng Tin',    color: 'bg-blue-50 text-blue-600',      icon: ICONS.CONSIGN },
    { id: 'lai-suat-vay',    label: 'Lãi Suất Vay',         color: 'bg-amber-50 text-amber-600',    icon: ICONS.BANK },
    { id: 'khu-vuc-hot',     label: 'Khu Vực Hot',          color: 'bg-rose-50 text-rose-600',      icon: ICONS.HOT },
    { id: 'dat-coc',         label: 'Đặt Cọc & Thanh Toán', color: 'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]',  icon: ICONS.DEPOSIT },
];
const FEEDBACK_LS_KEY = 'sgs_helpcenter_feedback';
type FeedbackMap = Record<number, 'up' | 'down'>;
function readFeedback(): FeedbackMap {
    try {
        const raw = localStorage.getItem(FEEDBACK_LS_KEY);
        return raw ? JSON.parse(raw) as FeedbackMap : {};
    } catch { return {}; }
}
function writeFeedback(map: FeedbackMap): void {
    try { localStorage.setItem(FEEDBACK_LS_KEY, JSON.stringify(map)); } catch { /* noop */ }
}
export const HelpCenter: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [openArticleId, setOpenArticleId] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<FeedbackMap>({});
    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
        setFeedback(readFeedback());
    }, []);
    const handleHome    = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin   = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;
    const handleContact = () => window.location.hash = `#/${ROUTES.CONTACT}`;
    const filtered = useMemo(() => {
        let list = ARTICLES;
        if (activeCategory) list = list.filter(a => a.cat === activeCategory);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(a => a.q.toLowerCase().includes(q) || a.a.toLowerCase().includes(q));
        }
        return list;
    }, [searchQuery, activeCategory]);
    const toggleArticle = (id: number) =>
        setOpenArticleId(prev => (prev === id ? null : id));
    const submitFeedback = (id: number, value: 'up' | 'down') => {
        setFeedback(prev => {
            const next: FeedbackMap = { ...prev, [id]: value };
            writeFeedback(next);
            return next;
        });
    };
    // ── FAQPage JSON-LD bao trọn 27 Q&A — server-rendered cho AI/Claude ─
    const faqStructuredData = useMemo(() => ({
        '@type': 'FAQPage',
        name: 'Trung tâm hỗ trợ SGS Land — 27 câu hỏi thường gặp về BĐS Việt Nam',
        inLanguage: 'vi-VN',
        mainEntity: ARTICLES.map(a => ({
            '@type': 'Question',
            name: a.q,
            acceptedAnswer: { '@type': 'Answer', text: a.a },
        })),
    }), []);
    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            <SeoHead
                title="Trung Tâm Hỗ Trợ SGS Land | 27 Câu Hỏi Thường Gặp BĐS"
                description="27 câu hỏi thường gặp về mua bán BĐS, pháp lý sổ hồng, định giá AI, ký gửi, lãi suất vay, khu vực hot và đặt cọc tại Việt Nam. Trả lời chuyên sâu bởi đội pháp lý SGS Land."
                canonicalPath="/help-center"
                structuredData={faqStructuredData}
            />
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
                    <button onClick={handleHome} className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-secondary)] hover:text-sgs-primary transition-colors min-h-[44px] shrink-0">
                        {ICONS.BACK} <span className="hidden sm:inline">Trang Chủ</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="w-5 h-5 sm:w-6 sm:h-6 text-sgs-primary shrink-0" />
                        <span className="font-bold text-base sm:text-lg hidden sm:inline truncate">TRUNG TÂM HỖ TRỢ</span>
                    </div>
                    <button onClick={handleLogin} className="px-3 sm:px-6 py-2 bg-sgs-primary-deep text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-xs sm:text-sm min-h-[44px] shrink-0 whitespace-nowrap">
                        {currentUser ? 'Dashboard' : 'Đăng Nhập'}
                    </button>
                </div>
            </div>
            {/* Hero Search */}
            <section className="bg-sgs-primary-deep py-20 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sgs-primary-deep/40 via-slate-900 to-slate-900" />
                <div className="relative z-10 max-w-2xl mx-auto animate-enter">
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Chúng tôi có thể giúp gì?</h1>
                    <p className="text-base text-slate-300 mb-8">27 câu hỏi thường gặp về mua bán BĐS, pháp lý, định giá AI, lãi suất vay và khu vực hot tại Việt Nam.</p>
                    <div className="relative group">
                        <div className="absolute left-5 inset-y-0 flex items-center pointer-events-none text-slate-400 group-focus-within:text-sgs-text-muted transition-colors">
                            {ICONS.SEARCH}
                        </div>
                        <input
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setOpenArticleId(null); }}
                            className="w-full h-14 pl-14 pr-12 rounded-2xl bg-white/10 text-white text-base shadow-2xl focus:ring-4 focus:ring-[var(--sgs-primary)]/40 outline-none transition-all placeholder:text-slate-400 border border-white/10 focus:border-[var(--sgs-primary)] focus:bg-white/15"
                            placeholder="Tìm kiếm: sổ hồng, vay ngân hàng, đặt cọc, Long Thành…"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-4 inset-y-0 flex items-center text-slate-400 hover:text-white transition-colors">
                                {ICONS.X}
                            </button>
                        )}
                    </div>
                </div>
            </section>
            {/* User Guide Banner */}
            <div className="bg-gradient-to-r from-emerald-900/60 to-slate-900 border-b border-emerald-800/40">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Mới dùng SGS Land lần đầu?</p>
                            <p className="text-xs text-slate-400">Xem hướng dẫn chi tiết 12 tính năng — từ định giá AI đến quản lý lead và hợp đồng.</p>
                        </div>
                    </div>
                    <a
                        href="/huong-dan-su-dung"
                        className="shrink-0 px-4 py-2 bg-sgs-verified hover:bg-emerald-400 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                        Xem hướng dẫn →
                    </a>
                </div>
            </div>
            {/* Categories */}
            <div className="max-w-5xl mx-auto px-6 pt-8 relative z-20">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => { setActiveCategory(prev => prev === cat.id ? null : cat.id); setOpenArticleId(null); }}
                            className={`bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xl border transition-all text-left group hover:-translate-y-0.5 ${activeCategory === cat.id ? 'border-[var(--sgs-primary)] ring-2 ring-[var(--sgs-primary)]' : 'border-[var(--glass-border)]'}`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${cat.color} group-hover:scale-110 transition-transform`}>
                                {cat.icon}
                            </div>
                            <p className={`font-bold text-sm ${activeCategory === cat.id ? 'text-sgs-primary' : 'text-[var(--text-primary)]'}`}>{cat.label}</p>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{ARTICLES.filter(a => a.cat === cat.id).length} bài viết</p>
                        </button>
                    ))}
                </div>
                {/* Articles accordion */}
                <div className="bg-[var(--bg-surface)] rounded-[28px] border border-[var(--glass-border)] shadow-sm overflow-hidden mb-12">
                    <div className="px-8 py-6 border-b border-[var(--glass-border)] flex items-center justify-between">
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">
                            {activeCategory
                                ? `${CATEGORIES.find(c => c.id === activeCategory)?.label} — Câu hỏi thường gặp`
                                : 'Tất cả câu hỏi thường gặp'}
                        </h2>
                        {(activeCategory || searchQuery) && (
                            <button
                                onClick={() => { setActiveCategory(null); setSearchQuery(''); setOpenArticleId(null); }}
                                className="text-xs font-bold text-sgs-primary hover:text-sgs-primary transition-colors flex items-center gap-1"
                            >
                                {ICONS.X} Xóa lọc
                            </button>
                        )}
                    </div>

                    {filtered.length > 0 ? (
                        <div className="divide-y divide-[var(--glass-border)]">
                            {filtered.map(article => {
                                const isOpen = openArticleId === article.id;
                                const fb = feedback[article.id];
                                return (
                                <div key={article.id}>
                                    <button
                                        onClick={() => toggleArticle(article.id)}
                                        className="w-full flex items-center justify-between px-8 py-5 text-left hover:bg-[var(--glass-surface)] transition-colors group"
                                    >
                                        <span className={`font-medium text-sm md:text-base pr-4 transition-colors ${isOpen ? 'text-sgs-primary' : 'text-[var(--text-secondary)] group-hover:text-[var(--sgs-primary)]'}`}>
                                            {article.q}
                                        </span>
                                        <span className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[var(--sgs-primary)]' : ''}`}>
                                            {ICONS.CHEVRON_DOWN}
                                        </span>
                                    </button>
                                    {isOpen && (
                                        <div className="px-8 pb-6">
                                            <div className="p-5 bg-sgs-champagne border border-sgs-border rounded-xl text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                                {article.a}
                                            </div>
                                            {/* Micro-feedback */}
                                            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                                                <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                                                    <span className="font-semibold text-[var(--text-secondary)]">Câu trả lời này có hữu ích?</span>
                                                    {fb ? (
                                                        <span className="text-sgs-verified font-bold">Cảm ơn phản hồi của bạn!</span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => submitFeedback(article.id, 'up')}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-200 text-sgs-verified hover:bg-sgs-champagne transition"
                                                                aria-label="Hữu ích"
                                                            >
                                                                {ICONS.THUMB_UP} Có
                                                            </button>
                                                            <button
                                                                onClick={() => submitFeedback(article.id, 'down')}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition"
                                                                aria-label="Không hữu ích"
                                                            >
                                                                {ICONS.THUMB_DOWN} Không
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                                <p className="text-xs text-[var(--text-tertiary)]">
                                                    Cần hỗ trợ thêm?{' '}
                                                    <button onClick={handleContact} className="text-sgs-primary font-bold hover:underline">Liên hệ SGS Land</button>
                                                    {' '}hoặc <strong>info@sgsland.vn</strong>
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 px-6">
                            <p className="text-[var(--text-tertiary)] text-base">Không tìm thấy kết quả nào cho <strong>"{searchQuery}"</strong></p>
                            <button onClick={handleContact} className="mt-4 px-5 py-2.5 bg-sgs-primary text-white text-sm font-bold rounded-xl hover:bg-sgs-primary transition-colors">
                                Gửi câu hỏi đến đội ngũ hỗ trợ
                            </button>
                        </div>
                    )}
                </div>
                {/* CTA */}
                <div className="text-center mb-6">
                    <p className="text-[var(--text-tertiary)] mb-4 text-sm">Không tìm thấy nội dung bạn cần?</p>
                    <button
                        onClick={handleContact}
                        className="px-8 py-3 bg-sgs-primary text-white font-bold rounded-xl shadow-lg hover:bg-sgs-primary transition-all active:scale-95"
                    >
                        Liên Hệ Hỗ Trợ Trực Tiếp
                    </button>
                </div>
            </div>
        </div>
    );
};