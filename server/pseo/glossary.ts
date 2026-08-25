// server/pseo/glossary.ts
// Programmatic SEO: Kho Kiến Thức Bất Động Sản (/kien-thuc-bds/:term)
//
// Playbook: Glossary — N definitional pages per real estate term.
// URL pattern: /kien-thuc-bds/[slug]  (hub: /kien-thuc-bds)
// Target queries: "[term] là gì?", "định nghĩa [term] BĐS", "giải thích [term]"
//
// Information gain (per playbook principle — each page must offer something
// the current top-10 results do NOT have):
//   - Vietnamese real estate legal citations (Luật Đất Đai 2024, Luật KD BĐS 2023)
//   - Practical nuances from 45,000+ SGS LAND transactions
//   - Specific calculation examples (phí bảo trì, thuế trước bạ, tỷ suất cho thuê)
//   - Legal risk warnings not found on generic real estate portals
//
// Start small (skill guideline): 4 terms, validate indexation/impressions, then scale.

import { injectMeta, getBaseHtml } from '../seo/metaInjector';

const APP = 'https://sgsland.vn';
const HUB = '/kien-thuc-bds';
const HUB_TITLE = 'Kiến Thức Bất Động Sản';
const DATE_MODIFIED = '2026-05-15';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface GlossaryEntry {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  keywords: string;
  directAnswer: string;
  keyFacts: string[];
  bodyParagraphs: string[];
  faq: Array<{ q: string; a: string }>;
  relatedSlugs: string[];
  datePublished: string;
}

// ---------------------------------------------------------------------------
// Term data — each entry has genuine information gain over the top-10 results
// ---------------------------------------------------------------------------

