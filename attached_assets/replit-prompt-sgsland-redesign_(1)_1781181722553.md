# PROMPT CHO REPLIT AGENT — REDESIGN TRANG CHỦ SGSLAND.VN

> Copy toàn bộ nội dung dưới đây và dán vào Replit Agent.

---

Bạn là senior product designer + fullstack engineer. Hãy **thiết kế lại hoàn toàn trang chủ của SGS LAND (sgsland.vn)** — một sàn giao dịch bất động sản tại TP.HCM — theo chuẩn proptech marketplace cao cấp (tham chiếu chất lượng: Zillow, PropertyGuru, Batdongsan.com.vn nhưng sang trọng và hiện đại hơn). KHÔNG được phá vỡ logic/route hiện có của app; chỉ redesign trang chủ và các component dùng chung (header, footer, chat widget).

## 1. BẮT BUỘC GIỮ NGUYÊN 6 TÍNH NĂNG / NỘI DUNG HIỆN CÓ

1. **Nút chuyển ngôn ngữ VI / EN** — giữ nguyên logic i18n hiện tại, chỉ redesign UI thành toggle pill gọn trong header (cờ + mã ngôn ngữ). Mọi text mới thêm vào trang chủ phải có đủ key dịch cho cả VI và EN.
2. **Chế độ Sáng / Tối (dark mode)** — giữ logic toggle hiện tại, lưu lựa chọn vào localStorage, tôn trọng `prefers-color-scheme` lần đầu truy cập. Toàn bộ component mới phải có dark variant hoàn chỉnh, không được có vùng nào "quên" dark mode.
3. **Đăng nhập** — giữ nguyên flow auth/route hiện có; nút "Đăng nhập" trong header (chi tiết UI ở mục 3.1), trạng thái đã đăng nhập hiển thị avatar + dropdown.
4. **AI Chat widget** — giữ nguyên backend/logic chat hiện có. Redesign bubble nổi góc phải dưới: icon chat + badge "AI", khi mở ra là panel bo góc 16px, header gradient thương hiệu, hiển thị gợi ý câu hỏi nhanh ("Định giá căn hộ của tôi", "Dự án nào dưới 3 tỷ?", "Thủ tục vay ngân hàng").
5. **Mục FAQ** — giữ nội dung FAQ hiện có, redesign thành accordion mượt (animate height + rotate icon), chia 2 cột trên desktop, có schema.org FAQPage markup cho SEO.
6. **Nội dung Footer** — migrate 100% thông tin footer hiện tại (pháp nhân, GPKD, liên hệ, chính sách, dự án), chỉ đổi giao diện (chi tiết ở mục 3.10). Cấm bỏ sót hay bịa thêm.

## 2. ĐỊNH HƯỚNG THIẾT KẾ (DESIGN DIRECTION)

**Concept: "Sàn giao dịch tin cậy — dữ liệu thật, pháp lý thật".** Cảm giác premium nhưng đáng tin như một ngân hàng, không lòe loẹt như landing page bán hàng.

### Design tokens — HỆ MÀU ĐÃ KIỂM CHỨNG WCAG (mọi cặp dưới đây đều PASS AA, không tự ý đổi)

**Light mode:**

| Token | Hex | Dùng cho |
|---|---|---|
| `--bg` | `#FAFAF8` | Nền trang (trắng ngà ấm) |
| `--surface` | `#FFFFFF` | Card, search bar, panel |
| `--primary` | `#1B3A5C` | Navy đậm — header, heading, nút phụ (11.6:1 trên trắng) |
| `--primary-deep` | `#0F2740` | Gradient hero, footer, CTA banner |
| `--accent` | `#C8963E` | Vàng đồng — CHỈ làm nền nút CTA, border, icon, đường kẻ. **CẤM dùng làm màu chữ trên nền sáng** |
| `--accent-text` | `#8C6420` | Vàng đậm — giá tiền, link nhấn, label trên nền sáng (5.3:1 PASS AA) |
| `--text` | `#16202B` | Chữ chính (15.8:1) |
| `--text-muted` | `#5C6B7A` | Chữ phụ (5.2:1 PASS AA) |
| `--verified` | `#1E7F5C` | Badge "✓ Pháp lý đã kiểm duyệt" (4.95:1) |
| `--hero-deep` | `#0A1E33` | Đỉnh gradient hero — navy mực đêm, tạo chiều sâu điện ảnh (chữ trắng 16.9:1, vàng 7.7:1) |
| `--champagne` | `#F5EAD5` | Nền highlight mềm — chip gợi ý AI, tag nổi bật. **Chữ trên champagne phải là navy `#1B3A5C` (9.8:1)**, không dùng vàng làm chữ nhỏ trên nền này |
| `--on-dark-muted` | `#93A6B8` | Chữ phụ nhỏ trên nền navy đậm (footer copyright, caption) — tối thiểu 6.1:1. KHÔNG dùng tông xám nhạt hơn |

