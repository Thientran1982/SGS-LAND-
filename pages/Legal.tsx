
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../services/i18n';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { User } from '../types';

// -----------------------------------------------------------------------------
//  LEGAL CONTENT — Comprehensive Vietnamese Law-Compliant Texts
//  Tuân thủ: NĐ 13/2023/NĐ-CP, Luật ATTT 2018, Luật GDĐT 2023,
//            Luật BVQLNTD 2023, BLDS 2015, Luật TM 2005, NĐ 52/2013/NĐ-CP
// -----------------------------------------------------------------------------

const LEGAL_CONTENT = {
    vn: {
        privacy: [
            {
                heading: "1. Tổng Quan & Căn Cứ Pháp Lý",
                content: "Chính sách bảo mật này ('Chính sách') do SGS Land Corp ('SGS LAND', 'Chúng tôi', 'Công ty') ban hành và áp dụng đối với tất cả người dùng ('Bạn', 'Chủ thể dữ liệu') truy cập hoặc sử dụng Nền tảng Hệ điều hành Bất động sản SGS LAND tại sgsland.vn và các ứng dụng liên quan ('Nền tảng').\n\nChính sách này được xây dựng và tuân thủ theo:\n- Nghị định 13/2023/NĐ-CP ngày 17/04/2023 của Chính phủ về bảo vệ dữ liệu cá nhân;\n- Luật An ninh mạng 2018 (Luật số 24/2018/QH14);\n- Luật Giao dịch điện tử 2023 (Luật số 20/2023/QH15);\n- Luật Bảo vệ quyền lợi người tiêu dùng 2023 (Luật số 19/2023/QH15);\n- Nghị định 52/2013/NĐ-CP về thương mại điện tử (sửa đổi bởi NĐ 85/2021/NĐ-CP);\n- Bộ luật Dân sự 2015 (Luật số 91/2015/QH13).\n\nChính sách này có hiệu lực từ ngày 01/04/2025. Khi bạn tiếp tục sử dụng Nền tảng sau ngày này, bạn xác nhận đã đọc, hiểu và đồng ý với toàn bộ nội dung của Chính sách."
            },
            {
                heading: "2. Dữ Liệu Cá Nhân Thu Thập",
                content: "Chúng tôi thu thập các loại dữ liệu cá nhân sau đây theo Điều 2 và Điều 9 Nghị định 13/2023/NĐ-CP:\n\nA. DỮ LIỆU CÁ NHÂN CƠ BẢN (Dữ liệu thông thường):\n- Thông tin định danh: Họ tên đầy đủ, ngày sinh, giới tính, số CCCD/CMND/Hộ chiếu.\n- Thông tin liên lạc: Số điện thoại, địa chỉ email, địa chỉ thường trú hoặc liên lạc.\n- Thông tin nghề nghiệp: Tên công ty, chức vụ, mã số môi giới bất động sản (nếu là đại lý được cấp phép).\n- Dữ liệu tương tác: Lịch sử tìm kiếm, tin đăng yêu thích, lịch sử xem bất động sản, hành vi sử dụng Nền tảng.\n- Dữ liệu thiết bị: Địa chỉ IP, loại trình duyệt, hệ điều hành, mã định danh thiết bị, múi giờ.\n- Thông tin giao dịch: Lịch sử hợp đồng, đề xuất mua-bán-thuê được tạo trên Nền tảng.\n\nB. DỮ LIỆU CÁ NHÂN NHẠY CẢM (Chỉ thu thập khi có đồng ý rõ ràng theo Điều 9 NĐ 13/2023):\n- Thông tin tài chính: Số tài khoản ngân hàng, thông tin thanh toán (lưu dưới dạng mã hóa AES-256).\n- Vị trí địa lý thời gian thực (chỉ khi bạn kích hoạt tính năng định vị).\n\nDữ liệu được thu thập qua: Biểu mẫu đăng ký và sử dụng, hoạt động trong ứng dụng, API của bên thứ ba khi đăng nhập bằng Google/SSO, và cookie/công nghệ theo dõi tương đương theo Mục 9 dưới đây."
            },
            {
                heading: "3. Căn Cứ Pháp Lý Xử Lý Dữ Liệu",
                content: "Chúng tôi chỉ xử lý dữ liệu cá nhân của bạn khi có ít nhất một trong các căn cứ pháp lý sau đây theo Điều 17 Nghị định 13/2023/NĐ-CP:\n\n(a) Đồng ý (Consent): Bạn đã cung cấp sự đồng ý rõ ràng, tự nguyện cho mục đích xử lý cụ thể. Bạn có quyền rút lại sự đồng ý bất kỳ lúc nào mà không ảnh hưởng đến tính hợp pháp của việc xử lý trước đó. Ví dụ: nhận thông báo tiếp thị, chia sẻ thông tin liên lạc với môi giới.\n\n(b) Thực hiện hợp đồng (Contract Performance): Việc xử lý là cần thiết để thực hiện hợp đồng dịch vụ giữa bạn và SGS LAND. Ví dụ: xác thực tài khoản, xử lý giao dịch, tạo hợp đồng điện tử.\n\n(c) Nghĩa vụ pháp lý (Legal Obligation): Việc xử lý là bắt buộc để tuân thủ quy định pháp luật hiện hành. Ví dụ: cung cấp thông tin theo yêu cầu hợp pháp của cơ quan nhà nước có thẩm quyền; lưu trữ hồ sơ theo Luật Kế toán và Luật Thuế.\n\n(d) Lợi ích hợp pháp (Legitimate Interests): Việc xử lý là cần thiết cho lợi ích hợp pháp của SGS LAND, không lấn át quyền lợi cơ bản của bạn. Ví dụ: phòng ngừa gian lận, bảo mật hệ thống, cải thiện chất lượng dịch vụ."
            },
            {
                heading: "4. Mục Đích Xử Lý Dữ Liệu",
                content: "Dữ liệu của bạn được sử dụng cho các mục đích sau, với phạm vi dữ liệu thu thập ở mức tối thiểu cần thiết (nguyên tắc tối thiểu hóa dữ liệu — Data Minimisation):\n\n- Vận hành Nền tảng: Tạo và quản lý tài khoản, xác thực danh tính, quản lý phiên đăng nhập và bảo mật.\n- Dịch vụ AI & CRM: Cung cấp định giá tự động (AVM), phân tích thị trường, khớp nối nhu cầu mua-bán-thuê bất động sản.\n- Cải thiện sản phẩm: Huấn luyện mô hình máy học trên dữ liệu đã được ẩn danh hóa hoàn toàn — không thể tái nhận dạng cá nhân.\n- Giao tiếp dịch vụ bắt buộc: Gửi thông báo quan trọng về tài khoản, giao dịch, cập nhật bảo mật và chính sách (không thể từ chối loại thông báo này).\n- Tiếp thị (tùy chọn): Gửi thông tin khuyến mãi, xu hướng thị trường — CHỈ khi bạn đã đồng ý và bạn có thể hủy đăng ký bất kỳ lúc nào qua liên kết trong email.\n- Tuân thủ pháp lý: Lưu trữ nhật ký giao dịch; xử lý khiếu nại, tranh chấp và yêu cầu từ cơ quan có thẩm quyền.\n- Phòng ngừa gian lận: Phát hiện và ngăn chặn hành vi bất thường, vi phạm điều khoản sử dụng, và bảo vệ tính toàn vẹn của Nền tảng."
            },
            {
                heading: "5. Nhà Cung Cấp Dịch Vụ Bên Thứ Ba",
                content: "Để vận hành Nền tảng, chúng tôi sử dụng các nhà cung cấp bên thứ ba dưới đây. Mỗi nhà cung cấp đều được ràng buộc bằng hợp đồng xử lý dữ liệu với các tiêu chuẩn bảo mật tương đương hoặc cao hơn tiêu chuẩn của chúng tôi:\n\n- Google Gemini (Trí tuệ nhân tạo): Cung cấp tính năng định giá AI và phân tích bất động sản. Dữ liệu truyền tải bao gồm: mô tả tài sản và số liệu thị trường — không chứa thông tin định danh cá nhân. Tham khảo: policies.google.com\n\n- PostgreSQL/Neon (Cơ sở dữ liệu): Lưu trữ an toàn toàn bộ dữ liệu người dùng trên máy chủ tại khu vực được phê duyệt. Dữ liệu được mã hóa khi lưu trữ (AES-256) và khi truyền tải (TLS 1.3).\n\n- Nhà cung cấp Email/SMS (Thông báo giao dịch): Gửi email xác nhận và SMS xác thực. Chỉ nhận địa chỉ email/số điện thoại và nội dung thông báo — không nhận dữ liệu tài chính hoặc định danh nhạy cảm.\n\n- Google OAuth / SSO (Xác thực): Quản lý đăng nhập an toàn. Chúng tôi chỉ nhận mã định danh người dùng và địa chỉ email từ Google; không nhận mật khẩu Google.\n\n- Hệ thống phân tích nội bộ: Thu thập dữ liệu sử dụng Nền tảng ở dạng tổng hợp, ẩn danh để cải thiện trải nghiệm người dùng.\n\nCHÚ Ý QUAN TRỌNG: Chúng tôi KHÔNG sử dụng pixel theo dõi quảng cáo của bên thứ ba (Facebook Pixel, Google Ads, TikTok Pixel, v.v.) và KHÔNG chia sẻ dữ liệu người dùng với bất kỳ nền tảng quảng cáo nào."
            },
            {
                heading: "6. Thời Gian Lưu Trữ Dữ Liệu",
                content: "Chúng tôi lưu trữ dữ liệu cá nhân của bạn trong thời gian tối thiểu cần thiết để thực hiện mục đích xử lý, cụ thể:\n\n- Dữ liệu tài khoản đang hoạt động: Trong suốt thời gian tài khoản còn tồn tại, cộng thêm 30 ngày sau khi bạn yêu cầu xóa tài khoản.\n- Dữ liệu giao dịch, hợp đồng và tài chính: 10 năm kể từ ngày hoàn thành giao dịch, theo quy định của Luật Kế toán, Luật Thuế và Luật Kinh doanh bất động sản.\n- Nhật ký bảo mật và truy cập hệ thống: 24 tháng.\n- Dữ liệu tiếp thị của người đã hủy đăng ký: Bị xóa hoàn toàn trong vòng 30 ngày sau khi hủy đăng ký.\n- Dữ liệu đã ẩn danh hóa không thể phục hồi: Có thể được lưu trữ vô thời hạn cho mục đích phân tích thị trường, vì không còn cấu thành dữ liệu cá nhân theo pháp luật.\n\nSau khi hết thời hạn lưu trữ, dữ liệu sẽ bị xóa an toàn theo tiêu chuẩn kỹ thuật không thể phục hồi hoặc ẩn danh hóa không thể tái nhận dạng."
            },
            {
                heading: "7. Chuyển Giao Dữ Liệu Xuyên Biên Giới",
                content: "Nền tảng SGS LAND vận hành chủ yếu tại Việt Nam. Một số nhà cung cấp bên thứ ba (ví dụ: Google) có thể xử lý dữ liệu tại máy chủ đặt bên ngoài lãnh thổ Việt Nam. Trong mọi trường hợp, chúng tôi đảm bảo:\n\n(a) Chỉ chuyển giao dữ liệu ra ngoài Việt Nam khi quốc gia tiếp nhận có tiêu chuẩn bảo vệ dữ liệu tương đương hoặc cao hơn, hoặc khi có hợp đồng xử lý dữ liệu với các điều khoản bảo vệ đầy đủ theo Điều 25 Nghị định 13/2023/NĐ-CP.\n\n(b) Không chuyển giao dữ liệu NHẠY CẢM (số tài khoản ngân hàng, số CCCD/CMND) ra nước ngoài trừ khi có sự đồng ý rõ ràng của bạn hoặc theo yêu cầu bắt buộc của pháp luật Việt Nam.\n\n(c) Mọi nhà cung cấp nhận dữ liệu từ SGS LAND đều phải ký kết hợp đồng xử lý dữ liệu ràng buộc với các điều khoản bảo vệ không thấp hơn mức bảo vệ theo pháp luật Việt Nam."
            },
            {
                heading: "8. Bảo Mật Kỹ Thuật & Tổ Chức",
                content: "Chúng tôi triển khai các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ liệu của bạn:\n\n- Mã hóa truyền tải: TLS 1.3 bắt buộc cho toàn bộ lưu lượng giữa trình duyệt và máy chủ (HTTPS toàn diện).\n- Mã hóa lưu trữ: AES-256 cho dữ liệu nhạy cảm bao gồm mật khẩu (bcrypt), thông tin thanh toán.\n- Kiểm soát truy cập: Hệ thống phân quyền nhiều cấp (Role-Based Access Control), xác thực đa yếu tố (MFA) bắt buộc cho tài khoản quản trị.\n- Phân lập dữ liệu đa thuê (Multi-Tenant Row-Level Security): Dữ liệu giữa các tổ chức khác nhau được phân lập hoàn toàn ở tầng cơ sở dữ liệu, ngăn chặn truy cập chéo.\n- Kiểm toán và nhật ký: Mọi truy cập vào dữ liệu nhạy cảm đều được ghi nhật ký và lưu trữ.\n- Ứng phó sự cố lộ lọt dữ liệu: Chúng tôi có quy trình ứng phó sự cố và cam kết thông báo cho các bên liên quan trong vòng 72 giờ kể từ khi phát hiện, theo đúng Điều 23 Nghị định 13/2023/NĐ-CP.\n\nLưu ý: Mặc dù chúng tôi áp dụng các biện pháp bảo mật tốt nhất có thể, không có hệ thống nào là tuyệt đối an toàn 100%. Bạn chịu trách nhiệm bảo mật thông tin đăng nhập tài khoản của mình và thông báo ngay cho chúng tôi nếu phát hiện truy cập trái phép."
            },
            {
                heading: "9. Cookie & Công Nghệ Theo Dõi",
                content: "Nền tảng sử dụng cookie và công nghệ lưu trữ cục bộ (localStorage, sessionStorage) để đảm bảo tính năng hoạt động và trải nghiệm người dùng:\n\n- Cookie bắt buộc (Essential Cookies): Cần thiết để duy trì phiên đăng nhập, xác thực bảo mật và các tính năng cơ bản. Không thể tắt — việc tắt loại này sẽ làm gián đoạn toàn bộ hoạt động của Nền tảng.\n- Cookie phân tích (Analytics Cookies): Thu thập dữ liệu sử dụng ẩn danh (lượt xem trang, thời gian phiên) để cải thiện giao diện và hiệu năng. Có thể tắt qua trang Cài đặt Cookie.\n- Cookie tiếp thị: Hiện tại CHÚNG TÔI KHÔNG sử dụng cookie tiếp thị hoặc pixel theo dõi của bất kỳ nền tảng quảng cáo bên thứ ba nào.\n\nBạn có thể kiểm soát và tắt cookie tùy chọn thông qua trang Cài đặt Cookie của chúng tôi hoặc thông qua cài đặt trình duyệt. Cài đặt của bạn được ghi nhớ cho các lần truy cập tiếp theo."
            },
            {
                heading: "10. Quyền Của Chủ Thể Dữ Liệu",
                content: "Theo Chương III Nghị định 13/2023/NĐ-CP, bạn có đầy đủ các quyền sau đây đối với dữ liệu cá nhân của mình:\n\n(1) Quyền được biết (Điều 9): Được thông báo về việc xử lý dữ liệu cá nhân của mình, bao gồm mục đích, phạm vi, thời gian và cách thức xử lý.\n\n(2) Quyền đồng ý và rút lại đồng ý (Điều 9): Đồng ý hoặc không đồng ý cho phép xử lý dữ liệu; rút lại sự đồng ý bất kỳ lúc nào mà không ảnh hưởng đến tính hợp pháp của việc xử lý đã diễn ra trước đó.\n\n(3) Quyền truy cập (Điều 9): Xem và nhận bản sao dữ liệu cá nhân đang được xử lý về mình.\n\n(4) Quyền chỉnh sửa (Điều 9): Yêu cầu chỉnh sửa, cập nhật dữ liệu cá nhân không chính xác hoặc không đầy đủ.\n\n(5) Quyền xóa dữ liệu (Điều 9): Yêu cầu xóa dữ liệu cá nhân, trừ các trường hợp pháp luật quy định phải lưu trữ (ví dụ: dữ liệu giao dịch, hợp đồng theo Luật Thuế và Luật Kế toán).\n\n(6) Quyền hạn chế xử lý (Điều 9): Yêu cầu tạm dừng xử lý dữ liệu trong thời gian đang giải quyết khiếu nại hoặc yêu cầu chỉnh sửa.\n\n(7) Quyền phản đối tiếp thị trực tiếp (Điều 9): Phản đối việc sử dụng dữ liệu cho mục đích tiếp thị, quảng cáo bất kỳ lúc nào.\n\n(8) Quyền khiếu nại (Điều 9): Nộp đơn khiếu nại lên Cục An toàn thông tin (Bộ Thông tin và Truyền thông) tại ais.gov.vn nếu quyền lợi bị vi phạm.\n\nĐể thực hiện các quyền trên, gửi yêu cầu đến: legal@sgsland.vn. Chúng tôi cam kết phản hồi trong vòng 72 giờ làm việc kể từ khi nhận được yêu cầu hợp lệ."
            },
            {
                heading: "11. Người Dùng Dưới 18 Tuổi",
                content: "Nền tảng SGS LAND được thiết kế dành riêng cho người dùng từ đủ 18 tuổi trở lên — đây là độ tuổi tối thiểu để có đầy đủ năng lực hành vi dân sự nhằm thực hiện các giao dịch bất động sản theo Bộ luật Dân sự Việt Nam 2015 (Điều 20) và Luật Kinh doanh Bất động sản 2023.\n\nChúng tôi không cố ý thu thập hoặc xử lý dữ liệu cá nhân của người dưới 18 tuổi. Nếu phát hiện đã vô tình thu thập dữ liệu của người chưa đủ 18 tuổi, chúng tôi sẽ xóa dữ liệu đó ngay lập tức kể từ khi phát hiện.\n\nPhụ huynh hoặc người giám hộ phát hiện con em đã đăng ký tài khoản dưới độ tuổi tối thiểu, vui lòng liên hệ ngay legal@sgsland.vn để được hỗ trợ xóa tài khoản và dữ liệu liên quan."
            },
            {
                heading: "12. Thay Đổi Chính Sách",
                content: "Chúng tôi có thể cập nhật Chính sách này khi pháp luật thay đổi, khi chúng tôi bổ sung tính năng mới, hoặc khi có thay đổi trong cách thức xử lý dữ liệu.\n\n- Thay đổi trọng yếu (ảnh hưởng đáng kể đến quyền lợi của bạn): Chúng tôi sẽ thông báo trước ít nhất 15 ngày qua email đã đăng ký và thông báo nổi bật trong ứng dụng. Trong thời gian thông báo, bạn có quyền xóa tài khoản nếu không đồng ý.\n- Thay đổi không trọng yếu (làm rõ ngôn ngữ, bổ sung nhà cung cấp bên thứ ba tương đương): Chúng tôi sẽ đăng phiên bản mới tại trang này và ghi rõ ngày cập nhật mà không cần thông báo riêng.\n\nViệc bạn tiếp tục sử dụng Nền tảng sau ngày Chính sách được cập nhật có hiệu lực đồng nghĩa với việc bạn chấp thuận những thay đổi đó. Chúng tôi khuyến nghị bạn đọc lại Chính sách định kỳ."
            },
            {
                heading: "13. Liên Hệ & Khiếu Nại",
                content: "Nếu bạn có câu hỏi về Chính sách này, muốn thực hiện quyền dữ liệu, hoặc muốn khiếu nại về việc xử lý dữ liệu cá nhân, vui lòng liên hệ:\n\nBộ phận Bảo vệ Dữ liệu (DPO — Data Protection Officer)\nSGS Land Corp\nĐịa chỉ đăng ký: TP. Hồ Chí Minh, Việt Nam\nEmail: legal@sgsland.vn\nThời gian làm việc: 08:00 – 17:30 (Thứ Hai – Thứ Sáu, trừ ngày lễ theo quy định)\n\nNếu sau khi liên hệ với chúng tôi, bạn không hài lòng với cách giải quyết, bạn có quyền nộp khiếu nại lên Cục An toàn thông tin, Bộ Thông tin và Truyền thông Việt Nam tại địa chỉ: ais.gov.vn hoặc theo các kênh khiếu nại chính thức của cơ quan nhà nước có thẩm quyền."
            }
        ],
        terms: [
            {
                heading: "1. Định Nghĩa & Phạm Vi Áp Dụng",
                content: "Điều khoản dịch vụ này ('Điều khoản') là thỏa thuận pháp lý ràng buộc giữa SGS Land Corp ('SGS LAND', 'Chúng tôi', 'Công ty') và cá nhân, tổ chức ('Bạn', 'Người dùng') truy cập hoặc sử dụng nền tảng tại sgsland.vn và các ứng dụng liên quan ('Nền tảng').\n\nCác thuật ngữ chính được định nghĩa như sau:\n- 'Nền tảng': Hệ điều hành Bất động sản SGS LAND bao gồm toàn bộ website, API, hệ thống CRM, tính năng AI và tất cả dịch vụ kết nối.\n- 'Người dùng': Bất kỳ cá nhân hoặc tổ chức truy cập hoặc sử dụng Nền tảng, bao gồm người mua, người bán, môi giới và nhà phát triển bất động sản.\n- 'Nội dung người dùng': Dữ liệu, tài liệu, hình ảnh, thông tin bất động sản và bất kỳ nội dung nào bạn tải lên, nhập hoặc tạo ra trên Nền tảng.\n- 'Dịch vụ AI': Tính năng định giá tự động (AVM), phân tích thị trường và gợi ý được cung cấp bởi mô hình ngôn ngữ lớn (LLM).\n- 'Tổ chức': Sàn giao dịch bất động sản, công ty hoặc nhóm môi giới được cấp tài khoản đa người dùng."
            },
            {
                heading: "2. Chấp Thuận Điều Khoản",
                content: "Bằng việc thực hiện bất kỳ hành động nào trong số sau đây:\n(a) Tạo tài khoản SGS LAND;\n(b) Nhấp 'Đồng ý', 'Đăng ký', 'Bắt đầu dùng thử' hoặc nút xác nhận tương tự;\n(c) Truy cập hoặc sử dụng Nền tảng;\n\nbạn xác nhận đã đọc kỹ, hiểu đầy đủ và đồng ý bị ràng buộc bởi các Điều khoản này, cùng với Chính sách Bảo mật (được tích hợp bằng cách tham chiếu và có giá trị như phần không thể tách rời của Điều khoản này).\n\nNếu bạn đại diện cho một tổ chức, bạn bảo đảm và cam kết có đầy đủ thẩm quyền pháp lý để ràng buộc tổ chức đó theo các Điều khoản này.\n\nNếu bạn không đồng ý với bất kỳ điều khoản nào, bạn phải ngừng sử dụng Nền tảng ngay lập tức. Việc tiếp tục sử dụng Nền tảng sau khi có thay đổi Điều khoản đồng nghĩa với việc chấp thuận các thay đổi đó."
            },
            {
                heading: "3. Đăng Ký Tài Khoản & Điều Kiện Sử Dụng",
                content: "Để sử dụng đầy đủ tính năng Nền tảng, bạn phải đáp ứng các điều kiện sau:\n\n(a) Tuổi tác và năng lực pháp lý: Tối thiểu 18 tuổi và có đầy đủ năng lực hành vi dân sự theo pháp luật Việt Nam (Điều 20 BLDS 2015).\n\n(b) Thông tin chính xác và đầy đủ: Cung cấp thông tin đăng ký trung thực, chính xác và cập nhật. Bạn có nghĩa vụ cập nhật thông tin ngay khi có thay đổi.\n\n(c) Nguyên tắc một tài khoản: Mỗi cá nhân chỉ được duy trì một tài khoản cá nhân. Tạo nhiều tài khoản để lách các hạn chế, thực hiện gian lận, hoặc lạm dụng chính sách dùng thử là vi phạm Điều khoản này.\n\n(d) Trách nhiệm bảo mật tài khoản: Bạn hoàn toàn chịu trách nhiệm về tất cả hoạt động diễn ra dưới tài khoản của mình, dù do bạn thực hiện hay không. Thông báo ngay cho chúng tôi tại security@sgsland.vn nếu phát hiện bất kỳ truy cập trái phép nào vào tài khoản.\n\n(e) Đại diện tổ chức: Người đăng ký tài khoản tổ chức phải là người đại diện pháp lý hoặc được ủy quyền hợp lệ bằng văn bản của pháp nhân đó."
            },
            {
                heading: "4. Hành Vi Bị Cấm",
                content: "Người dùng TUYỆT ĐỐI KHÔNG được thực hiện các hành vi sau khi sử dụng Nền tảng:\n\n(a) Đăng tải thông tin sai lệch, gian lận về bất động sản, giá cả, pháp lý, quy hoạch, hoặc quyền sở hữu — bao gồm hành vi giả mạo Giấy chứng nhận quyền sử dụng đất hoặc các tài liệu pháp lý.\n\n(b) Sử dụng Nền tảng cho mục đích rửa tiền, lừa đảo chiếm đoạt tài sản, tài trợ khủng bố, hoặc bất kỳ hành vi vi phạm pháp luật hình sự Việt Nam nào.\n\n(c) Thu thập dữ liệu trái phép (web scraping, crawling, data harvesting, screen scraping) từ Nền tảng mà không có sự chấp thuận trước bằng văn bản của SGS LAND.\n\n(d) Dịch ngược, giải mã, tháo rời (decompile/disassemble) hoặc cố gắng trích xuất mã nguồn, thuật toán AI, hoặc cấu trúc cơ sở dữ liệu của Nền tảng.\n\n(e) Thực hiện hoặc khởi động bất kỳ cuộc tấn công mạng nào nhắm vào Nền tảng, bao gồm tấn công từ chối dịch vụ (DDoS), SQL injection, cross-site scripting (XSS), hoặc bất kỳ hình thức tấn công bảo mật nào khác.\n\n(f) Mạo danh cá nhân, tổ chức khác; giả mạo danh tính; hoặc trình bày sai lệch về mối quan hệ của bạn với bất kỳ cá nhân hay tổ chức nào.\n\n(g) Đăng tải nội dung vi phạm bản quyền, nhãn hiệu, bằng sáng chế hoặc quyền sở hữu trí tuệ của bên thứ ba.\n\n(h) Gửi thư rác (spam), tin nhắn không được phép, hay thực hiện tiếp thị trực tiếp không được yêu cầu thông qua Nền tảng.\n\n(i) Chia sẻ thông tin đăng nhập tài khoản cá nhân với người khác (ngoại trừ tính năng đa người dùng dành cho tài khoản tổ chức được cấp phép).\n\nSGS LAND có quyền, nhưng không có nghĩa vụ, giám sát Nền tảng để phát hiện vi phạm. Vi phạm bất kỳ điều nào trên đây có thể dẫn đến khóa tài khoản ngay lập tức, không hoàn phí, và SGS LAND có quyền truy cứu toàn bộ trách nhiệm pháp lý hình sự và dân sự theo quy định pháp luật."
            },
            {
                heading: "5. Tuyên Bố Miễn Trách Về Dịch Vụ AI",
                content: "QUAN TRỌNG — ĐỌC KỸ TRƯỚC KHI SỬ DỤNG TÍNH NĂNG AI:\n\nSGS LAND sử dụng trí tuệ nhân tạo (AI) và Mô hình định giá tự động (AVM — Automated Valuation Model) để cung cấp ước tính giá bất động sản, dự báo thị trường và gợi ý thông tin.\n\n(a) CHỈ MANG TÍNH THAM KHẢO: Kết quả từ AI là ước tính thống kê dựa trên dữ liệu lịch sử và hiện tại có sẵn. Chúng KHÔNG phải là báo cáo thẩm định giá chính thức theo Tiêu chuẩn thẩm định giá Việt Nam (TĐGVN) do thẩm định viên có chứng chỉ hành nghề lập. Kết quả AI KHÔNG có giá trị pháp lý trong bất kỳ giao dịch, hồ sơ vay vốn, tranh chấp pháp lý hay thủ tục hành chính nào.\n\n(b) KHÔNG PHẢI TƯ VẤN CHUYÊN NGHIỆP: Không có nội dung nào trên Nền tảng cấu thành lời tư vấn pháp lý, tài chính, thuế, đầu tư hay thẩm định giá chuyên nghiệp. SGS LAND không phải là tổ chức thẩm định giá được cấp phép.\n\n(c) TRÁCH NHIỆM QUYẾT ĐỊNH THUỘC VỀ NGƯỜI DÙNG: Bạn tự chịu toàn bộ rủi ro và trách nhiệm đối với mọi quyết định giao dịch bất động sản. SGS LAND, các cán bộ, nhân viên, và đại lý của chúng tôi KHÔNG chịu bất kỳ trách nhiệm pháp lý nào đối với thiệt hại tài chính, lợi nhuận bị mất, hoặc tổn thất khác phát sinh từ việc bạn căn cứ hoàn toàn hoặc chủ yếu vào kết quả AI.\n\n(d) ĐỘ CHÍNH XÁC CÓ GIỚI HẠN: Mô hình AI có thể cho kết quả không chính xác do biến động thị trường, thiếu dữ liệu địa phương, điều kiện pháp lý đặc thù, hoặc các yếu tố vật lý không thể đánh giá qua dữ liệu số.\n\nSGS LAND khuyến nghị mạnh mẽ: Hãy tham khảo ý kiến thẩm định viên có chứng chỉ hành nghề được cấp bởi Hội Thẩm định giá Việt Nam (VVA) và chuyên gia pháp lý bất động sản có thẩm quyền trước khi thực hiện bất kỳ giao dịch nào."
            },
            {
                heading: "6. Quyền Sở Hữu Trí Tuệ",
                content: "Toàn bộ quyền sở hữu trí tuệ liên quan đến Nền tảng, bao gồm nhưng không giới hạn ở: giao diện người dùng, đồ họa, thiết kế và trải nghiệm người dùng; mã nguồn phần mềm, thuật toán, API và kiến trúc hệ thống; mô hình AI và dữ liệu huấn luyện; thương hiệu 'SGS LAND', logo và tài sản thương hiệu; dữ liệu thị trường bất động sản được tổng hợp và xử lý; đều thuộc sở hữu độc quyền hoặc được cấp phép hợp pháp cho SGS Land Corp, được bảo hộ theo Luật Sở hữu trí tuệ Việt Nam 2005 (sửa đổi 2022) và các điều ước quốc tế mà Việt Nam là thành viên.\n\nGiấy phép sử dụng có giới hạn: Chúng tôi cấp cho bạn giấy phép sử dụng giới hạn, không độc quyền, không thể chuyển nhượng và có thể thu hồi để truy cập và sử dụng Nền tảng cho mục đích hợp pháp theo Điều khoản này. Giấy phép này không bao gồm quyền: sao chép, phân phối, tạo tác phẩm phái sinh, sử dụng thương mại, hoặc cho phép bên thứ ba sử dụng bất kỳ thành phần nào của Nền tảng.\n\nQuyền đối với nội dung của bạn: Bạn giữ toàn bộ quyền sở hữu đối với nội dung bạn tải lên Nền tảng. Bạn cấp cho SGS LAND giấy phép phi độc quyền, toàn cầu, miễn phí, có thể chuyển giao lại (sublicensable) trong phạm vi cần thiết, để lưu trữ, hiển thị, xử lý và cung cấp nội dung đó nhằm mục đích duy nhất là vận hành Nền tảng và cung cấp dịch vụ cho bạn. Khi bạn xóa tài khoản, giấy phép này chấm dứt sau thời hạn lưu trữ pháp lý bắt buộc."
            },
            {
                heading: "7. Dịch Vụ & Nội Dung Bên Thứ Ba",
                content: "Nền tảng có thể chứa liên kết đến website, dịch vụ hoặc nội dung của bên thứ ba. SGS LAND không kiểm soát và không chịu trách nhiệm về nội dung, chính sách bảo mật, hoặc thực tiễn của bất kỳ website hay dịch vụ bên thứ ba nào.\n\nViệc bạn truy cập các liên kết bên thứ ba là hoàn toàn tự nguyện và chịu rủi ro của riêng bạn. Chúng tôi khuyến nghị bạn đọc chính sách bảo mật và điều khoản của từng dịch vụ bên thứ ba trước khi sử dụng.\n\nCác thông tin bất động sản từ nguồn bên thứ ba được tổng hợp nhằm mục đích tham khảo. SGS LAND không xác nhận, không bảo đảm tính chính xác, đầy đủ hay cập nhật của thông tin từ các nguồn bên ngoài và không chịu trách nhiệm về bất kỳ thiệt hại nào phát sinh từ việc sử dụng thông tin đó."
            },
            {
                heading: "8. Phí Dịch Vụ & Thanh Toán",
                content: "Một số tính năng của Nền tảng yêu cầu đăng ký gói dịch vụ trả phí ('Gói Cao Cấp').\n\n(a) Thông tin giá và tính minh bạch: Toàn bộ phí dịch vụ được công bố rõ ràng, không có phí ẩn, trước khi bạn hoàn tất đăng ký. Chúng tôi có quyền thay đổi giá sau khi thông báo trước ít nhất 30 ngày.\n\n(b) Tự động gia hạn: Nếu đăng ký gói định kỳ (tháng/năm), gói sẽ tự động gia hạn vào cuối chu kỳ thanh toán trừ khi bạn hủy trước ít nhất 07 ngày trước ngày gia hạn. Chúng tôi sẽ gửi nhắc nhở trước 07 ngày.\n\n(c) Chính sách hoàn tiền: Phí đã thanh toán không được hoàn lại trừ khi: (i) SGS LAND vi phạm nghĩa vụ dịch vụ nghiêm trọng và không khắc phục trong vòng 48 giờ sau khi được thông báo; hoặc (ii) pháp luật Việt Nam hiện hành quy định buộc phải hoàn tiền.\n\n(d) Bù đắp gián đoạn dịch vụ: Nếu dịch vụ bị gián đoạn do lỗi trực tiếp của SGS LAND liên tục hơn 48 giờ, chúng tôi sẽ gia hạn tài khoản của bạn tương đương thời gian gián đoạn đó.\n\n(e) Chậm thanh toán: Tài khoản có phí quá hạn quá 14 ngày có thể bị tạm khóa tính năng cao cấp. Sau 90 ngày quá hạn không thanh toán và không có phản hồi, tài khoản có thể bị chấm dứt và dữ liệu có thể bị xóa sau thông báo cuối cùng 30 ngày."
            },
            {
                heading: "9. Tuyên Bố Miễn Trách & Giới Hạn Trách Nhiệm Pháp Lý",
                content: "TRONG PHẠM VI TỐI ĐA ĐƯỢC PHÁP LUẬT VIỆT NAM CHO PHÉP:\n\n(a) NỀN TẢNG ĐƯỢC CUNG CẤP 'NHƯ HIỆN TRẠNG': SGS LAND cung cấp Nền tảng trên cơ sở 'NHƯ HIỆN TRẠNG' (AS IS) và 'NHƯ CÓ SẴN' (AS AVAILABLE). Chúng tôi KHÔNG đưa ra bất kỳ bảo đảm nào, rõ ràng hay ngụ ý, về: (i) tính phù hợp thương mại; (ii) tính phù hợp cho mục đích cụ thể; (iii) sự không vi phạm quyền của bên thứ ba; (iv) tính chính xác, đầy đủ hoặc cập nhật của thông tin trên Nền tảng; (v) việc Nền tảng hoạt động liên tục, không bị gián đoạn hoặc không có lỗi.\n\n(b) LOẠI TRỪ THIỆT HẠI GIÁN TIẾP: SGS LAND KHÔNG chịu trách nhiệm về bất kỳ thiệt hại gián tiếp, hệ quả, đặc biệt, trừng phạt hay ngẫu nhiên nào, bao gồm: lợi nhuận bị mất, mất doanh thu, mất cơ hội kinh doanh, mất dữ liệu, mất uy tín kinh doanh; cho dù SGS LAND đã được thông báo trước về khả năng xảy ra các thiệt hại đó hay không.\n\n(c) GIỚI HẠN TỔNG MỨC BỒI THƯỜNG: Tổng trách nhiệm tích lũy của SGS LAND đối với bạn, từ bất kỳ nguyên nhân nào dù theo hợp đồng, ngoài hợp đồng, hoặc căn cứ pháp lý khác, được giới hạn ở mức: (i) Tổng phí dịch vụ thực tế bạn đã thanh toán cho SGS LAND trong 12 tháng liền kề trước thời điểm phát sinh nguyên nhân khiếu nại; HOẶC (ii) 1.000.000 VNĐ (Một triệu đồng Việt Nam); tùy theo mức nào CAO HƠN.\n\n(d) DỊCH VỤ MIỄN PHÍ: Đối với tính năng và dịch vụ cung cấp miễn phí, tổng trách nhiệm của SGS LAND được giới hạn tối đa ở mức 1.000.000 VNĐ (Một triệu đồng).\n\n(e) QUY ĐỊNH BẮT BUỘC KHÔNG BỊ LOẠI TRỪ: Điều khoản giới hạn này không loại trừ hoặc hạn chế trách nhiệm pháp lý phát sinh từ gian lận có chủ ý, lừa dối, tử vong hoặc thương tích cơ thể do sơ suất nghiêm trọng, hoặc bất kỳ trách nhiệm nào không thể loại trừ theo quy định bắt buộc của pháp luật Việt Nam."
            },
            {
                heading: "10. Bồi Thường Thiệt Hại Ngược",
                content: "Bạn đồng ý bảo vệ, bồi thường đầy đủ và giữ không bị thiệt hại cho SGS Land Corp, các công ty mẹ, công ty con, công ty liên kết, cán bộ, giám đốc, nhân viên, đại lý và người cấp phép, khỏi và chống lại mọi khiếu nại, trách nhiệm, thiệt hại, phán quyết, tổn thất, chi phí và phí luật sư hợp lý phát sinh từ hoặc liên quan đến:\n\n(a) Việc bạn sử dụng Nền tảng vi phạm Điều khoản này hoặc bất kỳ pháp luật hiện hành nào;\n(b) Nội dung bạn đăng tải lên Nền tảng vi phạm quyền của bên thứ ba hoặc quy định pháp luật;\n(c) Hành vi gian lận, mạo danh, hoặc bất hợp pháp của bạn;\n(d) Vi phạm bất kỳ quy định nào tại Điều 4 (Hành vi bị cấm);\n(e) Khiếu nại của bên thứ ba liên quan đến thông tin bất động sản bạn đăng tải sai lệch.\n\nNghĩa vụ bồi thường này không áp dụng trong phạm vi thiệt hại xuất phát trực tiếp từ lỗi hoặc sơ suất của SGS LAND. SGS LAND có quyền tự bào chữa trong bất kỳ vụ kiện nào, với chi phí do bạn chịu."
            },
            {
                heading: "11. Điều Khoản Bất Khả Kháng",
                content: "SGS LAND không chịu trách nhiệm về bất kỳ sự chậm trễ, gián đoạn hoặc thất bại trong việc thực hiện nghĩa vụ theo Điều khoản này khi nguyên nhân hoàn toàn hoặc chủ yếu nằm ngoài tầm kiểm soát hợp lý của chúng tôi, bao gồm nhưng không giới hạn ở:\n\n- Thiên tai, động đất, lũ lụt, hỏa hoạn, bão;\n- Dịch bệnh, đại dịch được cơ quan có thẩm quyền công bố;\n- Tấn công mạng quy mô lớn từ bên ngoài, tấn công DDoS bất thường;\n- Sự cố kỹ thuật của nhà cung cấp hạ tầng (điện lực, viễn thông, điện toán đám mây) mà SGS LAND không kiểm soát được;\n- Quyết định hành chính, lệnh cấm, hoặc quy định mới của cơ quan nhà nước có thẩm quyền.\n\nTrong trường hợp bất khả kháng, SGS LAND sẽ: (i) thông báo cho người dùng qua kênh liên lạc sẵn có trong thời gian sớm nhất có thể; (ii) nỗ lực hết mức để giảm thiểu tác động và khôi phục dịch vụ trong thời gian ngắn nhất; (iii) miễn phí gia hạn thời gian sử dụng dịch vụ tương ứng với thời gian bị ảnh hưởng bởi sự kiện bất khả kháng.\n\nThời gian bất khả kháng không được tính vào thời gian cam kết cung cấp dịch vụ (SLA) nếu có."
            },
            {
                heading: "12. Chấm Dứt Dịch Vụ",
                content: "A. CHẤM DỨT BỞI NGƯỜI DÙNG:\nBạn có thể chấm dứt tài khoản bất kỳ lúc nào thông qua trang Cài đặt tài khoản hoặc bằng cách liên hệ support@sgsland.vn. Sau khi xóa tài khoản: (i) Quyền truy cập bị chấm dứt ngay lập tức; (ii) Dữ liệu tài khoản sẽ được xóa trong vòng 30 ngày, ngoại trừ dữ liệu phải lưu theo quy định pháp luật; (iii) Phí đã thanh toán không được hoàn lại cho chu kỳ thanh toán hiện tại.\n\nB. CHẤM DỨT BỞI SGS LAND:\nSGS LAND có quyền tạm khóa hoặc chấm dứt vĩnh viễn tài khoản của bạn, có hoặc không cần báo trước, nếu: (i) Bạn vi phạm bất kỳ điều khoản nào tại Điều 4 (Hành vi bị cấm); (ii) Có hoạt động gian lận hoặc bất thường trên tài khoản; (iii) Theo yêu cầu hợp pháp của cơ quan nhà nước có thẩm quyền; (iv) SGS LAND ngừng cung cấp dịch vụ — trong trường hợp này sẽ thông báo trước ít nhất 30 ngày và hỗ trợ xuất khẩu dữ liệu.\n\nC. CÁC ĐIỀU KHOẢN TỒN TẠI SAU CHẤM DỨT:\nCác điều khoản sau tiếp tục có đầy đủ hiệu lực sau khi chấm dứt Điều khoản này: Quyền sở hữu trí tuệ (Điều 6), Giới hạn trách nhiệm (Điều 9), Bồi thường thiệt hại (Điều 10), và Luật áp dụng & Giải quyết tranh chấp (Điều 14)."
            },
            {
                heading: "13. Điều Khoản Chung",
                content: "(a) Toàn bộ thỏa thuận: Điều khoản này cùng với Chính sách bảo mật cấu thành toàn bộ thỏa thuận pháp lý giữa bạn và SGS LAND liên quan đến Nền tảng, thay thế và vô hiệu hóa tất cả các thỏa thuận, cam kết, hoặc trao đổi trước đây liên quan đến cùng chủ đề.\n\n(b) Không từ bỏ quyền: Việc SGS LAND không thực thi bất kỳ quyền hoặc điều khoản nào không cấu thành sự từ bỏ quyền đó. Mọi sự từ bỏ quyền chỉ có hiệu lực khi được thực hiện bằng văn bản có chữ ký của người đại diện có thẩm quyền của SGS LAND.\n\n(c) Khả năng tách rời: Nếu bất kỳ điều khoản nào được Tòa án xác định là không hợp lệ, không thể thi hành hoặc trái pháp luật, điều khoản đó sẽ bị sửa đổi hoặc loại bỏ ở mức tối thiểu cần thiết, trong khi các điều khoản còn lại tiếp tục có đầy đủ hiệu lực pháp lý.\n\n(d) Không chuyển nhượng: Bạn không được chuyển nhượng quyền hoặc nghĩa vụ theo Điều khoản này cho bất kỳ bên thứ ba nào mà không có sự đồng ý bằng văn bản trước của SGS LAND. SGS LAND có quyền chuyển nhượng Điều khoản này trong trường hợp mua lại, sáp nhập, hoặc chuyển nhượng toàn bộ/phần đáng kể tài sản của Công ty, mà không cần sự đồng ý của bạn.\n\n(e) Thông báo: Mọi thông báo pháp lý gửi cho SGS LAND phải được gửi bằng văn bản đến: legal@sgsland.vn. Thông báo được coi là đã nhận sau 48 giờ kể từ khi gửi email (hoặc theo xác nhận bằng văn bản đối với thông báo gửi qua bưu điện).\n\n(f) Hiệu lực ngôn ngữ: Phiên bản tiếng Việt của Điều khoản này và Chính sách bảo mật là văn bản gốc và có giá trị pháp lý cao nhất. Trong trường hợp có mâu thuẫn hoặc khác biệt về nội dung giữa phiên bản tiếng Việt và phiên bản tiếng Anh, phiên bản tiếng Việt được ưu tiên áp dụng."
            },
            {
                heading: "14. Luật Áp Dụng & Giải Quyết Tranh Chấp",
                content: "(a) Luật điều chỉnh: Điều khoản này được điều chỉnh, giải thích và thi hành theo pháp luật của Cộng hòa Xã hội Chủ nghĩa Việt Nam, bao gồm nhưng không giới hạn ở: Bộ luật Dân sự 2015, Luật Thương mại 2005, Luật Giao dịch điện tử 2023, và Luật Bảo vệ quyền lợi người tiêu dùng 2023.\n\n(b) Thương lượng thiện chí (bắt buộc): Trước khi tiến hành bất kỳ thủ tục pháp lý chính thức nào, các bên có nghĩa vụ nỗ lực giải quyết tranh chấp thông qua thương lượng thiện chí trong vòng 30 ngày kể từ ngày một bên gửi thông báo tranh chấp bằng văn bản cho bên còn lại.\n\n(c) Hòa giải: Nếu thương lượng không thành công sau 30 ngày, các bên có thể đưa tranh chấp ra hòa giải theo Luật Hòa giải, đối thoại tại Tòa án 2020 hoặc quy tắc hòa giải của Trung tâm Hòa giải Thương mại được chỉ định.\n\n(d) Xét xử tại Tòa án: Nếu hòa giải không thành công, mọi tranh chấp sẽ được đưa ra giải quyết tại Tòa án nhân dân có thẩm quyền tại Thành phố Hồ Chí Minh, Việt Nam. Bạn đồng ý chấp thuận thẩm quyền xét xử duy nhất và độc quyền của các Tòa án tại TP. Hồ Chí Minh và từ bỏ bất kỳ sự phản đối nào về thẩm quyền hoặc địa điểm xét xử tại các Tòa án này.\n\n(e) Không áp dụng trọng tài quốc tế: Trừ khi có thỏa thuận khác bằng văn bản ký bởi cả hai bên, mọi tranh chấp đều được giải quyết tại Tòa án Việt Nam theo thủ tục tố tụng dân sự của Việt Nam, không phải qua trọng tài quốc tế."
            }
        ]
    },
    en: {
        privacy: [
            {
                heading: "1. Overview & Legal Basis",
                content: "This Privacy Policy ('Policy') is issued by SGS Land Corp ('SGS LAND', 'We', 'Company') and applies to all users ('You', 'Data Subject') accessing or using the SGS LAND Real Estate Operating Platform at sgsland.vn and related applications ('Platform').\n\nThis Policy complies with:\n- Decree 13/2023/ND-CP on Personal Data Protection;\n- Cybersecurity Law 2018;\n- Electronic Transactions Law 2023;\n- Consumer Protection Law 2023;\n- E-Commerce Decree 52/2013/ND-CP (as amended);\n- Civil Code 2015.\n\nThis Policy takes effect from April 1, 2025. Continued use of the Platform after this date confirms you have read, understood, and agreed to the full content of this Policy. The Vietnamese version of this Policy is the legally binding original; in case of conflict, the Vietnamese version prevails."
            },
            {
                heading: "2. Personal Data Collected",
                content: "We collect the following categories of personal data under Articles 2 and 9 of Decree 13/2023/ND-CP:\n\nA. BASIC PERSONAL DATA (Standard Data):\n- Identity data: Full name, date of birth, gender, national ID/passport number.\n- Contact data: Phone number, email address, residential address.\n- Professional data: Company name, job title, real estate broker license number (if applicable).\n- Behavioral data: Search history, saved listings, property viewing history, platform usage patterns.\n- Device data: IP address, browser type, operating system, device identifier, timezone.\n- Transaction data: Contract history, purchase/sale/rental proposals created on the Platform.\n\nB. SENSITIVE PERSONAL DATA (Collected only with explicit consent per Article 9 Decree 13/2023):\n- Financial data: Bank account numbers, payment information (stored in AES-256 encrypted form).\n- Real-time geolocation (only when you activate location features).\n\nData is collected via: Registration forms, platform usage, third-party APIs (Google/SSO login), and cookies/equivalent tracking technologies as described in Section 9."
            },
            {
                heading: "3. Legal Basis for Data Processing",
                content: "We process your personal data only when at least one of the following legal bases applies under Article 17 of Decree 13/2023/ND-CP:\n\n(a) Consent: You have provided clear, voluntary consent for a specific processing purpose. You may withdraw consent at any time without affecting the lawfulness of prior processing.\n\n(b) Contract Performance: Processing is necessary to perform the service contract between you and SGS LAND.\n\n(c) Legal Obligation: Processing is required to comply with applicable Vietnamese law, including providing information to competent state authorities.\n\n(d) Legitimate Interests: Processing is necessary for SGS LAND's legitimate business interests (fraud prevention, system security, service improvement) without overriding your fundamental rights."
            },
            {
                heading: "4. Purpose of Data Processing",
                content: "Your data is used for the following purposes, with data collection limited to the minimum necessary (data minimisation principle):\n\n- Platform operation: Account creation, identity verification, session management and security.\n- AI & CRM services: Automated valuation (AVM), market analysis, buyer-seller-renter matching.\n- Product improvement: Training machine learning models on fully anonymised data — not re-identifiable.\n- Mandatory service communications: Important account, transaction, security, and policy update notifications (cannot be opted out).\n- Marketing communications (optional): Promotional content and market insights — only with your consent; unsubscribe at any time.\n- Legal compliance: Transaction log retention; handling complaints, disputes, and government authority requests.\n- Fraud prevention: Detecting and preventing abnormal activity and Terms violations."
            },
            {
                heading: "5. Third-Party Service Providers",
                content: "To operate the Platform, we use the following third-party providers, each bound by data processing agreements with equivalent or higher security standards:\n\n- Google Gemini (Artificial Intelligence): AI valuation and property analysis. Data transmitted: property descriptions and market metrics only — no personal identifiers.\n- PostgreSQL/Neon (Database): Secure storage of all user data with AES-256 encryption at rest and TLS 1.3 in transit.\n- Email/SMS Provider (Transactional Notifications): Delivery of confirmation emails and authentication SMS. Receives only contact info and message content — no financial data.\n- Google OAuth / SSO (Authentication): Secure login management. We receive only user identifier and email from Google.\n- Internal analytics system: Collects platform usage data in aggregated, anonymous form.\n\nIMPORTANT: We do NOT use third-party advertising pixels (Facebook Pixel, Google Ads, TikTok Pixel, etc.) and do NOT share user data with any advertising platforms."
            },
            {
                heading: "6. Data Retention",
                content: "We retain personal data for the minimum time necessary:\n\n- Active account data: Throughout account lifetime plus 30 days after deletion request.\n- Transaction, contract and financial data: 10 years from transaction completion (Vietnamese Tax and Accounting law).\n- Security and access logs: 24 months.\n- Marketing data (after unsubscribe): Deleted within 30 days.\n- Fully anonymised data: May be retained indefinitely for market analysis, as it no longer constitutes personal data.\n\nAfter retention periods expire, data is securely deleted using industry-standard irreversible methods or anonymised beyond re-identification."
            },
            {
                heading: "7. Cross-Border Data Transfers",
                content: "Some third-party providers (e.g., Google) may process data on servers outside Vietnam. In all cases, we ensure:\n\n(a) Transfers only occur to countries with equivalent or higher data protection standards, or under data processing agreements with adequate protection clauses per Article 25 of Decree 13/2023/ND-CP.\n\n(b) SENSITIVE data (bank accounts, national ID numbers) is not transferred outside Vietnam without your explicit consent or mandatory legal requirement.\n\n(c) All recipients of SGS LAND data must execute binding data processing agreements with protections no lower than Vietnamese law standards."
            },
            {
                heading: "8. Technical & Organisational Security",
                content: "We implement appropriate technical and organisational measures to protect your data:\n\n- Transmission encryption: Mandatory TLS 1.3 for all browser-server traffic (full HTTPS).\n- Storage encryption: AES-256 for sensitive data including passwords (bcrypt hashing).\n- Access controls: Multi-level Role-Based Access Control (RBAC); mandatory MFA for admin accounts.\n- Multi-tenant data isolation: Row-Level Security (RLS) at database level prevents cross-organisation data access.\n- Audit logging: All sensitive data access is logged and retained.\n- Incident response: We have a data breach response plan and commit to notifying affected parties within 72 hours of discovery, per Article 23 of Decree 13/2023/ND-CP.\n\nWhile we apply best-practice security measures, no system is 100% secure. You are responsible for maintaining the confidentiality of your account credentials."
            },
            {
                heading: "9. Cookies & Tracking Technologies",
                content: "The Platform uses cookies and local storage technologies for functionality and user experience:\n\n- Essential Cookies: Required for login sessions, security tokens, and core platform features. Cannot be disabled.\n- Analytics Cookies: Collect anonymous usage data (page views, session duration) to improve platform performance. Can be disabled via Cookie Settings.\n- Marketing Cookies: We currently do NOT use marketing cookies or tracking pixels from any third-party advertising platforms.\n\nYou can manage and disable optional cookies through our Cookie Settings page or browser settings. Your preferences are remembered for future visits."
            },
            {
                heading: "10. Data Subject Rights",
                content: "Under Chapter III of Decree 13/2023/ND-CP, you have the following rights regarding your personal data:\n\n(1) Right to be informed: Know how your personal data is being processed.\n(2) Right to consent and withdraw consent: Grant or withdraw consent at any time, without affecting prior lawful processing.\n(3) Right of access: View and receive a copy of your personal data being processed.\n(4) Right to rectification: Request correction of inaccurate or incomplete personal data.\n(5) Right to erasure: Request deletion of personal data, subject to legal retention requirements.\n(6) Right to restrict processing: Request suspension of processing during dispute resolution.\n(7) Right to object to direct marketing: Object at any time to data use for marketing purposes.\n(8) Right to lodge a complaint: File a complaint with the Authority for Information Security (Ministry of Information and Communications) at ais.gov.vn.\n\nTo exercise these rights, contact: legal@sgsland.vn. We commit to responding within 72 business hours of receiving a valid request."
            },
            {
                heading: "11. Minors Under 18",
                content: "The SGS LAND Platform is designed exclusively for users aged 18 or older — the minimum age for full legal capacity to conduct real estate transactions under Vietnamese Civil Code 2015 (Article 20) and Real Estate Business Law 2023.\n\nWe do not intentionally collect or process personal data of persons under 18. If we discover we have inadvertently collected such data, we will delete it immediately upon discovery.\n\nParents or guardians who discover that a minor has registered an account should contact legal@sgsland.vn immediately for account and data deletion support."
            },
            {
                heading: "12. Policy Changes",
                content: "We may update this Policy when laws change, when we add new features, or when data processing practices change.\n\n- Material changes (significantly affecting your rights): We will notify you at least 15 days in advance via registered email and prominent in-app notifications. You may delete your account if you disagree.\n- Non-material changes (clarifications, addition of similar third-party providers): We will post the updated version with a revised effective date without separate notification.\n\nContinued use of the Platform after the updated Policy takes effect constitutes acceptance of the changes."
            },
            {
                heading: "13. Contact & Complaints",
                content: "For questions about this Policy, to exercise data rights, or to lodge a complaint about personal data processing, contact:\n\nData Protection Officer (DPO)\nSGS Land Corp\nRegistered address: Ho Chi Minh City, Vietnam\nEmail: legal@sgsland.vn\nBusiness hours: 08:00 – 17:30 (Monday – Friday, excluding public holidays)\n\nIf you are not satisfied with our response, you have the right to lodge a complaint with the Authority for Information Security, Ministry of Information and Communications of Vietnam at ais.gov.vn."
            }
        ],
        terms: [
            {
                heading: "1. Definitions & Scope",
                content: "These Terms of Service ('Terms') constitute a legally binding agreement between SGS Land Corp ('SGS LAND', 'We', 'Company') and any individual or organisation ('You', 'User') accessing or using the platform at sgsland.vn and related applications ('Platform').\n\nKey definitions:\n- 'Platform': The SGS LAND Real Estate Operating System including website, API, CRM, AI features and connected services.\n- 'User': Any individual or organisation accessing or using the Platform.\n- 'User Content': Data, documents, images, property information and content uploaded or created on the Platform.\n- 'AI Services': Automated Valuation Model (AVM), market analysis and suggestions provided by large language models.\n- 'Organisation': Real estate exchange, company or broker group with an enterprise account."
            },
            {
                heading: "2. Acceptance of Terms",
                content: "By: (a) creating an SGS LAND account; (b) clicking 'Agree', 'Register' or equivalent confirmation; or (c) accessing or using the Platform — you confirm you have read, understood, and agree to be bound by these Terms and our Privacy Policy (incorporated by reference as an integral part).\n\nIf you represent an organisation, you warrant you have full legal authority to bind that organisation.\n\nIf you do not agree with any provision, you must immediately stop using the Platform. Continued use after Terms updates constitutes acceptance of the changes."
            },
            {
                heading: "3. Account Registration & Eligibility",
                content: "To use full Platform features:\n\n(a) Age and legal capacity: Minimum 18 years old with full legal capacity under Vietnamese Civil Code 2015 (Article 20).\n(b) Accurate information: You must provide truthful, accurate and complete registration information and keep it updated.\n(c) One account per person: Each individual may only maintain one personal account. Creating multiple accounts to circumvent restrictions or conduct fraud violates these Terms.\n(d) Account security: You are fully responsible for all activities under your account. Notify us immediately at security@sgsland.vn upon discovering unauthorised access.\n(e) Organisational accounts: The registrant must be the legal representative or duly authorised signatory of the organisation."
            },
            {
                heading: "4. Prohibited Conduct",
                content: "Users MUST NOT engage in the following while using the Platform:\n\n(a) Posting false or misleading information about properties, prices, legal status, zoning, or ownership — including forged land use right certificates.\n(b) Using the Platform for money laundering, fraud, terrorist financing, or any criminal activity under Vietnamese law.\n(c) Unauthorised data collection (web scraping, crawling, data harvesting) without prior written consent from SGS LAND.\n(d) Reverse engineering, decompiling, disassembling or attempting to extract source code, AI algorithms or database structure.\n(e) Executing any cyberattack against the Platform including DDoS, SQL injection, cross-site scripting or other security attacks.\n(f) Impersonating individuals or organisations, or misrepresenting your identity or affiliation.\n(g) Posting content infringing copyright, trademarks, patents or third-party intellectual property.\n(h) Sending spam or unsolicited direct marketing through the Platform.\n(i) Sharing personal account credentials with others (except for licensed multi-user organisational accounts).\n\nViolation of any of the above may result in immediate account termination without refund and SGS LAND may pursue full criminal and civil legal remedies."
            },
            {
                heading: "5. AI Services Disclaimer",
                content: "IMPORTANT — READ CAREFULLY BEFORE USING AI FEATURES:\n\nSGS LAND uses Artificial Intelligence and Automated Valuation Models (AVM) to provide property price estimates, market forecasts, and informational suggestions.\n\n(a) FOR REFERENCE ONLY: AI outputs are statistical estimates based on available historical and current data. They are NOT official appraisal reports under Vietnamese Valuation Standards (TĐGVN) prepared by licensed appraisers and have NO legal validity in any transaction, loan application, legal dispute or administrative procedure.\n\n(b) NOT PROFESSIONAL ADVICE: No content on the Platform constitutes legal, financial, tax, investment or professional valuation advice. SGS LAND is not a licensed appraisal organisation.\n\n(c) USER'S SOLE RESPONSIBILITY: You assume all risk and responsibility for real estate transaction decisions. SGS LAND, its officers, employees and agents are NOT liable for any financial loss, lost profits or damages arising from reliance on AI outputs without independent verification.\n\n(d) ACCURACY LIMITATIONS: AI models may produce inaccurate results due to market fluctuations, lack of localised data, specific legal conditions, or physical property characteristics not assessable through digital data.\n\nSGS LAND strongly recommends consulting a certified appraiser licensed by the Vietnam Valuers Association (VVA) and qualified real estate legal counsel before any transaction."
            },
            {
                heading: "6. Intellectual Property",
                content: "All intellectual property rights in the Platform — including UI/UX design, graphics, source code, algorithms, APIs, system architecture, AI models and training data, the 'SGS LAND' brand and logo, and aggregated market data — are owned exclusively by or licensed to SGS Land Corp, protected under Vietnam's Intellectual Property Law 2005 (amended 2022) and applicable international treaties.\n\nLimited licence: We grant you a limited, non-exclusive, non-transferable, revocable licence to access and use the Platform for lawful purposes under these Terms. This licence does not include the right to copy, distribute, create derivative works, commercialise, or permit third-party use of any Platform component.\n\nYour content ownership: You retain ownership of content you upload. You grant SGS LAND a non-exclusive, worldwide, royalty-free sublicensable licence to store, display, process and deliver your content solely to operate the Platform and provide services to you. This licence terminates after the mandatory legal retention period upon account deletion."
            },
            {
                heading: "7. Fees & Payments",
                content: "Some Platform features require paid subscription plans ('Premium Plans').\n\n(a) Price transparency: All fees are clearly disclosed with no hidden charges before subscription completion. We may change pricing with at least 30 days' advance notice.\n(b) Auto-renewal: Periodic plans (monthly/annual) auto-renew at the end of each billing cycle unless cancelled at least 7 days before renewal. We send a 7-day reminder.\n(c) Refund policy: Paid fees are non-refundable unless: (i) SGS LAND materially breaches service obligations and fails to remedy within 48 hours of notification; or (ii) applicable Vietnamese law mandates a refund.\n(d) Service interruption compensation: If service is interrupted due to SGS LAND's direct fault for more than 48 hours, we will extend your account by the equivalent interruption duration.\n(e) Late payment: Accounts with fees overdue by 14+ days may have premium features suspended. After 90 days overdue with no response, accounts may be terminated with 30 days final notice."
            },
            {
                heading: "8. Disclaimer & Limitation of Liability",
                content: "TO THE MAXIMUM EXTENT PERMITTED BY VIETNAMESE LAW:\n\n(a) PLATFORM PROVIDED 'AS IS': SGS LAND provides the Platform 'AS IS' and 'AS AVAILABLE'. We make NO warranties, express or implied, regarding: (i) merchantability; (ii) fitness for a particular purpose; (iii) non-infringement of third-party rights; (iv) accuracy, completeness or currency of Platform information; (v) uninterrupted or error-free operation.\n\n(b) EXCLUSION OF INDIRECT DAMAGES: SGS LAND is NOT liable for indirect, consequential, special, punitive or incidental damages, including lost profits, lost revenue, lost business opportunity, data loss, or reputational harm — even if SGS LAND was advised of the possibility of such damages.\n\n(c) AGGREGATE LIABILITY CAP: SGS LAND's total cumulative liability to you from any cause of action, whether in contract, tort or otherwise, is limited to: (i) Total fees actually paid by you to SGS LAND in the 12 months immediately preceding the claim; OR (ii) VND 1,000,000 (One million Vietnamese Dong); whichever is HIGHER.\n\n(d) FREE SERVICES: For free features and services, SGS LAND's total liability is capped at VND 1,000,000 (One million Vietnamese Dong).\n\n(e) MANDATORY EXCLUSIONS: This limitation does not exclude or limit liability for intentional fraud, deceit, death or personal injury caused by gross negligence, or any liability that cannot be excluded under mandatory provisions of Vietnamese law."
            },
            {
                heading: "9. Indemnification",
                content: "You agree to defend, fully indemnify, and hold harmless SGS Land Corp and its parent companies, subsidiaries, affiliates, officers, directors, employees, agents and licensors from and against all claims, liabilities, damages, judgments, losses, costs, expenses and reasonable legal fees arising from or related to:\n\n(a) Your use of the Platform in violation of these Terms or applicable law;\n(b) User Content you post that infringes third-party rights or violates law;\n(c) Your fraudulent, impersonating or illegal conduct;\n(d) Violation of any provision in Section 4 (Prohibited Conduct);\n(e) Third-party claims relating to false property information you posted.\n\nThis indemnification obligation does not apply to the extent damages arise directly from SGS LAND's own negligence or misconduct. SGS LAND has the right, at your expense, to assume exclusive control of any matter subject to indemnification."
            },
            {
                heading: "10. Force Majeure",
                content: "SGS LAND is not liable for any delay, interruption or failure to perform obligations under these Terms where the cause is wholly or mainly beyond our reasonable control, including but not limited to: natural disasters, earthquakes, floods, fires, storms; epidemics or pandemics declared by competent authorities; large-scale external cyberattacks or abnormal DDoS attacks; infrastructure provider failures (power, telecommunications, cloud) beyond SGS LAND's control; or government orders, administrative decisions, or new regulations.\n\nDuring force majeure, SGS LAND will: (i) notify users via available communication channels as soon as reasonably possible; (ii) use best efforts to minimise impact and restore service; (iii) provide free service extension equivalent to the affected period.\n\nForce majeure periods are excluded from any service level commitments (SLA)."
            },
            {
                heading: "11. Termination",
                content: "BY USER: You may terminate your account at any time via Account Settings or by contacting support@sgsland.vn. Upon deletion: (i) access is terminated immediately; (ii) account data is deleted within 30 days except legally mandated retention; (iii) fees paid for the current billing period are non-refundable.\n\nBY SGS LAND: We may suspend or permanently terminate your account, with or without notice, if: (i) you violate any provision of Section 4 (Prohibited Conduct); (ii) there is fraudulent or suspicious account activity; (iii) required by a competent authority; (iv) SGS LAND discontinues the service — in which case at least 30 days' notice and data export support will be provided.\n\nSURVIVING PROVISIONS: The following sections survive termination: Intellectual Property (Section 6), Limitation of Liability (Section 8), Indemnification (Section 9), and Governing Law & Dispute Resolution (Section 13)."
            },
            {
                heading: "12. General Provisions",
                content: "(a) Entire agreement: These Terms and the Privacy Policy constitute the entire agreement between you and SGS LAND regarding the Platform, superseding all prior agreements and communications.\n\n(b) No waiver: SGS LAND's failure to enforce any right or provision does not constitute waiver. Waivers are only effective in writing signed by an authorised SGS LAND representative.\n\n(c) Severability: If any provision is found invalid, unenforceable or unlawful by a court, it will be modified or removed to the minimum extent necessary, while remaining provisions continue in full force.\n\n(d) Non-assignment: You may not assign rights or obligations under these Terms without prior written consent from SGS LAND. SGS LAND may assign these Terms in connection with an acquisition, merger or material asset transfer without your consent.\n\n(e) Notices: All legal notices to SGS LAND must be in writing to: legal@sgsland.vn. Notices are deemed received 48 hours after email transmission.\n\n(f) Language: The Vietnamese version of these Terms and the Privacy Policy is the original legally binding text. In case of conflict between Vietnamese and English versions, the Vietnamese version prevails."
            },
            {
                heading: "13. Governing Law & Dispute Resolution",
                content: "(a) Governing law: These Terms are governed by, interpreted and enforced under the laws of the Socialist Republic of Vietnam, including: Civil Code 2015, Commercial Law 2005, Electronic Transactions Law 2023, and Consumer Protection Law 2023.\n\n(b) Mandatory good-faith negotiation: Before commencing any formal legal proceedings, the parties are obligated to attempt resolution through good-faith negotiation within 30 days from the date one party provides written notice of the dispute.\n\n(c) Mediation: If negotiation fails, the parties may submit the dispute to mediation under Vietnam's Law on Mediation and Dialogue at Court 2020 or rules of a designated commercial mediation centre.\n\n(d) Court jurisdiction: If mediation fails, all disputes shall be resolved by the competent People's Court in Ho Chi Minh City, Vietnam. You irrevocably consent to the exclusive jurisdiction of courts in Ho Chi Minh City and waive any objection to jurisdiction or venue in those courts.\n\n(e) No international arbitration: Unless otherwise agreed in a separate written instrument signed by both parties, all disputes are resolved in Vietnamese courts under Vietnamese civil procedure — not international arbitration."
            }
        ]
    }
};

