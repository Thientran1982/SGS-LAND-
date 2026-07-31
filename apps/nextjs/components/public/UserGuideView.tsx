"use client";

import { useState } from "react";
import {
  Zap, LayoutDashboard, Users, Cpu, Building2, MessageSquare, FileText,
  Send, BarChart3, CheckSquare, BookOpen, Settings, Lightbulb, Info, Check,
} from "lucide-react";
import { useLang } from "@/components/shared/useLang";

/* Cap [vi, en] — mot nguon du lieu cho ca hai ngon ngu */
type L = [string, string];
type Pair = { t: L; d: L };

type Section = {
  id: string;
  label: L;
  badge?: L;
  color: string;
  intro: L;
  items?: Pair[];
  stepsTitle?: L;
  steps?: Pair[];
  chipsTitle?: L;
  chips?: L[];
  pairsTitle?: L;
  pairs?: Pair[];
  checklistTitle?: L;
  checklist?: L[];
  tip?: L;
  note?: L;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  quickstart: Zap, dashboard: LayoutDashboard, leads: Users, "ai-valuation": Cpu,
  inventory: Building2, inbox: MessageSquare, contracts: FileText, sequences: Send,
  reports: BarChart3, tasks: CheckSquare, knowledge: BookOpen, settings: Settings,
};

/* Mau nhan cho tung muc — dung bien the nhat cua palette de khong pha tong trang */
const HUE: Record<string, string> = {
  quickstart: "#0F9D6E", dashboard: "#2563EB", leads: "#7C3AED", "ai-valuation": "#0891B2",
  inventory: "#B45309", inbox: "#DB2777", contracts: "#EA580C", sequences: "#E11D48",
  reports: "#0D9488", tasks: "#4F46E5", knowledge: "#65A30D", settings: "#64748B",
};