const GLOSSARY: Record<string, GlossaryEntry> = {
  'shr-la-gi': {
    slug: 'shr-la-gi',
    title: 'SHR Là Gì? Sở Hữu Riêng, Pháp Lý, Thủ Tục 2024 | SGS LAND',
    metaDescription:
      'SHR (Sở Hữu Riêng) là giấy chứng nhận quyền sử dụng đất cấp riêng từng căn hộ, không chia sẻ. Tìm hiểu điều kiện, thủ tục cấp SHR và khác biệt với sổ chung theo Luật Đất Đai 2024.',
    h1: 'SHR (Sở Hữu Riêng) là gì?',
    keywords: 'SHR là gì, sở hữu riêng là gì, sổ hồng riêng, sổ chung căn hộ, cấp SHR',
    directAnswer:
      'SHR (Sở Hữu Riêng) là tình trạng pháp lý khi chủ sở hữu được cấp Giấy Chứng Nhận (GCN) quyền sử dụng đất và quyền sở hữu tài sản gắn liền riêng lẻ — không chia sẻ với bất kỳ chủ thể nào khác. ' +
      'Đây là tiêu chuẩn pháp lý cao nhất trong giao dịch bất động sản Việt Nam, cho phép thế chấp, chuyển nhượng và thừa kế hoàn toàn độc lập (Luật Đất Đai 2024, Điều 29).',
    keyFacts: [
      'Căn hộ có SHR được thế chấp ngân hàng với LTV lên đến 70% giá trị căn; căn hộ sổ chung thường chỉ vay được 50% hoặc bị từ chối.',
      'Luật Đất Đai 2024 (hiệu lực 1/8/2024, Điều 77): chủ đầu tư có nghĩa vụ hoàn thiện hồ sơ cấp GCN cho người mua trong 50 ngày kể từ bàn giao.',
      'Thủ tục cấp SHR cho căn hộ chung cư tại TP.HCM mất từ 30–90 ngày làm việc (nguồn: Sở Tài Nguyên Môi Trường TP.HCM, 2025).',
      'Căn hộ chưa có SHR thường được định giá thấp hơn 5–15% so với căn có SHR cùng dự án, tùy mức độ pháp lý (nguồn: dữ liệu giao dịch SGS LAND 2025).',
      'Lệ phí cấp GCN tại TP.HCM: 100.000–500.000 VND; phí công chứng: 0,1% giá trị tài sản (tối đa 50 triệu VND).',
    ],
    bodyParagraphs: [
      'SHR không phải là một loại giấy tờ độc lập — đây là cách gọi thông thường để phân biệt căn hộ đã có Giấy Chứng Nhận riêng (mỗi chủ một sổ) với "sổ chung" (nhiều căn hộ cùng chia sẻ một GCN duy nhất do chủ đầu tư hoặc ban quản trị quản lý). Thuật ngữ chính thức trong Luật Đất Đai là "Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất".',
      'Một căn hộ "chưa có SHR" có thể rơi vào một trong các tình huống: (1) dự án chưa hoàn tất nghĩa vụ tài chính với Nhà Nước (chưa nộp tiền sử dụng đất, tiền thuê đất), (2) chủ đầu tư chưa hoàn thành hồ sơ pháp lý bàn giao sang cơ quan nhà nước, hoặc (3) toà nhà đang trong giai đoạn quyết toán. Trong trường hợp thứ nhất, ngân hàng sẽ từ chối cấp vay và giao dịch thứ cấp rất khó thực hiện.',
      'Khi mua căn hộ chưa có SHR, người mua cần yêu cầu chủ đầu tư cung cấp: Giấy phép xây dựng, Biên bản nghiệm thu đưa vào sử dụng, và cam kết cụ thể (kèm phạt hợp đồng) về thời hạn cấp sổ. Theo kinh nghiệm của SGS LAND từ hơn 45.000 giao dịch, các dự án không thể cấp sổ trong 3 năm sau bàn giao thường có vướng mắc nghiêm trọng về pháp lý quy hoạch.',
    ],
    faq: [
      {
        q: 'SHR và sổ hồng khác nhau như thế nào?',
        a: 'SHR là khái niệm không chính thức chỉ tình trạng sổ riêng lẻ (mỗi người một sổ). Sổ hồng (Giấy Chứng Nhận) là tên gọi chính thức của văn bản pháp lý theo Luật Đất Đai. Một căn hộ có SHR có nghĩa là đã được cấp sổ hồng riêng, phân biệt với sổ chung (nhiều căn cùng chia sẻ một GCN).',
      },
      {
        q: 'Căn hộ chưa có SHR có mua được không?',
        a: 'Có thể mua, nhưng cần kiểm tra: (1) dự án đủ điều kiện cấp sổ về quy hoạch, (2) chủ đầu tư có cam kết rõ ràng kèm điều khoản phạt hợp đồng, (3) giá mua phản ánh rủi ro pháp lý. Tuyệt đối không mua căn hộ tại dự án chưa hoàn tất nghĩa vụ tài chính với Nhà Nước.',
      },
      {
        q: 'Thủ tục cấp SHR cho căn hộ chung cư cần hồ sơ gì?',
        a: 'Hồ sơ gồm: Hợp đồng mua bán có công chứng, biên bản bàn giao căn hộ, CCCD chủ sở hữu, giấy tờ nghĩa vụ tài chính (đã nộp phí bảo trì 2%, không nợ phí quản lý), và đơn đề nghị cấp GCN. Nộp tại Phòng Đăng Ký Đất Đai cấp quận/huyện nơi có căn hộ.',
      },
      {
        q: 'Officetel và condotel có được cấp SHR không?',
        a: 'Officetel: được cấp GCN theo mục đích thương mại dịch vụ, thời hạn 50 năm gia hạn. Condotel: theo Thông tư 02/2023/TT-BXD được cấp GCN khi đủ điều kiện, nhưng thực tế nhiều dự án vẫn còn vướng mắc pháp lý chưa giải quyết. Cần xác minh từng dự án cụ thể.',
      },
      {
        q: 'Mua căn hộ sổ chung có được vay ngân hàng không?',
        a: 'Rất khó. Hầu hết ngân hàng yêu cầu GCN riêng (SHR) làm tài sản thế chấp. Một số ngân hàng chấp nhận hợp đồng mua bán công chứng làm tài sản thế chấp với LTV thấp hơn (30–50%), lãi suất cao hơn, và thường yêu cầu bảo lãnh bổ sung.',
      },
    ],
    relatedSlugs: ['so-do-so-hong-la-gi', 'phi-bao-tri-chung-cu-la-gi', 'the-chap-bat-dong-san-la-gi'],
    datePublished: '2025-01-10',
  },

  'so-do-so-hong-la-gi': {
    slug: 'so-do-so-hong-la-gi',
    title: 'Sổ Đỏ Sổ Hồng Là Gì? Khác Biệt, Giá Trị Pháp Lý 2024 | SGS LAND',
    metaDescription:
      'Sổ đỏ và sổ hồng đều là Giấy Chứng Nhận theo Luật Đất Đai 2013–2024. Tìm hiểu sự khác biệt thực sự, giá trị pháp lý bằng nhau, và khi nào cần quan tâm.',
    h1: 'Sổ Đỏ và Sổ Hồng là gì?',
    keywords: 'sổ đỏ là gì, sổ hồng là gì, giấy chứng nhận quyền sử dụng đất, GCN, sổ đỏ sổ hồng khác nhau',
    directAnswer:
      'Sổ đỏ và sổ hồng đều là tên gọi thông thường của Giấy Chứng Nhận (GCN) quyền sử dụng đất và quyền sở hữu tài sản. ' +
      'Từ năm 2009 (Nghị định 88/2009/NĐ-CP), Việt Nam thống nhất một loại GCN thay thế cho cả hai. ' +
      'Tên gọi dân gian vẫn tồn tại: "sổ đỏ" thường chỉ đất ở riêng lẻ/đất nông nghiệp (bìa đỏ); "sổ hồng" thường chỉ căn hộ chung cư (bìa đỏ/hồng). Giá trị pháp lý hoàn toàn tương đương.',
    keyFacts: [
      'Từ Nghị định 88/2009/NĐ-CP, Việt Nam thống nhất một loại GCN — không còn phân biệt chính thức giữa sổ đỏ và sổ hồng.',
      'Thông tư 23/2014/TT-BTNMT quy định mẫu GCN thống nhất trên toàn quốc — bìa màu đỏ cho mọi loại bất động sản.',
      'GCN căn hộ chung cư (vẫn gọi "sổ hồng") thể hiện mục đích sử dụng đất (ở/thương mại) và thời hạn sở hữu (lâu dài/50 năm gia hạn).',
      'GCN đất ở riêng lẻ (vẫn gọi "sổ đỏ") cấp cho hộ gia đình/cá nhân sử dụng đất ở, thời hạn sử dụng lâu dài.',
      'Sổ hồng chung cư officetel/condotel có thời hạn 50 năm gia hạn — khác với sổ hồng căn hộ ở có thời hạn lâu dài. Đây là điểm quan trọng khi đầu tư.',
    ],
    bodyParagraphs: [
      'Trước năm 2009, Việt Nam có ít nhất 3 loại giấy tờ: Giấy chứng nhận quyền sử dụng đất (sổ đỏ, Bộ TN&MT), Giấy chứng nhận quyền sở hữu nhà ở (sổ hồng, Bộ Xây Dựng), và Giấy chứng nhận quyền sở hữu công trình. Sự phân tách này tạo ra nhiều phức tạp pháp lý trong giao dịch bất động sản.',
      'Kể từ ngày 1/7/2014 (Luật Đất Đai 2013 có hiệu lực), tất cả bất động sản mới được cấp một loại GCN thống nhất do Bộ Tài Nguyên & Môi Trường ban hành. Tuy nhiên, các GCN cũ (sổ đỏ, sổ hồng) trước năm 2014 vẫn có giá trị pháp lý và KHÔNG cần đổi sang mẫu mới.',
      'Điều thực sự quan trọng khi mua BĐS không phải là màu bìa của GCN, mà là: (1) mục đích sử dụng đất ghi trong GCN (ở/thương mại/nông nghiệp), (2) thời hạn sử dụng (lâu dài hay có thời hạn), (3) tình trạng thế chấp (có đang thế chấp ngân hàng không), và (4) diện tích khớp với thực tế.',
    ],
    faq: [
      {
        q: 'Sổ đỏ và sổ hồng cái nào có giá trị pháp lý cao hơn?',
        a: 'Giá trị pháp lý hoàn toàn tương đương — cả hai đều là Giấy Chứng Nhận theo Luật Đất Đai. Không có loại nào "cao hơn" loại kia. Điều quan trọng hơn là nội dung GCN: mục đích sử dụng đất, thời hạn, và tình trạng thế chấp.',
      },
      {
        q: 'Có cần đổi sổ đỏ/sổ hồng cũ sang mẫu mới không?',
        a: 'Không bắt buộc. GCN cấp trước năm 2014 vẫn có giá trị pháp lý đầy đủ và không cần đổi sang mẫu mới. Chủ sở hữu chỉ cần đổi khi có nhu cầu giao dịch cụ thể (thế chấp lần đầu, chia thừa kế) hoặc khi thông tin cần cập nhật.',
      },
      {
        q: 'Nhà đất có sổ đỏ chung (nhiều người đứng tên) có bán được không?',
        a: 'Có thể bán, nhưng tất cả người đứng tên trong GCN phải đồng ý ký công chứng hợp đồng chuyển nhượng. Nếu một người không đồng ý, giao dịch không thể thực hiện. Trường hợp thừa kế, cần có biên bản phân chia di sản có công chứng trước.',
      },
      {
        q: 'Sổ hồng căn hộ chung cư có thể thế chấp vay ngân hàng không?',
        a: 'Có. Sổ hồng căn hộ chung cư được ngân hàng chấp nhận làm tài sản thế chấp với LTV thường 60–75% giá trị định giá. Điều kiện: GCN phải đứng tên cá nhân/hộ gia đình (không phải sổ chung chủ đầu tư), không đang trong tranh chấp, và căn hộ đã bàn giao thực tế.',
      },
    ],
    relatedSlugs: ['shr-la-gi', 'the-chap-bat-dong-san-la-gi', 'phi-truoc-ba-la-gi'],
    datePublished: '2025-01-15',
  },

  'officetel-la-gi': {
    slug: 'officetel-la-gi',
    title: 'Officetel Là Gì? Pháp Lý, Thời Hạn, Rủi Ro Đầu Tư 2024 | SGS LAND',
    metaDescription:
      'Officetel là loại hình BĐS lai ghép văn phòng-căn hộ với GCN thương mại 50 năm gia hạn. Tìm hiểu tình trạng pháp lý, hạn chế đăng ký hộ khẩu, và rủi ro đầu tư cụ thể.',
    h1: 'Officetel là gì?',
    keywords: 'officetel là gì, căn hộ officetel pháp lý, officetel có hộ khẩu không, officetel 50 năm',
    directAnswer:
      'Officetel là loại hình bất động sản lai ghép (office + hotel) — không gian đa năng có thể dùng làm văn phòng hoặc chỗ ở. ' +
      'Tại Việt Nam, officetel được xây dựng trên đất thương mại dịch vụ, được cấp GCN thời hạn 50 năm gia hạn (không phải sở hữu lâu dài như căn hộ ở). ' +
      'Không thể đăng ký thường trú (hộ khẩu) tại officetel theo quy định hiện hành.',
    keyFacts: [
      'Officetel xây trên đất thương mại dịch vụ: GCN thời hạn 50 năm gia hạn — KHÔNG phải sở hữu lâu dài như căn hộ dân cư.',
      'Không được đăng ký thường trú tại officetel (Luật Cư Trú 2020, Điều 19: chỉ cho phép đăng ký tại nhà ở hợp pháp).',
      'Thuế VAT mua officetel: 10% (cao hơn căn hộ ở 5%). Lệ phí trước bạ: 0,5% giá trị hợp đồng.',
      'Ngân hàng thường áp dụng LTV thấp hơn 10–15% so với căn hộ ở khi thế chấp officetel.',
      'Phí dịch vụ officetel thường cao hơn căn hộ ở: 50.000–80.000 VND/m²/tháng tại TP.HCM (T5/2026).',
      'Phân khúc officetel TP.HCM: tổng ~25.000 căn đã bàn giao đến năm 2026; tập trung tại Quận 1, Quận 7, Thủ Đức (nguồn: CBRE Vietnam Q1/2026).',
    ],
    bodyParagraphs: [
      'Officetel xuất hiện tại Việt Nam từ khoảng 2015–2016 và bùng nổ đến 2018–2019. Trong giai đoạn đó, nhiều chủ đầu tư bán officetel như "căn hộ ở có giá thấp hơn" mà không làm rõ hạn chế pháp lý. Điều này dẫn đến nhiều tranh chấp và làn sóng kiện tụng liên quan đến đăng ký hộ khẩu, thời hạn sở hữu, và quyền chuyển đổi mục đích.',
      'Về mặt đầu tư cho thuê, officetel có lợi thế linh hoạt: vừa có thể cho doanh nghiệp nhỏ thuê làm văn phòng (hợp đồng 1–2 năm), vừa cho cá nhân thuê làm chỗ ở ngắn hạn. Tuy nhiên, việc không có hộ khẩu giới hạn đối tượng thuê dài hạn và ảnh hưởng đến thanh khoản thứ cấp.',
      'Khi cân nhắc mua officetel để đầu tư, cần xác minh: (1) thời hạn còn lại của GCN (một số officetel đã bàn giao trước 2016 có thể chỉ còn 40+ năm thay vì 50 năm), (2) quy định về mục đích sử dụng trong nội quy toà nhà (một số không cho kinh doanh dịch vụ lưu trú ngắn hạn Airbnb), (3) kế hoạch tái gia hạn GCN sau 50 năm theo Luật Đất Đai 2024.',
    ],
    faq: [
      {
        q: 'Officetel có được đăng ký hộ khẩu không?',
        a: 'Không. Theo Luật Cư Trú 2020, chỉ được đăng ký thường trú tại nhà ở hợp pháp — officetel xây trên đất thương mại không được công nhận là nhà ở. Người mua officetel để ở cần có địa chỉ hộ khẩu khác để đăng ký con cái đi học, dịch vụ hành chính, v.v.',
      },
      {
        q: 'Officetel 50 năm có được gia hạn không?',
        a: 'Theo Luật Đất Đai 2024, tổ chức và cá nhân sử dụng đất thương mại dịch vụ được xem xét gia hạn khi hết hạn nếu có nhu cầu. Chưa có quy định cụ thể về thủ tục và chi phí gia hạn cho officetel. Đây là rủi ro pháp lý dài hạn cần cân nhắc.',
      },
      {
        q: 'Officetel có cho thuê Airbnb được không?',
        a: 'Phụ thuộc nội quy tòa nhà. Nhiều ban quản trị officetel cấm kinh doanh lưu trú ngắn hạn (Airbnb/homestay) vì ảnh hưởng đến an ninh và cộng đồng cư dân. Cần kiểm tra nội quy trước khi mua với mục đích cho thuê ngắn hạn.',
      },
      {
        q: 'Giá officetel so với căn hộ ở cùng diện tích thì thế nào?',
        a: 'Officetel thường rẻ hơn 15–25% so với căn hộ ở có diện tích tương đương trong cùng dự án hoặc khu vực. Tuy nhiên, chênh lệch giá phản ánh rủi ro pháp lý (không hộ khẩu, thời hạn 50 năm, phí dịch vụ cao hơn), không phải "ưu đãi" thực sự.',
      },
      {
        q: 'Officetel có thể chuyển thành căn hộ ở không?',
        a: 'Hiện không có cơ chế pháp lý cho phép chuyển đổi mục đích sử dụng từ thương mại dịch vụ (officetel) sang đất ở (căn hộ). Một số đề xuất chính sách đã được thảo luận nhưng chưa có quy định chính thức tính đến T5/2026.',
      },
    ],
    relatedSlugs: ['shr-la-gi', 'condotel-la-gi', 'ty-suat-cho-thue-bds-la-gi'],
    datePublished: '2025-02-01',
  },

  'ty-suat-cho-thue-bds-la-gi': {
    slug: 'ty-suat-cho-thue-bds-la-gi',
    title: 'Tỷ Suất Cho Thuê BĐS Là Gì? Cách Tính, Benchmark Việt Nam 2026 | SGS LAND',
    metaDescription:
      'Tỷ suất cho thuê (rental yield) là % thu nhập từ cho thuê so với giá mua. Hướng dẫn tính gross yield và net yield với benchmark thực tế TP.HCM, Hà Nội 2026.',
    h1: 'Tỷ suất cho thuê bất động sản là gì?',
    keywords: 'tỷ suất cho thuê là gì, rental yield, gross yield net yield, tỷ suất đầu tư BĐS, lợi nhuận cho thuê căn hộ',
    directAnswer:
      'Tỷ suất cho thuê (rental yield) là tỷ lệ phần trăm thu nhập từ cho thuê hàng năm so với giá mua bất động sản. ' +
      'Gross yield = (tiền thuê năm / giá mua) × 100%. Net yield trừ đi tất cả chi phí vận hành. ' +
      'Căn hộ TP.HCM năm 2026 có gross yield trung bình 4–6%/năm; biệt thự nghỉ dưỡng đạt 5–8% tùy vị trí (nguồn: Savills Vietnam Q1/2026).',
    keyFacts: [
      'Gross yield căn hộ TP.HCM (T1/2026): 4–6%/năm — Quận 1/2/3: 3,5–4,5%; TP. Thủ Đức: 4,5–6%; Bình Thạnh/Phú Nhuận: 4–5% (nguồn: Savills Vietnam Q1/2026).',
      'Gross yield căn hộ Hà Nội (T1/2026): 4–5,5%/năm — Cầu Giấy/Đống Đa: 4–5%; Hoàng Mai/Long Biên: 4,5–5,5% (nguồn: JLL Vietnam Q4/2025).',
      'Net yield sau chi phí (phí quản lý, bảo trì, thuế, trống phòng) thường thấp hơn gross yield 1–2% — căn hộ TP.HCM net yield thực tế 2,5–4,5%.',
      'Cap rate (tỷ suất vốn hóa) trong thị trường thương mại TP.HCM: văn phòng hạng A 6–7%, bán lẻ trung tâm 5–6%, kho/logistics 7–8% (nguồn: CBRE Vietnam 2026).',
      'Biệt thự cho thuê khu vực nghỉ dưỡng (Đà Nẵng, Phú Quốc): gross yield 6–9%/năm khi hoạt động tốt, nhưng biến động cao và chi phí vận hành lớn hơn căn hộ.',
    ],
    bodyParagraphs: [
      'Gross yield là chỉ số dễ tính và thường được dùng để so sánh nhanh: Gross Yield (%) = (Tiền thuê tháng × 12) / Giá mua × 100. Ví dụ: căn hộ 2PN tại Vinhomes Grand Park giá 4 tỷ VND, cho thuê 12 triệu VND/tháng → Gross Yield = (12 × 12) / 4.000 × 100 = 3,6%/năm. Đây là yield thấp vì chưa tính chi phí.',
      'Net yield phản ánh lợi nhuận thực tế hơn. Chi phí thường gặp: phí quản lý toà nhà (800.000–2.000.000 VND/tháng), phí bảo trì định kỳ (~1–2 triệu/năm), thuế thu nhập từ cho thuê (20% trên lợi nhuận hoặc 5% DT nếu dưới ngưỡng), và tỷ lệ trống phòng (trung bình 5–10%/năm). Cùng ví dụ trên: Net Yield thực tế ≈ 2,8–3,2%/năm.',
      'Để đánh giá một khoản đầu tư cho thuê tại Việt Nam, ngoài yield nên xem xét: (1) triển vọng tăng giá vốn (capital appreciation) 5–10 năm trong khu vực, (2) thanh khoản thứ cấp (dễ bán lại không), (3) rủi ro pháp lý (SHR, thời hạn sở hữu), và (4) chi phí tài chính nếu vay ngân hàng. Lãi suất vay BĐS TP.HCM năm 2026: 7–9%/năm thả nổi sau ân hạn — nghĩa là yield phải vượt lãi suất vay mới có lợi nhuận dương.',
    ],
    faq: [
      {
        q: 'Tỷ suất cho thuê bao nhiêu là tốt tại Việt Nam?',
        a: 'Gross yield từ 5%/năm trở lên được coi là khá tốt cho căn hộ TP.HCM. Net yield từ 3,5%/năm sau tất cả chi phí là đạt yêu cầu. So sánh với lãi suất tiết kiệm ngân hàng (5,5–6,5%/năm T5/2026), bất động sản cần có thêm tiềm năng tăng giá vốn để hấp dẫn về tổng lợi nhuận đầu tư.',
      },
      {
        q: 'Căn hộ cho thuê hay đất nền có yield cao hơn?',
        a: 'Căn hộ thường có yield cho thuê cao hơn (4–6%) vì tạo ra dòng tiền đều đặn. Đất nền và nhà phố thường có yield thấp hơn (1–3%) nhưng tiềm năng tăng giá vốn cao hơn, đặc biệt tại các khu vực đang phát triển hạ tầng.',
      },
      {
        q: 'Làm thế nào để tối ưu yield cho thuê căn hộ?',
        a: 'Các yếu tố tăng yield: chọn căn hộ gần metro/đại học/khu công nghệ cao (nhu cầu thuê cao), ưu tiên căn 1–2PN (thanh khoản cho thuê tốt nhất), furnish đầy đủ (tăng giá thuê 15–25%), hợp đồng dài hạn 1–2 năm (giảm chi phí trống phòng), và theo dõi giá thị trường hàng quý để điều chỉnh.',
      },
      {
        q: 'Thuế thu nhập từ cho thuê BĐS tính như thế nào?',
        a: 'Hai phương án: (1) nếu doanh thu cho thuê < 100 triệu VND/năm: miễn thuế thu nhập cá nhân; (2) nếu > 100 triệu: nộp thuế TNCN 5% trên tổng doanh thu + VAT 5% (áp dụng từ Luật Thuế TNCN sửa đổi 2024). Nhiều chủ cho thuê lựa chọn ký hợp đồng < 100 triệu/năm để tối ưu thuế.',
      },
      {
        q: 'Yield biệt thự du lịch (condotel) có thực sự đạt 10–12% như quảng cáo không?',
        a: 'Rất hiếm trong thực tế. Yield cam kết 8–12%/năm từ chủ đầu tư (guarantee return) thường chỉ duy trì 2–5 năm đầu bằng tiền từ đợt bán hàng mới, không từ dòng tiền vận hành thực. Sau giai đoạn cam kết, yield thực tế thường 3–5%, với rủi ro pháp lý cao hơn căn hộ ở.',
      },
    ],
    relatedSlugs: ['officetel-la-gi', 'the-chap-bat-dong-san-la-gi', 'phi-truoc-ba-la-gi'],
    datePublished: '2025-03-01',
  },
};