// -----------------------------------------------------------------------------
//  LAYOUT COMPONENT
// -----------------------------------------------------------------------------

const LegalLayout: React.FC<{ title: string; children: React.ReactNode; lastUpdated: string }> = ({ title, children, lastUpdated }) => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
                    <button onClick={handleHome} className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors min-h-[44px] shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span className="hidden sm:inline">{t('legal.back_home')}</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                        <span className="font-bold text-base sm:text-lg hidden sm:inline truncate">{t('legal.header')}</span>
                    </div>
                    <button onClick={handleLogin} className="px-3 sm:px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-xs sm:text-sm min-h-[44px] shrink-0 whitespace-nowrap">
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 animate-enter">
                {/* Disclaimer banner */}
                <div className="mb-10 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4 text-sm text-amber-800 dark:text-amber-300">
                    <strong>Lưu ý pháp lý quan trọng:</strong> Tài liệu này được cung cấp nhằm mục đích thông tin. SGS LAND đã nỗ lực xây dựng nội dung tuân thủ pháp luật Việt Nam hiện hành. Tuy nhiên, đối với các giao dịch có giá trị lớn hoặc tranh chấp pháp lý phức tạp, chúng tôi khuyến nghị bạn tham vấn luật sư có chứng chỉ hành nghề.
                </div>

                <div className="text-center mb-16">
                    <h1 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-4 tracking-tight">{title}</h1>
                    <p className="text-[var(--text-tertiary)] font-mono text-sm uppercase tracking-widest">{t('legal.last_updated')}: {lastUpdated}</p>
                </div>

                <div className="bg-[var(--bg-surface)] p-8 md:p-16 rounded-[32px] border border-[var(--glass-border)] shadow-sm">
                    <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline prose-li:text-[var(--text-secondary)]">
                        {children}
                    </div>
                </div>

                {/* Cross-links footer */}
                <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-slate-500">
                    <button onClick={() => window.location.hash = `#/${ROUTES.PRIVACY}`} className="hover:text-indigo-600 transition-colors">{t('legal.privacy_title')}</button>
                    <span>·</span>
                    <button onClick={() => window.location.hash = `#/${ROUTES.TERMS}`} className="hover:text-indigo-600 transition-colors">{t('legal.terms_title')}</button>
                    <span>·</span>
                    <a href="mailto:legal@sgsland.vn" className="hover:text-indigo-600 transition-colors">legal@sgsland.vn</a>
                    <span>·</span>
                    <button onClick={handleHome} className="hover:text-indigo-600 transition-colors">{t('legal.back_home')}</button>
                </div>
                <div className="mt-4 text-center text-xs text-slate-400">
                    SGS Land Corp · MST: 0312960439 · TP. Hồ Chí Minh, Việt Nam
                </div>
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
//  PAGES
// -----------------------------------------------------------------------------

