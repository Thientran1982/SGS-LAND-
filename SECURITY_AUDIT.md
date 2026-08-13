# SECURITY AUDIT — SGS LAND

Ngày thực hiện: 2026-08-13
Phạm vi: audit đọc mã nguồn tĩnh (static/manual code review), không chạy pentest động, không sửa code.
Phương pháp: đọc trực tiếp `server.ts`, `server/routes/*`, `server/repositories/*`, `server/middleware/*`, `server/services/*`, cấu hình `.replit`, `apps/nextjs/next.config.ts`.

Thang mức độ: **Critical** (khai thác được ngay, ảnh hưởng toàn hệ thống/dữ liệu) → **High** (khai thác được với vài điều kiện, ảnh hưởng nghiêm trọng) → **Medium** (cần điều kiện cụ thể hoặc ảnh hưởng giới hạn) → **Low** (rủi ro nhỏ/phòng thủ theo chiều sâu) → **Cần kiểm tra thêm** (không đủ bằng chứng tĩnh để kết luận, cần xác minh runtime).

---

## Nhóm 1 — Xác thực & Phân quyền (Auth/RBAC)

### 1.1 Cơ chế xác thực & cookie — Baseline (không phải lỗi, ghi nhận để tham chiếu)
- **Vị trí:** `server.ts:241-250` (fail-fast nếu thiếu `JWT_SECRET`), `server.ts:341-347` (cookie options), `server.ts:451,525,893` (`expiresIn: '24h'`).
- **Hiện trạng:** JWT ký bằng `JWT_SECRET` từ biến môi trường (không có fallback cứng). Cookie `httpOnly: true`, `sameSite: 'lax'`, `secure: true` chỉ khi `NODE_ENV === 'production'`, `maxAge` 24h.
- **Đánh giá:** Cấu hình đúng chuẩn, không có phát hiện lỗi ở phần này.

### 1.2 Không có middleware RBAC tập trung — role check rải rác trong từng route
- **Mức độ:** Medium
- **Vị trí:** Không có file `requireRole()`/`checkRole()` dùng chung; mỗi route tự viết điều kiện, ví dụ `server/routes/leadRoutes.ts:30` (`GET /` chặn `PARTNER_ADMIN/PARTNER_AGENT`), `server/routes/leadRoutes.ts:346` (`DELETE /:id` yêu cầu `SUPER_ADMIN/ADMIN/TEAM_LEAD`).
- **Mô tả:** Việc kiểm tra vai trò được viết tay (`if (!['ADMIN','TEAM_LEAD'].includes(user.role))`) lặp lại ở hàng chục route khác nhau (`leadRoutes.ts`, `billingRoutes.ts`, `commissionRoutes.ts`, `listingRoutes.ts`, …) thay vì một middleware `requireRole(...roles)` dùng chung.
- **Kịch bản khai thác:** Không tự nó là lỗ hổng, nhưng là nguyên nhân gốc khiến các phát hiện 1.3–1.4 bên dưới xảy ra — khi thêm route mới, lập trình viên rất dễ quên gắn role-check vì không có cơ chế bắt buộc/type-safe.
- **Đề xuất:** Viết middleware `requireRole(...roles: Role[])` dùng chung, áp dụng lại cho toàn bộ route quản trị/CRM, để lỗi thiếu role-check bị phát hiện ở review thay vì runtime.