// ---------------------------------------------------------------------------
// HTML generators
// ---------------------------------------------------------------------------

function buildGlossaryBodyHtml(entry: GlossaryEntry): string {
  const lines: string[] = [];

  lines.push(
    `<p style="font-size:13px;color:#64748b;margin:0 0 16px;">` +
    `<a href="${esc(APP)}" style="color:#64748b;">SGS LAND</a> &rsaquo; ` +
    `<a href="${esc(APP + HUB)}" style="color:#64748b;">${esc(HUB_TITLE)}</a> &rsaquo; ` +
    `${esc(entry.h1)}</p>`
  );

  // Direct answer block (GEO: +33.9% citation visibility, answer-first structure)
  lines.push(`<h2 style="font-size:18px;font-weight:700;margin:0 0 8px;color:#0f172a;">${esc(entry.h1)}</h2>`);
  lines.push(
    `<p style="color:#1e293b;line-height:1.7;margin:0 0 16px;` +
    `background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:4px;">` +
    `${esc(entry.directAnswer)}</p>`
  );

  // Key facts with sources (GEO: statistics signal)
  if (entry.keyFacts.length) {
    lines.push(`<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#0f172a;">Điểm quan trọng cần biết</h2>`);
    lines.push('<ul style="margin:0;padding-left:20px;color:#475569;line-height:1.8;">');
    for (const f of entry.keyFacts) lines.push(`  <li>${esc(f)}</li>`);
    lines.push('</ul>');
  }

  // Body paragraphs (topical depth)
  for (const para of entry.bodyParagraphs) {
    lines.push(`<p style="color:#475569;line-height:1.7;margin:14px 0;">${esc(para)}</p>`);
  }

  // Full FAQ (self-contained Q&A pairs for AI extraction)
  if (entry.faq.length) {
    lines.push(`<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#0f172a;">Câu hỏi thường gặp về ${esc(entry.h1)}</h2>`);
    for (const { q, a } of entry.faq) {
      lines.push(`<h3 style="font-size:14px;color:#1e293b;margin:16px 0 4px;font-weight:600;">${esc(q)}</h3>`);
      lines.push(`<p style="color:#475569;margin:0 0 8px;line-height:1.65;">${esc(a)}</p>`);
    }
  }

  // Related terms (internal link graph — hub & spoke)
  const related = entry.relatedSlugs.map(s => GLOSSARY[s]).filter(Boolean);
  if (related.length) {
    lines.push(`<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#0f172a;">Khái niệm liên quan</h2>`);
    lines.push('<ul style="margin:0;padding-left:20px;color:#475569;line-height:1.8;">');
    for (const rel of related) {
      lines.push(
        `  <li><a href="${esc(APP + HUB + '/' + rel.slug)}" style="color:#22c55e;text-decoration:none;">` +
        `${esc(rel.h1)}</a></li>`
      );
    }
    lines.push('</ul>');
  }

  // Authority footer + E-E-A-T signals
  lines.push(`<h2 style="font-size:16px;font-weight:700;margin:24px 0 8px;color:#0f172a;">Tư vấn miễn phí với SGS LAND</h2>`);
  lines.push(
    `<p style="color:#475569;line-height:1.7;margin:0 0 12px;">` +
    `<strong>SGS LAND</strong> (sgsland.vn) là nền tảng bất động sản hàng đầu Việt Nam với 45.000+ giao dịch, ` +
    `mạng lưới 15.000+ môi giới được xác thực và đội ngũ chuyên gia pháp lý tư vấn miễn phí các vấn đề ` +
    `về sổ đỏ, SHR, thế chấp và định giá tài sản theo Luật Đất Đai 2024.</p>`
  );
  lines.push('<ul style="margin:0;padding-left:20px;color:#475569;line-height:1.8;">');
  lines.push(`  <li>Hotline: <a href="tel:+84379281445" style="color:#22c55e;">+84 379 281 445</a></li>`);
  lines.push(`  <li>Email: <a href="mailto:info@sgsland.vn" style="color:#22c55e;">info@sgsland.vn</a></li>`);
  lines.push(`  <li><a href="${esc(APP)}/ai-valuation" style="color:#22c55e;">Định giá AI miễn phí</a> — kết quả ±5% trong 30 giây</li>`);
  lines.push(`  <li><a href="${esc(APP + HUB)}" style="color:#22c55e;">${esc(HUB_TITLE)}</a> — ${Object.keys(GLOSSARY).length} khái niệm được giải thích</li>`);
  lines.push(`  <li><a href="${esc(APP)}/contact" style="color:#22c55e;">Đặt lịch tư vấn 1-1 miễn phí</a></li>`);
  lines.push('</ul>');

  return lines.join('\n');
}