**Dark mode:**

| Token | Hex | Dùng cho |
|---|---|---|
| `--bg` | `#0E1620` | Nền trang |
| `--surface` | `#16222F` | Card, panel |
| `--primary` | `#7FA8D0` | Navy sáng — heading, link (7.3:1) |
| `--accent` / `--accent-text` | `#D4A855` | Vàng — dark mode dùng được cả nút lẫn chữ (8.3:1) |
| `--text` | `#E8ECF1` | Chữ chính (15.3:1) |
| `--text-muted` | `#9AAAB8` | Chữ phụ |
| `--verified` | `#3FB389` | Badge xác thực |

**Quy tắc dùng màu (tỷ lệ 60–30–10):**
- 60% nền trung tính (`--bg`, `--surface`), 30% navy (`--primary`), 10% vàng đồng (`--accent`). Vàng là gia vị, không phải món chính — xuất hiện đúng 4 nơi: nút CTA chính, giá tiền, ticker, đường gạch chân heading.
- **Nút CTA chính: nền vàng `#C8963E` + chữ navy đậm `#16202B`** (6.2:1 PASS — KHÔNG dùng chữ trắng trên vàng, fail 2.7:1). Hover: nền sáng lên `#D9A94E` + nâng shadow.
- Nút phụ: outline navy 1.5px, chữ navy; hover fill navy chữ trắng.
- Gradient hero overlay: `linear-gradient(175deg, #0A1E33 0%, #0F2740 45%, #1B3A5C 80%, rgba(200,150,62,.22) 100%)` — navy mực đêm chuyển dần sang ánh vàng nhẹ ở chân trời như hoàng hôn Sài Gòn, không che ảnh.
- Giá tiền trên card: light mode dùng `#8C6420`, dark mode `#D4A855`, luôn font mono + `font-variant-numeric: tabular-nums`.
- **Typography (cặp đôi chuẩn 2026 — neo-serif × monospace):** Headline hero và H2 dùng **"Noto Serif Display"** weight 600 (serif hiện đại, hỗ trợ tiếng Việt đầy đủ, có dấu đẹp) — tạo độ tương phản sang trọng kiểu tạp chí BĐS cao cấp; body và UI dùng **"Be Vietnam Pro"** 400/500; mọi số liệu (giá, diện tích, thống kê, ngày) dùng **"IBM Plex Mono"** + `font-variant-numeric: tabular-nums`. Cặp serif-display × mono-data là ngôn ngữ thị giác premium của 2026. Type scale: H1 clamp(2.5rem, 5.5vw, 4rem) / H2 2.25rem / H3 1.25rem / body 1rem / caption 0.8125rem; heading letter-spacing −0.02em. Hero H1 có 1 từ khóa in nghiêng serif màu accent (vd: "đầu tư") làm điểm nhấn kinetic.
- **Chi tiết nâng tầm (bắt buộc làm đủ):**
  - Search bar hero dạng **glass**: nền `rgba(255,255,255,.92)` + `backdrop-filter: blur(12px)` + border 1px `rgba(255,255,255,.4)`, dark mode `rgba(22,34,47,.88)`.
  - Heading section có đường gạch chân ngắn 48px màu accent, lệch trái — nhận diện xuyên suốt.
  - Badge "✓ Pháp lý" có nền `--verified` 10% opacity + chữ `--verified` + icon check, bo pill.
  - Hover card dự án: ảnh scale 1.04 (overflow hidden), card nâng shadow, giá đổi sang đậm hơn — cả 3 cùng transition 250ms ease-out.
  - Skeleton loading shimmer cho ảnh card khi tải.
  - Scrollbar custom mảnh màu navy trên desktop.