const SECTIONS: Section[] = [
  {
    id: "quickstart",
    color: "quickstart",
    label: ["Bắt đầu nhanh", "Quick start"],
    badge: ["Mới dùng", "New users"],
    intro: [
      "Chào mừng bạn đến với SGS LAND — nền tảng CRM & quản lý bất động sản thế hệ mới tích hợp AI. Hướng dẫn này giúp bạn nắm vững toàn bộ tính năng trong thời gian ngắn nhất.",
      "Welcome to SGS LAND — a new-generation, AI-powered real estate CRM and management platform. This guide gets you across every feature in the shortest time possible.",
    ],
    stepsTitle: ["5 bước đầu tiên", "Your first 5 steps"],
    steps: [
      {
        t: ["Tạo tài khoản & xác minh email", "Create an account and verify your email"],
        d: [
          "Vào trang Đăng ký, điền họ tên, email công ty và mật khẩu. Kiểm tra hộp thư và nhấn đường link xác minh trong vòng 30 phút. Sau khi xác minh, tài khoản được kích hoạt ngay.",
          "Go to Sign up, enter your full name, work email and password. Check your inbox and click the verification link within 30 minutes. Your account is activated immediately after verification.",
        ],
      },
      {
        t: ["Hoàn thiện hồ sơ cá nhân", "Complete your profile"],
        d: [
          "Vào Hồ sơ → cập nhật ảnh đại diện, số điện thoại, chức vụ và chi nhánh làm việc. Thông tin đầy đủ giúp lead nhận diện môi giới nhanh hơn qua các kênh omnichannel.",
          "Go to Profile → add your photo, phone number, job title and branch. A complete profile helps leads recognise you faster across omnichannel conversations.",
        ],
      },
      {
        t: ["Nhập lead đầu tiên vào hệ thống", "Add your first lead"],
        d: [
          'Vào Quản lý Lead → nhấn "+ Thêm Lead" → điền tên, số điện thoại, nhu cầu và nguồn lead. Hệ thống AI tự động chấm điểm lead (0–100) dựa trên 12 tiêu chí.',
          'Go to Leads → click "+ Add Lead" → fill in name, phone, requirement and source. The AI scores the lead automatically (0–100) against 12 criteria.',
        ],
      },
      {
        t: ["Thêm bất động sản vào kho hàng", "Add a property to your inventory"],
        d: [
          'Vào Kho hàng → nhấn "+ Đăng BĐS" → chọn loại, nhập địa chỉ, diện tích, giá. Sử dụng tính năng Định giá AI để tham chiếu giá thị trường trước khi đăng.',
          'Go to Inventory → click "+ Add property" → choose a type, enter the address, area and price. Use AI Valuation to benchmark the market price before publishing.',
        ],
      },
      {
        t: ["Kết nối kênh Zalo / Facebook Messenger", "Connect Zalo / Facebook Messenger"],
        d: [
          "Vào Cài đặt → Kênh liên lạc → kết nối Zalo OA hoặc Facebook Page. Sau đó toàn bộ tin nhắn từ khách hàng sẽ tập trung vào Hộp thư đa kênh.",
          "Go to Settings → Channels → connect your Zalo OA or Facebook Page. From then on every customer message lands in the omnichannel Inbox.",
        ],
      },
    ],
    chipsTitle: ["Điều hướng nhanh sau khi thiết lập", "Quick links once you are set up"],
    chips: [
      ["Dashboard", "Dashboard"], ["Quản lý Lead", "Leads"], ["Định giá AI", "AI Valuation"],
      ["Kho hàng", "Inventory"], ["Hộp thư", "Inbox"], ["Báo cáo", "Reports"],
    ],
    tip: [
      "Hoàn thành 5 bước trên trong vòng 15 phút — sau đó hệ thống AI sẽ bắt đầu gợi ý hành động dựa trên dữ liệu thực của bạn.",
      "Finish these 5 steps in about 15 minutes — the AI then starts suggesting next actions based on your real data.",
    ],
  },
  {
    id: "dashboard",
    color: "dashboard",
    label: ["Tổng quan Dashboard", "Dashboard overview"],
    intro: [
      "Dashboard là màn hình trung tâm, hiển thị toàn bộ chỉ số kinh doanh theo thời gian thực. Mọi thay đổi từ lead, hợp đồng, inbox đều phản ánh ngay lập tức qua WebSocket.",
      "The dashboard is your command centre, showing every business metric in real time. Changes to leads, contracts and inbox are reflected instantly over WebSocket.",
    ],
    items: [
      {
        t: ["KPI tổng quan", "Headline KPIs"],
        d: ["Tổng lead, lead mới hôm nay, tỷ lệ chuyển đổi, doanh số tháng, hoa hồng dự kiến — cập nhật real-time.",
            "Total leads, new leads today, conversion rate, monthly revenue and projected commission — updated in real time."],
      },
      {
        t: ["Pipeline funnel", "Pipeline funnel"],
        d: ["Biểu đồ pipeline theo 6 giai đoạn: Mới → Liên hệ → Tư vấn → Xem nhà → Đàm phán → Chốt. Kéo thả trực tiếp.",
            "A 6-stage pipeline chart: New → Contacted → Consulting → Viewing → Negotiating → Closed. Drag and drop directly."],
      },
      {
        t: ["Hoạt động hôm nay", "Today's activity"],
        d: ["Danh sách cuộc hẹn, follow-up đến hạn, lead chưa phản hồi quá 24 giờ — cảnh báo ưu tiên cao.",
            "Appointments, follow-ups due, and leads unanswered for more than 24 hours — flagged as high priority."],
      },
      {
        t: ["Gợi ý AI", "AI suggestions"],
        d: ['AI phân tích điểm lead và đề xuất hành động tiếp theo: "Gọi điện cho Nguyễn Văn A", "Gửi báo giá cho Trần Thị B".',
            'The AI reads lead scores and proposes the next action: "Call Nguyen Van A", "Send a quote to Tran Thi B".'],
      },
      {
        t: ["Tin tức thị trường", "Market news"],
        d: ["Tin tức BĐS mới nhất từ các nguồn uy tín (CafeF, BatDongSan.com.vn), lọc theo khu vực bạn theo dõi.",
            "The latest property news from trusted sources (CafeF, BatDongSan.com.vn), filtered to the areas you follow."],
      },
      {
        t: ["Bảng xếp hạng nhóm", "Team leaderboard"],
        d: ["So sánh hiệu suất theo team, chi nhánh — hiển thị ai đang dẫn đầu trong tuần/tháng.",
            "Compare performance by team and branch — see who is leading this week or month."],
      },
    ],
    note: [
      "Dashboard hiển thị dữ liệu tương ứng với quyền truy cập. Admin thấy toàn công ty; nhân viên chỉ thấy dữ liệu của mình và team.",
      "The dashboard respects your permissions. Admins see the whole company; agents see only their own and their team's data.",
    ],
  },
  {
    id: "leads",
    color: "leads",
    label: ["Quản lý Lead & CRM", "Leads & CRM pipeline"],
    badge: ["Tính năng cốt lõi", "Core feature"],
    intro: [
      "Module Lead là trái tim của SGS LAND CRM — nơi quản lý toàn bộ vòng đời khách hàng từ khi tiếp nhận đến khi chốt hợp đồng.",
      "The Leads module is the heart of the SGS LAND CRM — it manages the full customer lifecycle from first contact to signed contract.",
    ],
    chipsTitle: ["Pipeline 6 giai đoạn", "The 6-stage pipeline"],
    chips: [
      ["Mới", "New"], ["Liên hệ", "Contacted"], ["Tư vấn", "Consulting"],
      ["Xem nhà", "Viewing"], ["Đàm phán", "Negotiating"], ["Đã chốt", "Closed"],
    ],
    items: [
      {
        t: ["Chấm điểm AI (Lead Scoring)", "AI lead scoring"],
        d: ["12 tiêu chí: hành vi, ngân sách, khu vực mong muốn, thời gian phản hồi… AI chấm 0–100 điểm, tự động xếp loại Hot/Warm/Cold.",
            "12 criteria: behaviour, budget, preferred area, response time and more. The AI scores 0–100 and classifies each lead Hot/Warm/Cold."],
      },
      {
        t: ["Tự động phân công", "Auto-assignment"],
        d: ["Cài Routing Rules → lead mới tự động phân về đúng nhân viên theo khu vực, loại BĐS, ngân sách, vòng xoay công bằng.",
            "Set routing rules → new leads are routed to the right agent by area, property type and budget, with fair round-robin."],
      },
      {
        t: ["Lịch sử tương tác đầy đủ", "Full interaction history"],
        d: ["Mọi cuộc gọi, tin nhắn Zalo, email, comment đều ghi lại vào timeline lead. Không bỏ sót bất kỳ thông tin nào.",
            "Every call, Zalo message, email and comment is written to the lead timeline. Nothing gets lost."],
      },
      {
        t: ["Tag & lọc nâng cao", "Tags and advanced filters"],
        d: ["Gắn tag tùy chỉnh, lọc theo 20+ tiêu chí: nguồn lead, khu vực, ngân sách, điểm AI, ngày tạo, nhân viên phụ trách.",
            "Custom tags plus filtering on 20+ criteria: source, area, budget, AI score, created date and owner."],
      },
      {
        t: ["Đính kèm tài liệu", "Document attachments"],
        d: ["Upload CCCD, sao kê ngân hàng, yêu cầu khách hàng trực tiếp vào hồ sơ lead. Mã hóa AES-256.",
            "Upload ID cards, bank statements and customer requirements straight onto the lead record. AES-256 encrypted."],
      },
      {
        t: ["Báo cáo lead chi tiết", "Detailed lead reporting"],
        d: ["Tỷ lệ chuyển đổi theo từng giai đoạn, nguồn lead hiệu quả nhất, thời gian trung bình chốt deal.",
            "Stage-by-stage conversion rates, best performing sources, and average time to close."],
      },
    ],
    stepsTitle: ["Thêm lead mới", "Adding a new lead"],
    steps: [
      {
        t: ['Nhấn "+ Thêm Lead"', 'Click "+ Add Lead"'],
        d: ["Góc phải trên trang Lead. Hoặc nhập nhanh từ Hộp thư khi nhận tin nhắn mới từ khách.",
            "Top right of the Leads page — or capture one straight from the Inbox when a new message arrives."],
      },
      {
        t: ["Điền thông tin cơ bản", "Fill in the basics"],
        d: ["Họ tên (bắt buộc), số điện thoại, email, nguồn (Zalo/Facebook/Giới thiệu/Sàn giao dịch…).",
            "Full name (required), phone, email and source (Zalo/Facebook/referral/marketplace…)."],
      },
      {
        t: ["Khai báo nhu cầu", "Capture the requirement"],
        d: ["Loại BĐS muốn mua/thuê, khu vực ưu tiên, ngân sách, thời gian cần BĐS.",
            "Property type wanted, preferred area, budget and timeline."],
      },
      {
        t: ["Hệ thống tự động chấm điểm", "The system scores it"],
        d: ["AI phân tích và trả điểm trong 2–5 giây. Bạn có thể điều chỉnh thủ công nếu cần.",
            "The AI returns a score in 2–5 seconds. You can override it manually if needed."],
      },
    ],
    tip: [
      "Lead có điểm từ 70 trở lên được đánh dấu Hot — ưu tiên liên hệ trong 2 giờ đầu để tối đa tỷ lệ chuyển đổi.",
      "Leads scoring 70 or above are marked Hot — call them within the first 2 hours to maximise conversion.",
    ],
  },
  {
    id: "ai-valuation",
    color: "ai-valuation",
    label: ["Định giá AI (AVM)", "AI valuation (AVM)"],
    badge: ["Sai số ±5–12%", "±5–12% error"],
    intro: [
      "Công cụ định giá bất động sản bằng AI tích hợp Google Gemini + 7 hệ số AVM chuyên ngành. Độ chính xác tỷ lệ thuận với lượng thông tin cung cấp.",
      "An AI valuation tool combining Google Gemini with 7 industry AVM coefficients. Accuracy rises with the amount of detail you provide.",
    ],
    stepsTitle: ["3 bước định giá", "Valuation in 3 steps"],
    steps: [
      {
        t: ["Bước 1 — Nhập địa chỉ", "Step 1 — Enter the address"],
        d: ["Nhập đầy đủ: số nhà + tên đường + phường/xã + quận/huyện + tỉnh/thành phố. Địa chỉ càng chi tiết, AI phân tích càng chính xác.",
            "Give the full address: house number, street, ward, district and province. The more precise the address, the sharper the analysis."],
      },
      {
        t: ["Bước 2 — Nhập thông số BĐS", "Step 2 — Enter the property details"],
        d: ["Diện tích (m²), loại BĐS (căn hộ/nhà phố/biệt thự/đất nền/kho xưởng), số tầng, hướng, mặt tiền, pháp lý (Sổ Hồng/Sổ Đỏ), nội thất, năm xây dựng.",
            "Area (m²), type (apartment/townhouse/villa/land/warehouse), floors, orientation, frontage, legal status (pink/red book), furnishing and year built."],
      },
      {
        t: ["Bước 3 — Xem kết quả định giá", "Step 3 — Read the valuation"],
        d: ["AI trả về: giá ước tính trung vị, khoảng dao động (thấp–cao), giá/m², hệ số điều chỉnh, phân tích vị trí, nguồn dữ liệu tham chiếu.",
            "The AI returns a median estimate, a low–high range, price per m², the adjustment coefficients, a location analysis and its reference data."],
      },
    ],
    pairsTitle: ["7 hệ số AVM điều chỉnh", "The 7 AVM adjustment coefficients"],
    pairs: [
      { t: ["Ksl — Hệ số vị trí đường", "Ksl — Street position"], d: ["Đường lớn/nhỏ, mặt tiền, hẻm", "Main road vs side street, frontage, alley"] },
      { t: ["Kdir — Hướng phong thủy", "Kdir — Orientation"], d: ["Đông Nam, Nam, Bắc...", "South-east, south, north…"] },
      { t: ["Kmf — Mặt tiền", "Kmf — Frontage"], d: ["Chiều rộng mặt tiền thực tế", "Actual frontage width"] },
      { t: ["Klegal — Pháp lý", "Klegal — Legal status"], d: ["Sổ Hồng > Hợp đồng > Chờ", "Pink book > contract > pending"] },
      { t: ["Kfurn — Nội thất", "Kfurn — Furnishing"], d: ["Cao cấp > Đầy đủ > Cơ bản", "Premium > full > basic"] },
      { t: ["Kfloor — Tầng (căn hộ)", "Kfloor — Floor (apartments)"], d: ["Tầng trung/cao > tầng thấp", "Mid/high floors > low floors"] },
      { t: ["Kage — Tuổi công trình", "Kage — Building age"], d: ["Mới xây > cũ nhiều năm", "Newly built > older stock"] },
    ],
    tip: [
      "Khách hàng chưa đăng nhập được 1 lượt định giá miễn phí/ngày. Đăng ký tài khoản để định giá không giới hạn và lưu lịch sử.",
      "Signed-out visitors get 1 free valuation per day. Create an account for unlimited valuations and saved history.",
    ],
    note: [
      "Kết quả AVM là tham chiếu — không thay thế thẩm định pháp lý chính thức từ tổ chức thẩm định giá có chứng chỉ.",
      "An AVM result is a reference only — it does not replace a formal appraisal by a licensed valuation firm.",
    ],
  },
  {
    id: "inventory",
    color: "inventory",
    label: ["Kho hàng BĐS", "Property inventory"],
    intro: [
      "Quản lý toàn bộ danh mục BĐS của môi giới và công ty — từ nhà phố, căn hộ đến đất nền, kho xưởng. Đồng bộ tự động lên trang Marketplace công khai.",
      "Manage the whole portfolio — townhouses, apartments, land and warehouses — and sync it automatically to the public marketplace.",
    ],
    items: [
      { t: ["Đa loại BĐS", "Every property type"], d: ["Căn hộ, nhà phố, biệt thự, đất nền, kho xưởng, shophouse, penthouse, nhà phố thương mại.", "Apartments, townhouses, villas, land, warehouses, shophouses, penthouses and commercial units."] },
      { t: ["Quản lý ảnh & media", "Photos and media"], d: ["Upload tối đa 50 ảnh/BĐS, video tour 360°, sắp xếp thứ tự ảnh, watermark thương hiệu tự động.", "Up to 50 photos per listing, 360° video tours, drag-to-reorder and automatic brand watermarking."] },
      { t: ["Tìm kiếm & lọc", "Search and filter"], d: ["Lọc theo loại, khu vực, giá, diện tích, tình trạng (đang bán/cho thuê/đã giao), nhân viên phụ trách.", "Filter by type, area, price, size, status (for sale/for rent/handed over) and owning agent."] },
      { t: ["Gợi ý khớp lead", "Lead matching"], d: ["AI tự động gợi ý BĐS phù hợp với từng lead dựa trên tiêu chí tìm kiếm, ngân sách và khu vực ưu tiên.", "The AI suggests listings that fit each lead's criteria, budget and preferred area."] },
      { t: ["Thống kê lượt xem", "View analytics"], d: ["Theo dõi lượt xem từng BĐS trên Marketplace, số lần yêu thích, số lần yêu cầu xem nhà.", "Track marketplace views, saves and viewing requests for each listing."] },
      { t: ["Chia sẻ nhanh", "One-click sharing"], d: ["Tạo link chia sẻ BĐS cá nhân hóa (kèm logo môi giới), đăng thẳng lên Zalo, Facebook chỉ 1 click.", "Generate a personalised share link with your agent branding and post it to Zalo or Facebook in one click."] },
    ],
    chipsTitle: ["Trạng thái BĐS", "Listing statuses"],
    chips: [
      ["Đang bán", "For sale"], ["Đang cho thuê", "For rent"], ["Chờ duyệt", "Pending review"],
      ["Đã bán", "Sold"], ["Tạm dừng", "Paused"],
    ],
  },
  {
    id: "inbox",
    color: "inbox",
    label: ["Hộp thư đa kênh", "Omnichannel inbox"],
    badge: ["Zalo · Facebook · Email", "Zalo · Facebook · Email"],
    intro: [
      "Tập trung tất cả tin nhắn từ Zalo OA, Facebook Messenger, và email vào một hộp thư duy nhất. Không bỏ sót khách hàng dù đến từ kênh nào.",
      "Bring every message from Zalo OA, Facebook Messenger and email into a single inbox, so no customer slips through whatever channel they use.",
    ],
    items: [
      { t: ["Hợp nhất 3 kênh", "Three channels, one view"], d: ["Zalo OA, Facebook Messenger, Email — tất cả hiển thị trong cùng 1 giao diện. Trả lời đúng kênh chỉ bằng 1 cửa sổ.", "Zalo OA, Facebook Messenger and email in one interface — reply on the right channel from a single window."] },
      { t: ["Trả lời nhanh AI", "AI quick replies"], d: ["AI gợi ý câu trả lời phù hợp dựa trên lịch sử chat, thông tin BĐS liên quan và kịch bản sales đã cài.", "The AI drafts replies from the chat history, the related listing and your configured sales scripts."] },
      { t: ["Gắn vào lead tự động", "Automatic lead matching"], d: ["Tin nhắn từ số điện thoại/email đã có trong hệ thống tự động gắn vào hồ sơ lead tương ứng.", "Messages from a known phone number or email attach themselves to the matching lead record."] },
      { t: ["Template tin nhắn", "Message templates"], d: ["Tạo sẵn kho template (giới thiệu BĐS, lịch xem nhà, xác nhận đặt cọc…) — chèn vào chat 1 click.", "Keep a library of templates (listing intro, viewing schedule, deposit confirmation) and insert them in one click."] },
      { t: ["Thông báo real-time", "Real-time notifications"], d: ["Nhận thông báo trình duyệt ngay khi có tin nhắn mới. Hiển thị badge đếm tin chưa đọc trên icon inbox.", "Browser notifications the moment a message arrives, plus an unread badge on the inbox icon."] },
      { t: ["Phân loại & ưu tiên", "Labels and priority"], d: ["Gắn nhãn (Nóng/Cần theo dõi/Chờ tài liệu), lọc theo kênh, nhân viên, trạng thái xử lý.", "Label conversations (hot/follow-up/awaiting documents) and filter by channel, agent or status."] },
    ],
    stepsTitle: ["Kết nối kênh", "Connecting a channel"],
    steps: [
      { t: ["Kết nối Zalo OA", "Connect Zalo OA"], d: ["Vào Cài đặt → Kênh liên lạc → Zalo → Nhập Zalo OA ID và Access Token. Yêu cầu tài khoản Zalo Official Account đã được duyệt.", "Settings → Channels → Zalo → enter your Zalo OA ID and access token. An approved Zalo Official Account is required."] },
      { t: ["Kết nối Facebook Page", "Connect a Facebook Page"], d: ["Vào Cài đặt → Kênh liên lạc → Facebook → Đăng nhập Facebook Business và cấp quyền cho SGS LAND App.", "Settings → Channels → Facebook → sign in with Facebook Business and grant the SGS LAND app permission."] },
      { t: ["Cài webhook", "Set the webhook"], d: ["Hệ thống tự động tạo webhook URL. Copy và dán vào cấu hình Zalo/Facebook Developer để bắt đầu nhận tin nhắn.", "The system generates a webhook URL — paste it into the Zalo/Facebook developer console to start receiving messages."] },
    ],
  },
  {
    id: "contracts",
    color: "contracts",
    label: ["Hợp đồng & Đề xuất", "Contracts and proposals"],
    intro: [
      "Tạo, gửi và theo dõi hợp đồng môi giới, đề xuất tài chính và phiếu đặt cọc. Tất cả có link chia sẻ công khai cho khách hàng ký điện tử.",
      "Create, send and track brokerage contracts, financial proposals and deposit slips — each with a public link for the client to sign electronically.",
    ],
    items: [
      { t: ["Hợp đồng môi giới", "Brokerage contracts"], d: ["Tạo hợp đồng từ template, điền thông tin BĐS và khách hàng tự động, xuất PDF chuyên nghiệp.", "Generate from a template with listing and client details filled in automatically, then export a polished PDF."] },
      { t: ["Đề xuất tài chính", "Financial proposals"], d: ["Trình bày phương án thanh toán, lịch trả góp ngân hàng, hoa hồng môi giới — dạng tài liệu đẹp gửi cho khách.", "Lay out payment options, bank instalment schedules and brokerage fees in a well-designed document for the client."] },
      { t: ["Link chia sẻ công khai", "Public share link"], d: ["Mỗi hợp đồng/đề xuất có URL riêng, khách hàng xem qua trình duyệt, không cần tài khoản.", "Every contract and proposal has its own URL that clients open in a browser — no account needed."] },
      { t: ["Luồng phê duyệt", "Approval workflow"], d: ["Hợp đồng cần qua duyệt cấp trên trước khi gửi khách. Theo dõi trạng thái: Nháp → Chờ duyệt → Đã duyệt → Đã gửi.", "Contracts route through a manager before they reach the client: Draft → Pending → Approved → Sent."] },
      { t: ["Theo dõi trạng thái", "Engagement tracking"], d: ["Biết khách đã mở link, đã đọc trang nào, đã ký hay chưa — thông báo ngay khi có hành động.", "See when the client opened the link, which pages they read and whether they signed — with instant notifications."] },
      { t: ["Lưu trữ & tìm kiếm", "Archive and search"], d: ["Toàn bộ hợp đồng lưu trên hệ thống, tìm kiếm theo tên khách/BĐS/ngày ký, xuất báo cáo Excel.", "Every contract is stored and searchable by client, property or signing date, with Excel export."] },
    ],
    note: [
      "Hoa hồng môi giới mặc định 2% giá trị BĐS — có thể điều chỉnh trong Cài đặt → Hoa hồng theo từng loại giao dịch.",
      "The default brokerage fee is 2% of the property value — adjust it per transaction type under Settings → Commission.",
    ],
  },
  {
    id: "sequences",
    color: "sequences",
    label: ["Chiến dịch tự động", "Automated sequences"],
    badge: ["Email · Zalo · Nhắc việc", "Email · Zalo · Tasks"],
    intro: [
      "Tự động hóa quy trình chăm sóc khách hàng — gửi email, tin Zalo, và tạo nhắc việc theo lịch trình định sẵn mà không cần thao tác thủ công.",
      "Automate nurturing — send emails and Zalo messages and create reminders on a predefined schedule, with no manual work.",
    ],
    items: [
      { t: ["Email tự động", "Automated email"], d: ["Gửi email chào mừng, giới thiệu BĐS mới, nhắc xem nhà, chúc mừng sinh nhật — theo trigger hoặc lịch trình.", "Welcome emails, new listing alerts, viewing reminders and birthday wishes — by trigger or schedule."] },
      { t: ["Tin Zalo OA tự động", "Automated Zalo OA messages"], d: ["Gửi tin Zalo theo template ZNS (Zalo Notification Service) khi lead đổi trạng thái, hợp đồng sắp hết hạn.", "Send ZNS template messages when a lead changes stage or a contract nears expiry."] },
      { t: ["Tạo nhắc việc tự động", "Automatic task creation"], d: ['Tự tạo task "Gọi điện sau 3 ngày", "Gửi báo giá sau 1 tuần" cho nhân viên phụ trách lead.', 'Create tasks such as "Call in 3 days" or "Send a quote in a week" for the lead owner.'] },
      { t: ["Trigger đa điều kiện", "Multi-condition triggers"], d: ["Kích hoạt khi lead được tạo, khi lead đổi giai đoạn, khi BĐS mới phù hợp nhu cầu, khi không phản hồi sau X ngày.", "Fire when a lead is created, changes stage, matches a new listing, or goes quiet for X days."] },
      { t: ["Báo cáo hiệu quả", "Campaign reporting"], d: ["Tỷ lệ mở email, tỷ lệ click, số lead phản hồi sau campaign — so sánh giữa các sequence.", "Open rates, click rates and replies per campaign — compared across sequences."] },
      { t: ["Tạm dừng thông minh", "Smart pausing"], d: ["Tự động dừng sequence khi khách đã phản hồi, tránh spam. Khởi động lại khi khách im lặng trở lại.", "Sequences pause themselves once the customer replies, and resume if they go quiet again."] },
    ],
    stepsTitle: ["Tạo sequence đầu tiên", "Building your first sequence"],
    steps: [
      { t: ['Vào Sequences → "+ Tạo sequence mới"', 'Sequences → "+ New sequence"'], d: ["Đặt tên, chọn mục tiêu (Nuture lead mới / Tái kích hoạt lead nguội / Giới thiệu BĐS mới).", "Name it and pick a goal: nurture new leads, re-activate cold leads, or promote new listings."] },
      { t: ["Cài trigger kích hoạt", "Set the trigger"], d: ['Chọn điều kiện để sequence chạy: "Lead mới được tạo" / "Lead đổi sang giai đoạn Tư vấn"...', 'Choose what starts it: "lead created", "lead moved to Consulting", and so on.'] },
      { t: ["Thêm các bước (Steps)", "Add the steps"], d: ["Thêm email, tin Zalo, hoặc nhắc việc. Đặt khoảng thời gian giữa các bước (Ngay lập tức / Sau 1 ngày / Sau 3 ngày...).", "Add emails, Zalo messages or tasks and set the delay between them (immediately / after 1 day / after 3 days…)."] },
      { t: ["Kích hoạt sequence", "Activate"], d: ['Nhấn "Kích hoạt" — sequence sẽ tự động chạy với mọi lead thỏa điều kiện trigger từ thời điểm đó.', 'Hit "Activate" — from then on it runs for every lead that meets the trigger.'] },
    ],
  },
  {
    id: "reports",
    color: "reports",
    label: ["Báo cáo & Phân tích", "Reports and analytics"],
    intro: [
      "Bộ báo cáo toàn diện giúp nhà quản lý ra quyết định dựa trên dữ liệu thực — không phụ thuộc vào báo cáo thủ công từ nhân viên.",
      "A complete reporting suite so managers decide on real data instead of hand-written updates from the team.",
    ],
    items: [
      { t: ["Báo cáo doanh số", "Revenue reports"], d: ["Doanh số theo ngày/tuần/tháng/quý, so sánh kỳ trước, biểu đồ xu hướng, breakdown theo nhân viên và chi nhánh.", "Daily, weekly, monthly and quarterly revenue with period comparisons, trend charts and breakdowns by agent and branch."] },
      { t: ["Báo cáo lead & conversion", "Lead and conversion reports"], d: ["Tổng lead vào, tỷ lệ chuyển đổi từng giai đoạn pipeline, nguồn lead hiệu quả nhất, thời gian trung bình từ lead đến chốt.", "Inbound volume, stage-by-stage conversion, best sources and average lead-to-close time."] },
      { t: ["Hiệu suất nhân viên", "Agent performance"], d: ["So sánh số lead, số cuộc hẹn, số chốt, hoa hồng giữa các nhân viên — bảng xếp hạng realtime.", "Compare leads, appointments, closes and commission across agents on a real-time leaderboard."] },
      { t: ["Báo cáo kho hàng", "Inventory reports"], d: ["BĐS bán nhanh nhất, BĐS tồn kho lâu nhất, phân tích theo loại BĐS, khu vực, phân khúc giá.", "Fastest sellers, longest-held stock, and analysis by type, area and price band."] },
      { t: ["Báo cáo kênh liên lạc", "Channel reports"], d: ["Tỷ lệ phản hồi theo kênh (Zalo vs Facebook vs Email), thời điểm khách hàng hoạt động nhiều nhất.", "Response rates per channel (Zalo vs Facebook vs email) and the hours your customers are most active."] },
      { t: ["Xuất Excel/PDF", "Excel/PDF export"], d: ["Xuất mọi báo cáo ra Excel hoặc PDF với 1 click. Lên lịch gửi báo cáo tự động qua email hàng tuần.", "Export any report to Excel or PDF in one click, or schedule it by email every week."] },
    ],
    tip: [
      "Đặt lịch gửi báo cáo tự động trong Cài đặt → Báo cáo để nhận báo cáo tổng hợp vào sáng thứ Hai mỗi tuần.",
      "Schedule reports under Settings → Reports to get the weekly summary every Monday morning.",
    ],
  },
  {
    id: "tasks",
    color: "tasks",
    label: ["Quản lý Công việc", "Task management"],
    intro: [
      "Hệ thống quản lý công việc tích hợp Kanban Board, phân công nhiệm vụ, theo dõi tiến độ và báo cáo hiệu suất đội nhóm.",
      "Task management with a Kanban board, assignment, progress tracking and team performance reporting.",
    ],
    items: [
      { t: ["Kanban Board", "Kanban board"], d: ["Kéo thả task qua các cột: Việc cần làm → Đang xử lý → Chờ phản hồi → Hoàn thành. Cập nhật real-time qua WebSocket.", "Drag tasks across To do → In progress → Waiting → Done, updating live over WebSocket."] },
      { t: ["Phân công nhân viên", "Assignment"], d: ["Giao task cho cá nhân hoặc cả nhóm, đặt deadline, mức độ ưu tiên (Thấp/Trung bình/Cao/Khẩn cấp).", "Assign to a person or a team with deadlines and priority (low/medium/high/urgent)."] },
      { t: ["Gắn vào Lead/BĐS", "Link to leads and listings"], d: ['Task "Gọi điện cho khách A" gắn trực tiếp vào hồ sơ lead, "Chụp ảnh BĐS" gắn vào kho hàng.', 'A "Call client A" task attaches to the lead; "Photograph the property" attaches to the listing.'] },
      { t: ["Nhắc nhở tự động", "Automatic reminders"], d: ["Cảnh báo task sắp đến hạn qua thông báo trình duyệt và email 30 phút, 1 giờ, 1 ngày trước.", "Browser and email alerts 30 minutes, 1 hour and 1 day before a task is due."] },
      { t: ["Bình luận & phản hồi", "Comments"], d: ["Để lại comment, đính kèm ảnh/tài liệu vào task, tag đồng nghiệp bằng @mention.", "Comment, attach photos or documents, and @mention colleagues."] },
      { t: ["Báo cáo hiệu suất", "Performance reporting"], d: ["Số task hoàn thành đúng hạn vs trễ hạn, workload theo nhân viên, bottleneck trong team.", "On-time vs late completion, workload per person, and where the team is bottlenecked."] },
    ],
  },
  {
    id: "knowledge",
    color: "knowledge",
    label: ["Cơ sở Tri thức", "Knowledge base"],
    intro: [
      "Thư viện nội bộ lưu trữ quy trình bán hàng, kịch bản xử lý từ chối, thông tin dự án, pháp lý — AI sử dụng kho tri thức này để trả lời câu hỏi tự động.",
      "An internal library of sales processes, objection-handling scripts, project facts and legal notes — the AI draws on it to answer questions automatically.",
    ],
    items: [
      { t: ["Bài viết & Quy trình", "Articles and processes"], d: ["Viết và lưu quy trình bán hàng, kịch bản tư vấn, hướng dẫn pháp lý — format rich text với tiêu đề, hình ảnh, bảng biểu.", "Write and store sales processes, consulting scripts and legal guidance in rich text with headings, images and tables."] },
      { t: ["AI truy xuất tự động", "AI retrieval"], d: ["Khi có câu hỏi phức tạp từ khách hàng trên Inbox, AI tìm và trả lời dựa trên nội dung trong Knowledge Base.", "When a tricky question arrives in the inbox, the AI searches the knowledge base and answers from it."] },
      { t: ["Phân loại theo danh mục", "Categories"], d: ["Phân loại: Pháp lý BĐS / Thông tin dự án / Quy trình nội bộ / Chính sách công ty / FAQ khách hàng.", "Property law, project information, internal process, company policy and customer FAQ."] },
      { t: ["Tìm kiếm toàn văn", "Full-text search"], d: ["Tìm kiếm ngay kết quả trong toàn bộ nội dung — hỗ trợ tiếng Việt có dấu và không dấu.", "Search the entire corpus instantly — with or without Vietnamese diacritics."] },
      { t: ["Phân quyền nội dung", "Access control"], d: ["Bài viết có thể đặt chế độ: Public (mọi nhân viên thấy) / Private (chỉ Admin) / Team (chỉ nhóm cụ thể).", "Each article can be public (all staff), private (admins) or team-only."] },
      { t: ["Thống kê truy cập", "Usage analytics"], d: ["Bài viết nào được xem nhiều nhất, nhân viên nào sử dụng nhiều, tỷ lệ AI trả lời đúng từ knowledge.", "Most-read articles, heaviest users, and how often the AI answers correctly from the base."] },
    ],
    tip: [
      "Càng thêm nhiều bài viết chất lượng vào Knowledge Base, AI trả lời tự động trong Inbox càng chính xác. Nên upload ngay kịch bản xử lý từ chối và FAQ phổ biến.",
      "The more good articles you add, the more accurate the inbox AI becomes. Start with your objection-handling scripts and common FAQs.",
    ],
  },
  {
    id: "settings",
    color: "settings",
    label: ["Cài đặt & Hồ sơ", "Settings and profile"],
    intro: [
      "Tùy chỉnh tài khoản cá nhân, cấu hình hệ thống, phân quyền nhân viên và thiết lập tích hợp bên thứ ba.",
      "Personal account settings, system configuration, staff permissions and third-party integrations.",
    ],
    checklistTitle: ["Hồ sơ cá nhân", "Personal profile"],
    checklist: [
      ["Ảnh đại diện, họ tên hiển thị, số điện thoại công việc", "Profile photo, display name and work phone"],
      ["Chữ ký email cá nhân (HTML đầy đủ)", "Personal email signature (full HTML)"],
      ["Múi giờ và ngôn ngữ giao diện (Tiếng Việt / English)", "Time zone and interface language (Vietnamese / English)"],
      ["Thay đổi mật khẩu và bật xác thực 2 bước (2FA)", "Change password and enable two-factor authentication"],
      ["Quản lý thiết bị đang đăng nhập và phiên làm việc", "Manage signed-in devices and sessions"],
    ],
    items: [
      { t: ["Quản lý nhân viên", "Staff management"], d: ["Thêm/xóa nhân viên, phân quyền (Admin/Manager/Agent), đặt quota lead hàng tháng.", "Add or remove staff, set roles (admin/manager/agent) and monthly lead quotas."] },
      { t: ["Cấu hình chi nhánh", "Branch configuration"], d: ["Tạo và quản lý nhiều chi nhánh, phân công nhân viên theo chi nhánh, báo cáo tách biệt.", "Create and manage branches, assign staff to them and report separately."] },
      { t: ["Thương hiệu doanh nghiệp", "Company branding"], d: ["Upload logo, đặt màu chủ đạo, tùy chỉnh tên miền hiển thị trên link chia sẻ và email.", "Upload a logo, set the brand colour and customise the domain shown on share links and email."] },
      { t: ["Gói dịch vụ & Thanh toán", "Plan and billing"], d: ["Xem gói hiện tại, nâng cấp lên Enterprise, lịch sử hóa đơn, thêm phương thức thanh toán.", "View your plan, upgrade to Enterprise, review invoices and add payment methods."] },
      { t: ["Bảo mật & Tuân thủ", "Security and compliance"], d: ["Cài chính sách mật khẩu, xem nhật ký truy cập (Audit Log), xuất dữ liệu GDPR.", "Set password policy, review the audit log and export data for GDPR requests."] },
      { t: ["Tích hợp bên thứ ba", "Third-party integrations"], d: ["Kết nối Zalo OA, Facebook Page, Brevo Email, webhook tùy chỉnh, API key cho developer.", "Connect Zalo OA, Facebook Pages, Brevo email, custom webhooks and developer API keys."] },
    ],
    note: [
      "Thay đổi cài đặt phân quyền có hiệu lực ngay lập tức. Hành động xóa nhân viên sẽ chuyển lead của họ về Admin để tái phân công.",
      "Permission changes take effect immediately. Deleting a member moves their leads back to an admin for reassignment.",
    ],
  },
];