### 1.3 `PATCH /api/leads/:id/merge` cố ý bỏ qua kiểm tra chủ sở hữu (hardcode role 'ADMIN')
- **Mức độ:** Medium (không phải Critical vì tenant vẫn bị chặn, nhưng là privilege bypass thật)
- **Vị trí:** `server/routes/leadRoutes.ts:221-253`, cụ thể dòng 253: `leadRepository.update(user.tenantId, String(req.params.id), mergeData, user.id, 'ADMIN')`.
- **Mô tả hành vi sai:** Route gọi `authenticateToken` (bất kỳ user nào đăng nhập, không giới hạn role) rồi truyền cứng chuỗi `'ADMIN'` làm role vào `leadRepository.findByIdWithAccess`/`update`. Theo `leadRepository.ts:330-333`, việc lọc "role hạn chế chỉ thấy lead của mình" (`RESTRICTED = ['SALES','MARKETING','VIEWER']`) bị bỏ qua hoàn toàn khi role truyền vào là `'ADMIN'`.
- **Kịch bản khai thác thực tế:** Một nhân viên SALES đã đăng nhập (không phải chủ sở hữu lead) có thể gọi `PATCH /api/leads/{id}/merge` với `id` của một lead **thuộc cùng tenant nhưng do đồng nghiệp khác phụ trách**, và ghi thêm (additive-only: email/address/notes/tags còn trống) vào lead đó — dù logic route bình thường (GET/PUT) sẽ trả 404 cho SALES không sở hữu lead này. Đây là leak thông tin gián tiếp (biết được lead tồn tại + ghi được dữ liệu) vượt quyền thiết kế ban đầu.
- **Đề xuất:** Truyền `user.role` thật thay vì hardcode `'ADMIN'`; nếu nghiệp vụ merge cần vượt quyền sở hữu (vd. để gộp duplicate), thêm kiểm tra role tường minh (`ADMIN/TEAM_LEAD` mới được merge chéo) thay vì giả lập quyền admin cho mọi user.

### 1.4 Nhiều endpoint cron/webhook nội bộ dùng `JWT_SECRET.slice(0,32)` làm secret dùng chung khi thiếu secret riêng
- **Mức độ:** High
- **Vị trí:** `server.ts` — 17 vị trí, gồm dòng 4521, 4559, 4571, 4582, 4593, 4604, 4616, 4701, 4726, 6026, 6061, 6101, 6141, 6180, 6219, 6258, 6297. Ví dụ: `const configuredSecret = process.env.RLHF_CRON_SECRET || process.env.JWT_SECRET?.slice(0, 32);`
- **Mô tả hành vi sai:** Khi biến môi trường riêng cho từng cron/webhook (RLHF, GeoMonitor, chat-follow-up...) không được set, hệ thống fallback dùng **32 ký tự đầu của JWT_SECRET** làm secret xác thực cho các endpoint nội bộ này. Điều này có 2 vấn đề: (a) một secret dùng cho JWT phiên đăng nhập của toàn bộ user giờ cũng bảo vệ ~17 endpoint cron khác nhau — lộ 1 secret là lộ tất cả; (b) việc cắt 32 ký tự đầu của secret là hành vi có thể đoán được nếu JWT_SECRET có độ dài/entropy thấp, làm giảm entropy hiệu dụng của secret cron so với secret gốc.
- **Kịch bản khai thác thực tế:** Nếu JWT_SECRET bị lộ qua bất kỳ kênh nào (log, lỗi debug, biến môi trường bị dump), kẻ tấn công không chỉ giả mạo được JWT đăng nhập mà còn gọi được thẳng ~17 endpoint cron/webhook nội bộ (RLHF feedback loop, geo-monitor, chat follow-up...) để kích hoạt tác vụ nền tuỳ ý, tốn tài nguyên (gọi AI, gửi email hàng loạt) hoặc thao túng dữ liệu do các job này ghi.
- **Đề xuất:** Bắt buộc set biến môi trường secret riêng cho từng loại cron (`RLHF_CRON_SECRET`, v.v.) và fail-fast (từ chối chạy) nếu thiếu, thay vì fallback về JWT_SECRET dùng chung.

### 1.5 Endpoint chỉ yêu cầu đăng nhập, không kiểm tra vai trò
- **Mức độ:** Low
- **Vị trí:** `server/routes/leadRoutes.ts:81` (`GET /check-email`), `:106` (`GET /check-phone`).
- **Mô tả:** Hai endpoint chỉ có `authenticateToken`, không giới hạn role — bất kỳ user đã đăng nhập nào (kể cả VIEWER) đều gọi được để kiểm tra một email/số điện thoại có tồn tại trong danh sách lead của tenant hay không.
- **Kịch bản khai thác:** Rò rỉ thông tin nhị phân (tồn tại/không tồn tại) về khách hàng trong tenant cho user có quyền thấp nhất — rủi ro thấp vì chỉ trả về boolean, không trả nội dung lead.
- **Đề xuất:** Chấp nhận được cho nghiệp vụ (check trùng khi tạo lead cần mọi role gọi được); nếu muốn siết thêm, giới hạn rate/logging riêng cho hai endpoint này.