- **Spacing & radius:** radius card 12px, button 8px, section padding 96px desktop / 48px mobile. Shadow rất nhẹ (`0 1px 3px rgba(22,32,43,.08)`), hover nâng lên `0 8px 24px rgba(22,32,43,.12)`.
- **Signature element:** dải "ticker pháp lý" chạy ngang dưới hero — giống ticker chứng khoán nhưng hiển thị giao dịch thật: "✓ Căn hộ Vinhomes Grand Park 2PN — 3,2 tỷ — đã công chứng 10/06" trượt liên tục, pause khi hover. Đây là điểm nhận diện khiến trang giống một SÀN thực thụ.

## 3. CẤU TRÚC TRANG CHỦ (THEO THỨ TỰ)

### 3.1. Header (sticky, blur backdrop khi scroll)
Logo SGS LAND | Menu: Dự án, Định giá AI, Mua, Thuê, Tin tức, Liên hệ | Bên phải theo thứ tự: toggle VI/EN, toggle sáng/tối, **nút "Đăng nhập"** (ghost/outline navy, icon user — mở modal hoặc route /login hiện có; nếu đã đăng nhập thì thay bằng avatar + dropdown: Tài khoản, BĐS đã lưu, Đăng xuất), nút CTA "Định giá miễn phí" (nền vàng, chữ navy). Mobile: hamburger menu slide-in, trong đó Đăng nhập đặt ngay đầu menu.

### 3.2. Hero + THANH TÌM KIẾM AI DUY NHẤT (linh hồn của trang — làm thật kỹ)

**Nền hero:** gradient navy điện ảnh `linear-gradient(175deg, #0A1E33 0%, #0F2740 45%, #1B3A5C 80%, rgba(200,150,62,.22) 100%)` phủ lên ảnh skyline TP.HCM ban đêm (đèn vàng thành phố cộng hưởng với accent). Chiều cao ~88vh desktop.

**Headline serif kinetic:** "Tìm kiếm, mua & *đầu tư* BĐS TP.HCM" — từ "đầu tư" in nghiêng serif màu `#D4A855` với gạch chân vẽ dần 600ms. Subline: "Đại lý F1 uỷ quyền — Novaland · Masterise · Nam Long · Vinhomes".

**Search bar = MỘT thanh Hỏi AI duy nhất, KHÔNG có tab, KHÔNG có hàng bộ lọc dropdown** (mọi nhu cầu lọc đều diễn đạt bằng ngôn ngữ tự nhiên — AI tự hiểu). Panel glass NỔI, tràn xuống đè lên mép dưới hero (margin-bottom −48px, đè lên section stats — chi tiết "floating bridge" khiến hero không bao giờ trông template). Panel: `rgba(255,255,255,.94)` + blur 14px + border vàng nhẹ `rgba(200,150,62,.45)` + shadow `0 24px 64px rgba(10,30,51,.35)`, radius 16px:

- **Input lớn duy nhất** chiếm toàn bộ chiều ngang panel: icon sparkles vàng bên trái, placeholder có hiệu ứng gõ chữ luân phiên 3 câu: "Căn hộ 2PN gần Metro số 1, dưới 3 tỷ…" → "Biệt thự Aqua City có sổ hồng riêng…" → "Đất nền Biên Hòa pháp lý sạch…". Người dùng gõ ngôn ngữ tự nhiên bất kỳ: mua, thuê, khu vực, giá, pháp lý — AI tự phân tích.
- **Nút "Hỏi ngay"** bên phải trong input: nền vàng `#C8963E`, chữ navy `#16202B`, icon mũi tên; hover sáng `#D9A94E` + nâng shadow. Submit đẩy câu hỏi vào AI chat widget hiện có (mở panel chat kèm câu hỏi) hoặc route sang trang kết quả lọc thông minh.
- **Dưới input: 3 chip gợi ý** nền `#F5EAD5` chữ navy `#1B3A5C`, click là điền vào input: "Biệt thự Aqua City có sổ hồng" · "Đất nền Biên Hòa pháp lý sạch" · "Vay 70% mua Grand Park".