export default function UserGuideView() {
  const lang = useLang();
  const i = lang === "en" ? 1 : 0;
  const [active, setActive] = useState(SECTIONS[0].id);
  const sec = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  const Icon = ICONS[sec.id];
  const hue = HUE[sec.color];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          {i ? "User guide" : "Hướng dẫn sử dụng"}
        </h1>
        <p className="text-lg max-w-2xl leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {i
            ? "Everything the SGS LAND platform can do, from your first login to advanced automation — in 12 chapters."
            : "Toàn bộ tính năng của nền tảng SGS LAND, từ lần đăng nhập đầu tiên đến tự động hoá nâng cao — trong 12 chương."}
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Muc luc */}
        <nav className="lg:w-64 shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
            {i ? "Contents" : "Nội dung"}
          </p>
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:sticky lg:top-24">
            {SECTIONS.map((s) => {
              const SIcon = ICONS[s.id];
              const on = s.id === active;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left whitespace-nowrap lg:whitespace-normal shrink-0"
                  style={{
                    background: on ? `${HUE[s.color]}14` : "transparent",
                    color: on ? HUE[s.color] : "var(--text-secondary)",
                    border: `1px solid ${on ? `${HUE[s.color]}33` : "transparent"}`,
                  }}
                >
                  <SIcon className="w-4 h-4 shrink-0" />
                  {s.label[i]}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Noi dung */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${hue}14`, border: `1px solid ${hue}33`, color: hue }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{sec.label[i]}</h2>
                {sec.badge && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${hue}1A`, color: hue, border: `1px solid ${hue}33` }}
                  >
                    {sec.badge[i]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>{sec.intro[i]}</p>

          {sec.chips && (
            <>
              {sec.chipsTitle && (
                <h3 className="text-base font-bold mt-8 mb-3" style={{ color: "var(--text-primary)" }}>{sec.chipsTitle[i]}</h3>
              )}
              <div className="flex flex-wrap gap-2">
                {sec.chips.map((c) => (
                  <span
                    key={c[0]}
                    className="px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{ background: `${hue}0F`, color: hue, border: `1px solid ${hue}2E` }}
                  >
                    {c[i]}
                  </span>
                ))}
              </div>
            </>
          )}

          {sec.items && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              {sec.items.map((it) => (
                <div
                  key={it.t[0]}
                  className="p-4 rounded-xl"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
                >
                  <p className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>{it.t[i]}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{it.d[i]}</p>
                </div>
              ))}
            </div>
          )}

          {sec.steps && (
            <>
              {sec.stepsTitle && (
                <h3 className="text-base font-bold mt-8 mb-3" style={{ color: "var(--text-primary)" }}>{sec.stepsTitle[i]}</h3>
              )}
              <ol className="space-y-3">
                {sec.steps.map((st, n) => (
                  <li key={st.t[0]} className="flex gap-3">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: `${hue}14`, color: hue }}
                    >
                      {n + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{st.t[i]}</p>
                      <p className="text-sm leading-relaxed mt-0.5" style={{ color: "var(--text-secondary)" }}>{st.d[i]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {sec.pairs && (
            <>
              {sec.pairsTitle && (
                <h3 className="text-base font-bold mt-8 mb-3" style={{ color: "var(--text-primary)" }}>{sec.pairsTitle[i]}</h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sec.pairs.map((p) => (
                  <div
                    key={p.t[0]}
                    className="flex items-start gap-2 p-3 rounded-lg"
                    style={{ background: `${hue}0A`, border: `1px solid ${hue}26` }}
                  >
                    <span className="font-mono text-sm font-bold shrink-0" style={{ color: hue }}>{p.t[i]}</span>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{p.d[i]}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {sec.checklist && (
            <>
              {sec.checklistTitle && (
                <h3 className="text-base font-bold mt-8 mb-3" style={{ color: "var(--text-primary)" }}>{sec.checklistTitle[i]}</h3>
              )}
              <div className="space-y-2">
                {sec.checklist.map((c) => (
                  <div key={c[0]} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <Check className="w-4 h-4 shrink-0" style={{ color: "var(--sgs-verified, #0F9D6E)" }} />
                    {c[i]}
                  </div>
                ))}
              </div>
            </>
          )}

          {sec.tip && (
            <div
              className="flex gap-3 mt-8 p-4 rounded-xl"
              style={{ background: "var(--primary-subtle)", border: "1px solid var(--border-default)" }}
            >
              <Lightbulb className="w-5 h-5 shrink-0" style={{ color: "var(--primary-600)" }} />
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{sec.tip[i]}</p>
            </div>
          )}

          {sec.note && (
            <div
              className="flex gap-3 mt-4 p-4 rounded-xl"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
            >
              <Info className="w-5 h-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{sec.note[i]}</p>
            </div>
          )}

          <div className="mt-10 pt-6 flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid var(--border-default)" }}>
            <a
              href={lang === "en" ? "/en/help-center" : "/help-center"}
              className="text-sm font-semibold"
              style={{ color: "var(--primary-600)" }}
            >
              {i ? "Help centre →" : "Trung tâm hỗ trợ →"}
            </a>
            <span style={{ color: "var(--text-tertiary)" }}>·</span>
            <a href="mailto:info@sgsland.vn" className="text-sm" style={{ color: "var(--text-secondary)" }}>
              info@sgsland.vn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