### 1.6 IDOR — đánh giá tổng thể route GET/PUT/DELETE `/api/leads/:id`
- **Mức độ:** Không phát hiện lỗi (ghi nhận baseline tốt)
- **Vị trí:** `server/repositories/leadRepository.ts:301-337` (`findByIdWithAccess`), dòng 319/323 dùng `tenant_id = current_setting('app.current_tenant_id', true)::uuid`.
- **Mô tả:** Cách ly tenant được thực hiện ở tầng SQL (session variable Postgres), không chỉ ở tầng route — mẫu thiết kế tốt, khó bị bỏ sót khi thêm truy vấn mới. Với role hạn chế (SALES/MARKETING/VIEWER), thêm điều kiện `lead.assignedTo !== userId → return null`, tương đương 404 khi không sở hữu. Ngoại lệ duy nhất là 1.3 ở trên.
- **Đề xuất:** Không có, ngoài việc xử lý 1.3.

### 1.7 Route quản trị lộ ra ngoài
- **Mức độ:** Cần kiểm tra thêm
- **Vị trí:** `requirePlatformAdmin` (`server.ts:3574`).
- **Mô tả:** Đã xác nhận middleware này tồn tại và được áp cho các route platform-admin, nhưng chưa rà hết toàn bộ danh sách route dùng nó so với danh sách route thực tế cần bảo vệ (vd. các trang quản trị enterprise, billing, system status) trong lần audit này — cần một lượt kiểm tra route-by-route riêng để khẳng định không có route admin nào thiếu middleware.
- **Đề xuất:** Lập danh sách đối chiếu toàn bộ path bắt đầu bằng `/api/admin`, `/api/platform`, `/api/enterprise` với middleware áp dụng thực tế.

---

## Nhóm 2 — Secret trong mã nguồn/cấu hình

### 2.1 `.replit` (file được commit vào repo) chứa secret dạng plaintext trong `[userenv.shared]`
- **Mức độ:** High
- **Vị trí:** `.replit:136-137`
  ```
  EMAIL_WEBHOOK_TOKEN = "sgs-test-2026"
  INITIAL_ADMIN_PASSWORD_HASH = "$2b$12$rMWDtnPG8BdssWxA1kTgC.z563nD/musE8Hs1qeMck20jLYa4z0Ue"
  ```
- **Mô tả hành vi sai:** `.replit` không nằm trong `.gitignore` (chỉ `*.env` bị ignore) và được version-control cùng code. `EMAIL_WEBHOOK_TOKEN` là token xác thực webhook dạng plaintext, ai đọc được repo (kể cả qua fork, chia sẻ Repl, hoặc rò rỉ git history) đều lấy được token này để gọi webhook email giả mạo. `INITIAL_ADMIN_PASSWORD_HASH` là hash bcrypt — không lộ mật khẩu gốc trực tiếp, nhưng lộ ra để kẻ tấn công crack offline (đặc biệt nguy hiểm nếu mật khẩu ban đầu yếu/mặc định và chưa được đổi).
- **Kịch bản khai thác thực tế:** (a) Bất kỳ ai truy cập được mã nguồn (collaborator, fork công khai, backup rò rỉ) lấy `EMAIL_WEBHOOK_TOKEN` để gọi endpoint webhook email tương ứng nếu token này còn được dùng ở production; (b) chạy brute-force/dictionary offline trên `INITIAL_ADMIN_PASSWORD_HASH` để tìm ra mật khẩu admin ban đầu, nếu tài khoản admin đó chưa từng đổi mật khẩu.
- **Đề xuất:** Xoay vòng ngay `EMAIL_WEBHOOK_TOKEN` sang giá trị mới, chuyển vào Replit Secrets (không phải `[userenv]`). Xác nhận tài khoản admin ban đầu đã đổi mật khẩu (nếu chưa, đổi ngay) rồi xoá `INITIAL_ADMIN_PASSWORD_HASH` khỏi `.replit`.