**Dưới panel:** hàng quick chips có SỐ LƯỢNG THẬT — "Aqua City · 124 căn" · "Vinhomes Cần Giờ · 89 căn" · "Dưới 3 tỷ · 1.240 BĐS" — viền trắng 25% opacity, chữ `#D4E0EC`, hover nền trắng 10%; click chip tự điền câu hỏi tương ứng vào input AI. Số lượng lấy từ data thật của hệ thống, font mono.

**Chi tiết pro:** phím tắt `/` focus vào input (hiện hint nhỏ `/` trong ô); thanh search sticky thu gọn thành 1 hàng mỏng dính theo header khi scroll qua hero; Enter = Hỏi ngay; mobile: panel full-width, input cao tối thiểu 52px cho dễ chạm, bàn phím mở không che chip gợi ý.

**Headline serif kinetic:** "Tìm kiếm, mua & *đầu tư* BĐS TP.HCM" — từ "đầu tư" in nghiêng serif màu `#D4A855` với gạch chân vẽ dần 600ms. Subline: "Đại lý F1 uỷ quyền — Novaland · Masterise · Nam Long · Vinhomes".

### 3.3. Trust bar (số liệu thật của SGS LAND)
5 stat dùng font mono, count-up animation khi scroll vào view:
**45.000+** BĐS quản lý · **15.000+** môi giới đối tác · **2 tỷ USD+** giá trị giao dịch · **4.8/5** đánh giá khách hàng · **±5%** sai số định giá AI

### 3.4. Ticker pháp lý (signature — mô tả ở mục 2)

### 3.5. Dự án nổi bật — grid card chuẩn marketplace
7 dự án thật, card gồm: ảnh 16:9 (lazy load, hover zoom nhẹ), badge trạng thái ("Đang mở bán" / "Nhận đặt cọc"), badge xanh "✓ Pháp lý đã kiểm duyệt", tên dự án, vị trí kèm icon pin, giá từ (font mono, màu accent), 3 thông số icon (diện tích, loại hình, chủ đầu tư), nút "Xem chi tiết":
1. Aqua City Novaland — Biên Hòa, Đồng Nai — Biệt thự từ 6,5 tỷ — 1.000ha — Sổ hồng riêng
2. The Global City Masterise — An Phú, TP Thủ Đức — Căn hộ từ 7,5 tỷ — 117ha
3. Izumi City Nam Long — Biên Hòa — Nhà phố từ 8,4 tỷ, căn hộ từ 1,2 tỷ — 170ha chuẩn Nhật
4. Vinhomes Cần Giờ — 2.870ha lấn biển lớn nhất VN — Đặt cọc từ 8 tỷ
5. Masterise Homes (Grand Marina Q1, Lumière, Masteri) — 55–350 triệu/m²
6. Vinhomes Grand Park — TP Thủ Đức, cạnh Metro số 1 — Căn hộ từ 2,5 tỷ — 271ha
7. Vạn Phúc City — ven sông Sài Gòn, TP Thủ Đức — Nhà phố & biệt thự
Layout: hàng đầu 1 card lớn (featured) + grid 3 cột; có filter tab nhanh: Tất cả / Căn hộ / Nhà phố / Biệt thự.

### 3.6. Khối "Định giá AI ±5%" (USP chính)
Section 2 cột: trái là copy + nút "Định giá ngay" link tới /ai-valuation; phải là mock UI nhỏ thể hiện kết quả định giá (thanh range giá min–max, con số nhảy bằng mono font). Vi-animation tinh tế, không lố.