function buildGlossarySchema(entry: GlossaryEntry): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: entry.title,
        description: entry.metaDescription,
        url: `${APP}${HUB}/${entry.slug}`,
        datePublished: entry.datePublished,
        dateModified: DATE_MODIFIED,
        author: { '@type': 'Organization', name: 'SGS LAND', url: APP },
        publisher: {
          '@type': 'Organization',
          name: 'SGS LAND',
          logo: { '@type': 'ImageObject', url: `${APP}/logo.png` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${APP}${HUB}/${entry.slug}` },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'SGS LAND', item: APP },
            { '@type': 'ListItem', position: 2, name: HUB_TITLE, item: `${APP}${HUB}` },
            { '@type': 'ListItem', position: 3, name: entry.h1 },
          ],
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: entry.faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  };
}

function buildGlossaryIndexBodyHtml(): string {
  const lines: string[] = [];
  const entries = Object.values(GLOSSARY);

  lines.push(
    `<p style="font-size:13px;color:#64748b;margin:0 0 16px;">` +
    `<a href="${esc(APP)}" style="color:#64748b;">SGS LAND</a> &rsaquo; ${esc(HUB_TITLE)}</p>`
  );

  lines.push(`<h2 style="font-size:18px;font-weight:700;margin:0 0 8px;color:#0f172a;">${esc(HUB_TITLE)} là gì?</h2>`);
  lines.push(
    `<p style="color:#1e293b;line-height:1.7;margin:0 0 16px;">` +
    `Kho kiến thức bất động sản SGS LAND giải thích ${entries.length} khái niệm, thuật ngữ pháp lý và tài chính quan trọng nhất ` +
    `trong giao dịch BĐS Việt Nam — từ SHR, sổ đỏ/sổ hồng, officetel đến tỷ suất cho thuê và thủ tục thế chấp. ` +
    `Tất cả được cập nhật theo Luật Đất Đai 2024 và Luật Kinh Doanh BĐS 2023.</p>`
  );

  lines.push(`<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#0f172a;">Danh sách khái niệm BĐS</h2>`);
  lines.push('<ul style="margin:0;padding-left:20px;line-height:1.9;">');
  for (const entry of entries) {
    lines.push(
      `  <li><a href="${esc(APP + HUB + '/' + entry.slug)}" style="color:#22c55e;font-weight:500;">${esc(entry.h1)}</a>` +
      ` — ${esc(entry.metaDescription.split('.')[0])}.</li>`
    );
  }
  lines.push('</ul>');

  lines.push(`<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#0f172a;">Tại sao cần hiểu thuật ngữ BĐS?</h2>`);
  lines.push(
    `<p style="color:#475569;line-height:1.7;">Sai lầm phổ biến nhất trong giao dịch bất động sản Việt Nam là không hiểu rõ thuật ngữ pháp lý. ` +
    `Căn hộ "chưa có SHR" ≠ "sắp có sổ". Officetel ≠ căn hộ ở. Gross yield ≠ lợi nhuận thực tế. ` +
    `Nắm vững các khái niệm này giúp tránh rủi ro và đàm phán hiệu quả hơn.</p>`
  );

  lines.push(`<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#0f172a;">Về SGS LAND</h2>`);
  lines.push(
    `<p style="color:#475569;line-height:1.7;">` +
    `<strong>SGS LAND</strong> (sgsland.vn) là nền tảng bất động sản hàng đầu Việt Nam. ` +
    `Tính đến T5/2026: 45.000+ giao dịch, 15.000+ môi giới được xác thực, định giá AI ±5%. ` +
    `Hotline: <a href="tel:+84379281445" style="color:#22c55e;">+84 379 281 445</a></p>`
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const GLOSSARY_SLUGS: string[] = Object.keys(GLOSSARY);

/**
 * Returns complete SSR HTML for a glossary term page.
 * Returns null for unknown slugs (caller should respond 404).
 * Cache: public, max-age=86400 (content rarely changes).
 */
export function getGlossaryTermHtml(slug: string): string | null {
  const entry = GLOSSARY[slug];
  if (!entry) return null;

  try {
    const bodyHtml = buildGlossaryBodyHtml(entry);
    const structuredData = buildGlossarySchema(entry);

    return injectMeta(getBaseHtml(), {
      title: entry.title,
      description: entry.metaDescription,
      h1: entry.h1,
      url: `${APP}${HUB}/${entry.slug}`,
      keywords: entry.keywords,
      structuredData,
      bodyHtml,
    });
  } catch {
    return null;
  }
}

/**
 * Returns complete SSR HTML for the glossary hub/index page.
 * Cache: public, max-age=3600.
 */
export function getGlossaryIndexHtml(): string | null {
  try {
    const bodyHtml = buildGlossaryIndexBodyHtml();
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${HUB_TITLE} | SGS LAND`,
      description: `Kho kiến thức bất động sản: ${GLOSSARY_SLUGS.length} khái niệm, thuật ngữ pháp lý BĐS Việt Nam theo Luật Đất Đai 2024.`,
      url: `${APP}${HUB}`,
      publisher: { '@type': 'Organization', name: 'SGS LAND', url: APP },
    };

    return injectMeta(getBaseHtml(), {
      title: `${HUB_TITLE} — Giải Thích Thuật Ngữ BĐS Việt Nam | SGS LAND`,
      description: `Kho kiến thức bất động sản SGS LAND: giải thích ${GLOSSARY_SLUGS.length} khái niệm pháp lý, tài chính BĐS quan trọng nhất. Cập nhật theo Luật Đất Đai 2024.`,
      h1: HUB_TITLE,
      url: `${APP}${HUB}`,
      keywords: 'kiến thức bất động sản, thuật ngữ BĐS, pháp lý nhà đất, SHR là gì, sổ đỏ sổ hồng',
      structuredData,
      bodyHtml,
    });
  } catch {
    return null;
  }
}