### 2.2 File `.env` thật (không phải `.env.example`) tồn tại trên đĩa
- **Mức độ:** Low
- **Vị trí:** `sgs-next/packages/db/.env`
- **Mô tả:** Nội dung là `DATABASE_URL="postgresql://user:pass@localhost:5432/sgs_next"` — giá trị placeholder rõ ràng (`user:pass@localhost`), không phải credential thật. Đã xác nhận file này **không nằm trong `git ls-files`** (không được commit), và `.gitignore:36` có `*.env` (trừ `.env.example`) nên không bị đẩy lên remote.
- **Đánh giá:** Không phải lộ secret thật, nhưng thư mục `sgs-next/` trông như tàn dư của một cấu trúc dự án cũ song song (không phải `apps/nextjs` đang chạy) — nên xác nhận có còn dùng hay dọn bỏ.

### 2.3 Biến môi trường công khai phía trình duyệt (`NEXT_PUBLIC_*`)
- **Mức độ:** Không phát hiện lỗi
- **Vị trí:** `apps/nextjs/**` — chỉ dùng duy nhất `NEXT_PUBLIC_API_URL` (URL backend, không nhạy cảm) ở ~14 vị trí (`lib/api.ts`, các trang SSR/SSG, sitemap routes).
- **Mô tả:** Không tìm thấy `NEXT_PUBLIC_*` nào chứa API key, token hay secret — chỉ có URL base công khai. Không có phát hiện ở nhóm này.

### 2.4 Rà soát hardcode key/token/password trong `server.ts` + `server/**`
- **Mức độ:** Không phát hiện (trong phạm vi grep theo pattern `key/secret/password/token = "..."`)
- **Mô tả:** Không tìm thấy giá trị secret dạng chuỗi cố định gán trực tiếp cho biến kiểu key/secret/token/password trong `server.ts`/`server/**` (ngoại trừ pattern `JWT_SECRET?.slice(0,32)` đã nêu ở 1.4, không phải hardcode mà là secret suy ra runtime). Toàn bộ secret khác (Brevo, VNPay, Upstash, Stripe, TOTP) đọc qua `process.env.*`.
- **Đề xuất:** Không cần hành động thêm, ngoài việc xử lý 2.1.

---

## Nhóm 3 — Webhook TikTok Lead Gen

### 3.1 Không tìm thấy tích hợp TikTok Lead Gen webhook trong mã nguồn
- **Mức độ:** Cần kiểm tra thêm
- **Vị trí đã rà:** toàn bộ `server.ts`, `server/routes/*`, `server/services/*`, `server/middleware/*` (grep `tiktok`, `lead.?gen` không phân biệt hoa thường).
- **Mô tả:** Từ khoá "tiktok" chỉ xuất hiện ở 3 chỗ, đều không liên quan webhook: `analyticsRepository.ts` (theo dõi kênh nguồn traffic), `scraperProjectRoutes.ts` (scraping dữ liệu thị trường), `server/market/scheduler/qstash.ts` (lịch trình không liên quan TikTok Ads). **Không có route nhận webhook từ TikTok Lead Gen, không có logic HMAC/xác minh chữ ký nào gắn với TikTok.**
- **Kết luận:** Không thể đánh giá HMAC/timing-safe compare/chống replay/raw-body-signing cho một tích hợp không tồn tại trong code hiện tại. Nếu TikTok Lead Gen đang được nối qua một dịch vụ trung gian (Zapier/Make/n8n) gọi vào `/api/public/leads` hoặc một endpoint khác thay vì webhook trực tiếp, cần cung cấp đường dẫn/route cụ thể để audit tiếp — hoặc xác nhận với đội ngũ liệu tích hợp này có thật sự tồn tại trong production hay chỉ đang ở kế hoạch.
- **Đề xuất:** Xác nhận với chủ dự án nguồn thực của lead TikTok hiện tại đổ vào đâu (endpoint nào), rồi audit lại nhóm 3 trên đúng route đó. **Ghi chú tham khảo:** hệ thống đã có sẵn pattern xác minh HMAC + `timingSafeEqual` đúng chuẩn ở nơi khác (`server.ts:4245-4312` cho Mailgun/SendGrid/Postmark, `server/middleware/security.ts:110-138` cho Zalo OA/Facebook) — nếu triển khai webhook TikTok, nên tái dùng đúng pattern này (HMAC SHA-256 trên **raw body**, so sánh bằng `timingSafeEqual`, có kiểm tra timestamp chống replay).