### 3.7. Tại sao chọn SGS LAND — BENTO GRID (layout đặc trưng 2026)
Không dùng 4 card đều nhau nhàm chán. Dùng bento grid bất đối xứng (desktop: grid 4 cột × 2 hàng):
- Ô lớn 2×2: "Định giá AI ±5%" — có mini sparkline giá thị trường động.
- Ô ngang 2×1: "Pháp lý 2 lớp độc lập" — icon shield + 2 bước kiểm tra (quy hoạch → sổ đỏ).
- Ô 1×1: "Miễn phí 100% với người mua".
- Ô 1×1: "Vay ưu đãi 12+ ngân hàng" — LTV 70–80%, lãi 6–8,5%/năm, hiển thị logo ngân hàng mờ.
Mobile: bento gập thành stack dọc giữ thứ tự ưu tiên. Mỗi ô có hover lift riêng.

### 3.8. Khối TIN CẬY (Trust-first UX — bắt buộc cho BĐS 2026)
Ngay sau bento: dải logo đối tác F1 (Novaland, Masterise, Nam Long, Vinhomes) grayscale, hover lên màu + testimonial thật: "Mua biệt thự Aqua City qua SGS LAND tháng 1/2026. Đội tư vấn giải thích rõ chính sách thanh toán, hỗ trợ vay BIDV và kiểm tra pháp lý miễn phí." — Anh Nguyễn Văn Hải, kèm avatar, 5 sao, và badge "Giao dịch đã xác minh". Thêm hàng micro-trust: số GPKD, năm thành lập, hotline phản hồi <15 phút.

### 3.9. FAQ (giữ nội dung cũ, redesign accordion — mục 1.4)

### 3.10. CTA cuối + Footer
Banner CTA nền navy gradient: "Nhận tư vấn miễn phí trong 15 phút" + nút gọi Hotline +84 971 132 378 + nút mở AI chat.

**Footer — GIỮ NGUYÊN TOÀN BỘ THÔNG TIN HIỆN CÓ trên sgsland.vn, chỉ redesign giao diện.** Trước khi code, đọc footer hiện tại của site và migrate đủ 100% nội dung: mô tả công ty, danh sách 7 dự án phân phối, các link điều hướng/hỗ trợ/chính sách, hotline +84 971 132 378, email info@sgsland.vn, địa chỉ, mã số thuế/GPKD, social links, dòng bản quyền — KHÔNG được bỏ sót hay tự bịa thêm thông tin pháp nhân. Layout mới: nền `--primary-deep #0F2740`, 4 cột (Về SGS LAND + mô tả, Dự án, Hỗ trợ & Chính sách, Liên hệ), chữ `#B9C6D4`, link hover sáng vàng `#D4A855`, đường kẻ trên cùng 1px vàng đồng 20% opacity, hàng cuối là bản quyền + badge đối tác F1. Footer đồng nhất cả 2 theme (vì nền đã tối sẵn).

## 4. YÊU CẦU KỸ THUẬT