export const PrivacyPolicy: React.FC = () => {
    const { t, language } = useTranslation();
    const content = language === 'vn' ? LEGAL_CONTENT.vn.privacy : LEGAL_CONTENT.en.privacy;

    return (
        <LegalLayout title={t('legal.privacy_title')} lastUpdated="01/04/2025">
            {content.map((section, idx) => (
                <div key={idx} className="mb-8">
                    <h3>{section.heading}</h3>
                    {section.content.split('\n').map((paragraph, pIdx) => (
                        <p key={pIdx}>{paragraph}</p>
                    ))}
                </div>
            ))}
        </LegalLayout>
    );
};

export const TermsOfService: React.FC = () => {
    const { t, language } = useTranslation();
    const content = language === 'vn' ? LEGAL_CONTENT.vn.terms : LEGAL_CONTENT.en.terms;

    return (
        <LegalLayout title={t('legal.terms_title')} lastUpdated="01/04/2025">
            {content.map((section, idx) => (
                <div key={idx} className="mb-8">
                    <h3>{section.heading}</h3>
                    {section.content.split('\n').map((paragraph, pIdx) => (
                        <p key={pIdx}>{paragraph}</p>
                    ))}
                </div>
            ))}
        </LegalLayout>
    );
};

export const CookieSettings: React.FC = () => {
    const { t } = useTranslation();
    const [prefs, setPref] = useState({ essential: true, analytics: true, marketing: false });
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <LegalLayout title={t('legal.cookies_title')} lastUpdated="01/04/2025">
            <p className="lead">{t('legal.cookie_desc')}</p>
            
            <div className="my-8 space-y-4 not-prose">
                <div className="bg-[var(--glass-surface)] p-6 rounded-2xl border border-[var(--glass-border)] flex justify-between items-center opacity-70">
                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{t('legal.cookie_essential')}</h4>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('legal.cookie_essential_desc')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 font-bold">{t('common.enabled')}</span>
                        <svg className="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>

                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--glass-border)] flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{t('legal.cookie_analytics')}</h4>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('legal.cookie_analytics_desc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={prefs.analytics} onChange={e => setPref({...prefs, analytics: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-surface)] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--glass-border)] flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">{t('legal.cookie_marketing')}</h4>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('legal.cookie_marketing_desc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={prefs.marketing} onChange={e => setPref({...prefs, marketing: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-surface)] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>

            <button 
                onClick={handleSave} 
                className={`px-8 py-3 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 ${saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-indigo-600'}`}
            >
                {saved ? t('legal.saved_changes') : t('legal.save_pref')}
            </button>

            <div className="mt-12 pt-8 border-t border-[var(--glass-border)]">
                <h3 className="mb-4">{t('legal.cookie_about_title')}</h3>
                <p>{t('legal.cookie_about_desc')}</p>
            </div>
        </LegalLayout>
    );
};