---

## Nhóm 4 — Rate limiting

### 4.1 Endpoint công khai — tổng quan: có rate limit, phân loại theo loại
- **Mức độ:** Không phát hiện (baseline tốt)
- **Vị trí:** `server.ts` — toàn bộ endpoint `/api/public/*` đều gắn limiter: `apiRateLimit` (đọc dữ liệu — listings, articles, bank-rates), `publicLeadRateLimit` (form liên hệ, đăng ký, tuyển dụng, ký gửi — dòng 2289, 2689, 2731, 2784, 2851), `publicListingLeadRateLimit` (lead theo tin đăng — dòng 2126), `livechatRateLimit` (+ `aiRateLimit` cộng thêm cho endpoint gọi AI — dòng 2327-2652, đặc biệt dòng 2372 `POST /api/public/ai/livechat` có cả `livechatRateLimit` VÀ `aiRateLimit`, đúng vì đây là endpoint gọi dịch vụ AI trả phí bên ngoài).
- **Đánh giá:** Không có endpoint public/form/AI nào bị bỏ sót rate limit trong danh sách đã rà.

### 4.2 Rate limit key theo IP có thể bị giả mạo qua header nếu server bị truy cập trực tiếp (không qua Cloudflare)
- **Mức độ:** Medium
- **Vị trí:** `server/middleware/rateLimiter.ts`, hàm `getClientIp` — ưu tiên `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for` → `req.ip`.
- **Mô tả hành vi sai:** Hàm tin tưởng các header `cf-connecting-ip`/`x-real-ip`/`x-forwarded-for` một cách vô điều kiện, không xác minh request có thực sự đi qua Cloudflare/reverse-proxy hợp lệ hay không (không kiểm tra IP nguồn socket có nằm trong dải IP của Cloudflare, không dùng `app.set('trust proxy', ...)` để Express tự xác thực chuỗi proxy).
- **Kịch bản khai thác thực tế:** Nếu server backend (cổng nội bộ hoặc domain `*.replit.dev`/`*.replit.app` gốc) có thể bị truy cập trực tiếp mà không bắt buộc qua Cloudflare, kẻ tấn công tự set header `CF-Connecting-IP: 1.2.3.4` (giá trị ngẫu nhiên đổi mỗi request) trong mỗi lần gọi `POST /api/public/leads` hoặc `POST /api/public/contact` → mỗi request rơi vào một "IP" khác nhau trong bộ đếm rate-limit → **bypass hoàn toàn rate limit theo IP**, cho phép spam form liên hệ/lead hàng loạt hoặc DoS endpoint AI (`aiRateLimit`) khiến tốn chi phí API AI trả phí.
- **Đề xuất:** Xác nhận domain production chỉ nhận traffic qua Cloudflare (chặn truy cập thẳng ở tầng hạ tầng); đồng thời cấu hình `app.set('trust proxy', N)` trong Express khớp đúng số hop thực tế và ưu tiên `req.ip` (đã được Express xác thực theo `trust proxy`) thay vì đọc thẳng header client tự set.

### 4.3 Rate limit store — fallback in-memory khi Upstash không khả dụng
- **Mức độ:** Low
- **Vị trí:** `server/middleware/rateLimiter.ts` (`countInMemory`, `getUpstashClient`).
- **Mô tả:** Khi thiếu `UPSTASH_REDIS_REST_URL`/`TOKEN` hoặc Upstash lỗi, hệ thống fallback về đếm trong bộ nhớ tiến trình (Map). Do deployment là VM (1 process theo `scripts/supervisor.sh`, không phải nhiều instance auto-scale) nên không bị vấn đề "mỗi instance có bộ đếm riêng" — rủi ro thấp trong kiến trúc hiện tại, nhưng cần lưu ý nếu sau này chuyển sang deployment nhiều instance.
- **Đề xuất:** Không khẩn cấp; ghi chú vận hành nếu đổi kiến trúc deploy.