- Giữ nguyên stack hiện tại của repo (React/Vite/Tailwind nếu đang dùng). Component hóa rõ ràng: `Header`, `AuthButton`, `HeroAISearch` (thanh hỏi AI duy nhất), `StatsBar`, `LegalTicker`, `ProjectCard`, `ProjectGrid`, `ValuationPromo`, `BentoWhyUs`, `TrustBlock`, `FAQ`, `CTABanner`, `Footer`, `ChatWidget`.
- **Responsive hoàn chỉnh**: mobile-first, thanh Hỏi AI full-width cao ≥52px trên mobile, grid dự án 1 cột mobile / 2 tablet / 3 desktop.
- **Hiệu năng**: ảnh dùng `loading="lazy"` + `srcset`, font preload, LCP < 2.5s, không layout shift (đặt aspect-ratio cho mọi ảnh). Lighthouse mục tiêu ≥ 90 cả 4 chỉ số.
- **Animation chuẩn 2026 — CSS-first, không lạm dụng JS**: dùng **CSS scroll-driven animations** (`animation-timeline: view()`) cho scroll-reveal (fade + translateY 16px, stagger 80ms), fallback IntersectionObserver cho trình duyệt cũ; dùng **View Transitions API** cho chuyển trang mượt giữa trang chủ ↔ trang dự án (ảnh card morph thành ảnh hero của trang chi tiết); tôn trọng `prefers-reduced-motion`. Kỷ luật chuyển động: 1 khoảnh khắc lớn duy nhất (ticker + count-up stats), còn lại là micro-interaction <300ms.
- **Accessibility**: focus ring rõ ràng, contrast WCAG AA cả 2 theme, aria-label cho toggle ngôn ngữ/theme/chat, accordion FAQ điều hướng được bằng bàn phím.
- **SEO + AEO (Answer Engine Optimization 2026)**: giữ meta hiện tại, thêm JSON-LD `RealEstateAgent` + `FAQPage` + `Product` cho từng dự án; heading dạng câu hỏi cho FAQ; cập nhật và link file `llms-full.txt` hiện có để Google AI Overviews/ChatGPT trích dẫn được; heading đúng thứ bậc H1→H2→H3.
- Sau khi hoàn thành, chạy thử cả light/dark mode và cả VI/EN, chụp screenshot mobile + desktop để kiểm tra trước khi báo xong.

## 5. GÓI NÂNG CẤP "CHUẨN 2026" (làm đủ, không bỏ mục nào)

1. **Kinetic typography ở hero**: headline serif xuất hiện theo từng cụm từ (clip-path reveal, stagger 120ms khi load); từ khóa in nghiêng màu accent có hiệu ứng gạch chân vẽ dần. Chỉ chạy 1 lần khi load, không lặp.
2. **Bento grid** cho khối lợi thế (mục 3.7) — ngôn ngữ layout đặc trưng 2026, phá thế lưới đều đặn nhàm chán.
3. **AI chat thế hệ copilot**: widget chat không chỉ trả lời FAQ — khi người dùng đang xem section dự án nào, gợi ý nhanh trong chat đổi theo ngữ cảnh (vd đang ở card Vinhomes Cần Giờ → gợi ý "Chính sách đặt cọc Cần Giờ?"). Chat có khả năng dẫn sang form định giá AI và đặt lịch tư vấn ngay trong panel.
4. **Glassmorphism có chừng mực**: chỉ ở 3 nơi — search bar hero, header khi scroll, panel chat. Tuyệt đối không phủ blur toàn trang.
5. **Dark mode là first-class**: thiết kế dark trước, light sau; ảnh dự án trong dark mode có overlay navy 8% để hoà tông; toggle theme có animation mặt trời↔mặt trăng morph.
6. **Micro-interactions có mục đích**: nút CTA có ripple nhẹ khi click; icon tim "lưu BĐS" nảy spring; input search có caret màu accent; toast xác nhận khi đổi ngôn ngữ. Mỗi cái <300ms, có ý nghĩa phản hồi, không trang trí suông.
7. **Hiệu năng = thẩm mỹ 2026 (Machine Experience)**: ưu tiên CSS thay JS cho mọi animation; tổng JS trang chủ <180KB gzip; ảnh AVIF/WebP; font subset tiếng Việt; mục tiêu LCP <2s, INP <200ms, CLS = 0.
8. **Anti-template**: cấm dùng stock template hero "căn nhà + form trắng" phổ thông. Mọi section phải nhận diện được là SGS LAND nhờ: serif×mono, navy×vàng đồng, ticker pháp lý, đường gạch chân accent 48px.

## 6. TIÊU CHÍ "AMAZING"

Trang phải khiến người xem cảm nhận ngay trong 3 giây: đây là một SÀN BĐS chuyên nghiệp chuẩn 2026 với dữ liệu thật — không phải landing page bán lẻ, càng không phải template. Dấu hiệu đạt chuẩn: headline serif kinetic mở màn, mọi con số mono thẳng hàng, bento grid bất đối xứng nhưng cân bằng, dark mode đẹp ngang light mode, chuyển trang morph mượt bằng View Transitions, và ticker pháp lý là thứ người ta nhớ về trang này.