---

## Nhóm 5 — Input validation & SQL Injection

### 5.1 Truy vấn động dùng tham số hoá đúng chuẩn (`$1, $2...`)
- **Mức độ:** Không phát hiện (baseline tốt)
- **Vị trí:** `server/repositories/listingRepository.ts`, `leadRepository.ts` và các repository khác — toàn bộ giá trị người dùng nhập (filter, id, tenant) được truyền qua mảng tham số (`client.query(sql, [values])`), không nối chuỗi trực tiếp giá trị vào câu lệnh.
- **Trường hợp `ORDER BY ${...}` động** (`listingRepository.ts:611-619`): biến `isPopular` là `boolean` suy ra từ `params.sortBy === 'popular'` (so sánh literal, không nối chuỗi từ input), nên hai nhánh `ORDER BY` được chèn vào SQL đều là **chuỗi hardcode cố định**, không phải giá trị người dùng — không có SQL injection ở điểm này dù về hình thức là string-interpolation vào SQL.
- **`checkDuplicatePhone`/`checkDuplicateEmail`** (`leadRepository.ts:339-360`): các hàm `REPLACE(...)`/`LOWER(TRIM(...))` là cú pháp SQL cố định nối vào câu lệnh, còn **giá trị `phone`/`email` luôn đi qua `$1`/`$2`** — không injection được.

### 5.2 Truy vấn không gian địa lý (PostGIS) — không tìm thấy trong codebase hiện tại
- **Mức độ:** Cần kiểm tra thêm
- **Vị trí đã rà:** `server/repositories/listingRepository.ts`, `server/routes/listingRoutes.ts` (grep `ST_DWithin`, `ST_MakePoint`, `ST_Distance`, `earth_distance`, `radius`).
- **Mô tả:** Không tìm thấy hàm PostGIS nào (`ST_*`) hay tính khoảng cách bằng toạ độ trong hai file trên. Chỉ có `geocodeVN`/`fetchNominatim` (`listingRoutes.ts:177-233`) — các hàm này **gọi ra ngoài tới Nominatim** để geocode địa chỉ thành lat/lng, không phải truy vấn PostGIS nội bộ; toạ độ trả về được validate range VN (`lat 8–24, lng 102–110`, dòng 229-233) trước khi dùng.
- **Kết luận:** Nếu tính năng "tìm theo bán kính trên bản đồ" tồn tại ở tầng khác (route/service chưa được liệt kê trong lần rà này, hoặc nằm trong `MapView.tsx` gọi API riêng), cần cung cấp đường dẫn cụ thể để audit — hiện tại không có bằng chứng về nguy cơ SQL injection qua toạ độ/bán kính vì không tìm thấy đoạn code tương ứng.

### 5.3 Validate schema đầu vào — có dùng zod nhưng không đồng nhất 100%
- **Mức độ:** Low
- **Vị trí:** `server/middleware/validation.ts` (`validateBody`, `validateUUIDParam`), dùng ở phần lớn route ghi dữ liệu (`server.ts:349` ví dụ `validateBody(schemas.login)`; `leadRoutes.ts` dùng `validateUUIDParam()` cho mọi `:id`).
- **Mô tả:** Cơ chế validate theo schema (`zod`, dependency có trong `package.json`) được áp dụng nhất quán ở các route quan trọng đã rà (login, leads by id). Không đủ thời gian trong lượt audit này để liệt kê **toàn bộ** route ghi dữ liệu và xác nhận 100% có `validateBody`; cần một lượt rà route-by-route riêng cho khẳng định tuyệt đối.
- **Đề xuất:** Grep toàn bộ `app.post/put/patch` thiếu `validateBody(...)` liền kề để đối chiếu.

### 5.4 Giới hạn phân trang — có kiểm soát
- **Mức độ:** Không phát hiện (baseline tốt)
- **Vị trí:** `server/routes/listingRoutes.ts:314` — `const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 200));`
- **Mô tả:** `pageSize` được clamp trong khoảng [1, 200], tránh việc client yêu cầu `pageSize=999999999` gây quét toàn bảng/DoS bộ nhớ. Các filter số khác (`priceMin/Max`, `areaMin/Max`) đều qua `parseFloat` + kiểm tra `isNaN` trước khi dùng.

---

## Nhóm 6 — CORS

### 6.1 CORS chính (`corsMiddleware`) — whitelist đúng chuẩn ở production
- **Mức độ:** Không phát hiện (baseline tốt)
- **Vị trí:** `server/middleware/security.ts:56-84`.
- **Mô tả:** Production: chỉ phản chiếu `Origin` nếu nằm trong `ALLOWED_ORIGINS` (đọc từ env, hiện set `https://sgsland.vn,https://www.sgsland.vn` trong `.replit:138`) — origin lạ không nhận header CORS (browser tự chặn). Không dùng `*` kèm `Access-Control-Allow-Credentials: true` cùng lúc (kết hợp nguy hiểm này bị trình duyệt chặn nếu có, nhưng ở đây code không tạo ra tổ hợp đó vì origin luôn được echo cụ thể, không phải `*`). Dev: phản chiếu origin bất kỳ — chấp nhận được vì chỉ chạy nội bộ.
- **Lưu ý nhỏ (không tính là lỗi):** Nhánh `else if (isProduction && !allowedOrigins)` không set `Access-Control-Allow-Origin` gì cả nhưng **vẫn set `Access-Control-Allow-Credentials: true`** ở cuối hàm bất kể nhánh nào — vô hại vì thiếu header origin thì trình duyệt vẫn chặn, nhưng nên dọn cho rõ ràng.

### 6.2 Hai route feed công khai set `Access-Control-Allow-Origin: '*'` trực tiếp
- **Mức độ:** Low
- **Vị trí:** `server/routes/publicProjectRoutes.ts:478` (`/api/public/project-feed` hoặc tương tự — JSON-LD ItemList) và `:602` (`/geo-entity-feed`).
- **Mô tả:** Hai route này ghi đè CORS thành `*` (không dùng middleware chung), phục vụ mục đích công khai cho AI crawler/GEO (structured data). Cả hai đều là **GET, không yêu cầu đăng nhập, không có `Allow-Credentials`, không trả dữ liệu nhạy cảm** (danh mục dự án công khai + schema.org). Do không có cookie/credential kèm theo và dữ liệu vốn công khai, rủi ro thực tế thấp.
- **Đề xuất:** Không bắt buộc sửa vì đúng mục đích thiết kế (feed công khai cho AI/SEO), nhưng nên thêm comment giải thích tại chỗ (nếu chưa có) để người sau không nhầm tưởng đây là lỗi cấu hình.

### 6.3 Không phát hiện route leads/CRM/admin/webhook nào mở CORS quá rộng
- **Mức độ:** Không phát hiện
- **Vị trí đã rà:** grep `Access-Control-Allow-Origin` toàn bộ `server.ts` + `server/routes/*` — chỉ có 4 vị trí set header CORS thủ công, 2 ở `security.ts` (whitelist đúng chuẩn) và 2 ở `publicProjectRoutes.ts` (mục 6.2, đã đánh giá thấp rủi ro). Không có route `/api/leads`, `/api/admin`, webhook nào set `*` hay override CORS ngoài middleware chung.

---

## Bảng tổng hợp phát hiện (sắp xếp theo mức độ)

| # | Mức độ | Phát hiện | Vị trí |
|---|---|---|---|
| 1.4 | **High** | 17 endpoint cron/webhook nội bộ dùng `JWT_SECRET.slice(0,32)` làm secret dùng chung khi thiếu secret riêng | `server.ts` (17 vị trí, 4521–6297) |
| 2.1 | **High** | Secret plaintext (`EMAIL_WEBHOOK_TOKEN`) + hash mật khẩu admin ban đầu bị commit trong `.replit` | `.replit:136-137` |
| 1.3 | Medium | `PATCH /api/leads/:id/merge` hardcode role `'ADMIN'`, bỏ qua kiểm tra chủ sở hữu lead | `server/routes/leadRoutes.ts:221-253` |
| 1.2 | Medium | Không có middleware RBAC tập trung — role-check viết tay rải rác, dễ sót khi thêm route mới | Toàn bộ `server/routes/*` |
| 4.2 | Medium | Rate-limit theo IP tin tưởng header client (`CF-Connecting-IP`/`X-Forwarded-For`) không xác thực nguồn gốc — có thể bypass nếu server lộ ra ngoài Cloudflare | `server/middleware/rateLimiter.ts` |
| 1.5 | Low | `GET /check-email`, `/check-phone` không giới hạn role (chỉ cần đăng nhập) | `server/routes/leadRoutes.ts:81,106` |
| 2.2 | Low | File `.env` thật (giá trị placeholder, không commit) tồn tại trong nhánh `sgs-next/` nghi là code cũ | `sgs-next/packages/db/.env` |
| 4.3 | Low | Rate-limit fallback in-memory khi Upstash không khả dụng (chấp nhận được với deploy VM 1-instance hiện tại) | `server/middleware/rateLimiter.ts` |
| 5.3 | Low | Chưa xác nhận 100% route ghi dữ liệu đều có `validateBody` (mới rà mẫu, chưa rà toàn bộ) | `server/middleware/validation.ts` + toàn bộ route POST/PUT/PATCH |
| 6.2 | Low | 2 route feed công khai set CORS `*` trực tiếp (đúng mục đích, rủi ro thấp vì không có credential) | `server/routes/publicProjectRoutes.ts:478,602` |
| 1.7 | Cần kiểm tra thêm | Chưa đối chiếu toàn bộ route admin/platform với middleware `requirePlatformAdmin` | `server.ts:3574` |
| 3.1 | Cần kiểm tra thêm | Không tìm thấy tích hợp webhook TikTok Lead Gen trong code — cần xác nhận route thực tế nếu tồn tại | Toàn bộ `server/**` |
| 5.2 | Cần kiểm tra thêm | Không tìm thấy truy vấn PostGIS trong code đã rà — cần xác nhận nếu tính năng tìm-theo-bán-kính tồn tại ở nơi khác | `server/repositories/listingRepository.ts`, `server/routes/listingRoutes.ts` |

---

## Thứ tự ưu tiên khắc phục

1. **Xoay vòng `EMAIL_WEBHOOK_TOKEN`** và chuyển nó (cùng mọi secret tương tự) từ `.replit [userenv]` sang Replit Secrets; xác nhận/đổi mật khẩu admin ban đầu rồi xoá `INITIAL_ADMIN_PASSWORD_HASH` khỏi file commit. *(2.1 — High)*
2. **Cấp secret riêng, bắt buộc (fail-fast) cho từng cron/webhook nội bộ**, bỏ fallback `JWT_SECRET.slice(0,32)`. *(1.4 — High)*
3. **Sửa `PATCH /api/leads/:id/merge`** để dùng `user.role` thật thay vì hardcode `'ADMIN'`, hoặc thêm role-gate tường minh nếu nghiệp vụ cần merge chéo. *(1.3 — Medium)*
4. **Xác thực chuỗi proxy cho rate-limit theo IP**: cấu hình `trust proxy` đúng số hop và/hoặc chặn truy cập thẳng ngoài Cloudflare ở tầng hạ tầng. *(4.2 — Medium)*
5. **Chuẩn hoá RBAC**: viết `requireRole(...)` middleware dùng chung, áp lại cho toàn bộ route quản trị/CRM để giảm rủi ro sót role-check trong tương lai. *(1.2 — Medium)*
6. Dọn `sgs-next/` nếu không còn dùng; rà lại toàn bộ route ghi dữ liệu để xác nhận 100% có `validateBody`; đối chiếu danh sách route admin với `requirePlatformAdmin`; xác nhận có/không có tích hợp TikTok Lead Gen và tính năng tìm-theo-bán-kính để audit tiếp nếu tồn tại. *(các mục Low / Cần kiểm tra thêm)*

---

*Báo cáo này chỉ dựa trên đọc mã nguồn tĩnh tại thời điểm audit (2026-08-13), không thay thế kiểm thử bảo mật động (pentest) hay rà soát runtime/log thực tế. Các mục "Cần kiểm tra thêm" cần xác minh bổ sung trước khi kết luận mức độ rủi ro cuối cùng.*
