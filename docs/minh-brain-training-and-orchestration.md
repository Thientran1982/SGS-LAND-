# Huấn luyện Minh thành bộ não điều phối của SGS LAND

## 1. Mục tiêu đúng

Minh không nên được "huấn luyện" bằng cách nhồi thêm một prompt dài. Minh cần
là một **supervisor có trạng thái, bằng chứng, quyền hạn và khả năng kiểm tra
kết quả**:

1. Nhận yêu cầu và xác định mục tiêu thật sự.
2. Tách yêu cầu thành các workstream độc lập khi câu hỏi có nhiều phần.
3. Chọn specialist phù hợp, truyền đúng dữ liệu tối thiểu và quyền tối thiểu.
4. Kiểm tra bằng chứng, độ mới và phạm vi tenant trước khi tổng hợp.
5. Không tự thực hiện hành động có tác động cao; tạo đề xuất chờ approval.
6. Học từ kết quả đã được xác nhận, không học trực tiếp từ mọi câu trả lời.
7. Trả lời nhanh theo hai pha: xác nhận/pending trước, câu trả lời có nguồn sau.

Nguyên tắc: **Minh điều phối; specialist thực hiện; tool cung cấp dữ liệu;
approval broker quyết định hành động; con người chịu trách nhiệm cuối cùng.**

## 2. Kiến trúc runtime đề xuất

### Supervisor state machine

Mỗi request cần có `tenantId`, `sessionId`, `requestId`, `leadId` (nếu là
khách), `traceId`, `inputHash` và deadline. State tối thiểu:

```text
RECEIVED
  -> CLASSIFIED
  -> PLANNED
  -> DELEGATED
  -> EVIDENCE_COLLECTED
  -> VERIFIED
  -> SYNTHESIZED
  -> DELIVERED
```

Nhánh lỗi:

```text
CLASSIFIED -> NEEDS_CLARIFICATION
DELEGATED -> PARTIAL / DEGRADED
VERIFIED -> HUMAN_REVIEW
mọi trạng thái -> FAILED_RETRYABLE hoặc FAILED_TERMINAL
```

Không dùng một `500` cho mọi trạng thái. Client phải phân biệt:

- `PENDING`: run vẫn đang chạy; không yêu cầu người dùng gửi lại.
- `DEGRADED`: đã có câu trả lời an toàn nhưng một provider/tool không khả dụng.
- `NEEDS_CLARIFICATION`: thiếu dữ liệu nghiệp vụ.
- `HUMAN_REVIEW`: claim hoặc hành động cần người kiểm tra.
- `FAILED_RETRYABLE`: có thể retry cùng `requestId`.
- `FAILED_TERMINAL`: input hoặc quyền không hợp lệ.

### Các lớp agent

| Lớp | Trách nhiệm | Không được làm |
| --- | --- | --- |
| Supervisor Minh | Phân loại, lập plan, phân quyền, tổng hợp | Tự bịa dữ liệu hoặc vượt quyền |
| Retrieval/market | Giá, listing, khu vực, dự án | Đưa claim không có nguồn/thời điểm |
| Legal/planning | Pháp lý, quy hoạch, caveat | Kết luận pháp lý tuyệt đối |
| Finance/investment | Lãi suất, dòng tiền, ROI | Cam kết lợi nhuận/tín dụng |
| Sales/CRM | Lead, lịch hẹn, chăm sóc | Đổi trạng thái hoặc gửi tin khi chưa được phép |
| Landing/content | Tạo draft, nội dung, SEO | Publish/xóa khi chưa approval |
| Verifier | Kiểm tenant, freshness, provenance, schema | Sửa evidence để ép pass |
| Writer | Viết câu trả lời cuối cùng | Gọi tool hoặc tự thêm fact |
| Human escalation | Nhận câu hỏi có rủi ro | Bị bỏ qua vì model tự tin cao |

Mỗi specialist phải khai báo manifest: `inputSchema`, `outputSchema`,
`readScopes`, `writeScopes`, `maxLatencyMs`, `requiresApproval`,
`evidenceRequirements` và `fallbackPolicy`.

## 3. Quy trình điều phối một câu hỏi

### Bước A — Normalize và phân loại

- Bảo toàn ngôn ngữ khách dùng; không dùng ngôn ngữ UI để thay thế.
- Sinh `requestId` ở client và giữ nguyên tới database, queue, provider log.
- Nhận diện compound intent; tối đa ba workstream độc lập.
- Tách `SEARCH` có bộ lọc giá khỏi `VALUATION`.
- Nếu confidence dưới ngưỡng hoặc hai intent xung đột, hỏi lại một câu ngắn.

### Bước B — Lập kế hoạch có ngân sách

Plan phải chứa:

```json
{
  "workstreams": [
    {"id": "market", "specialist": "market_retrieval", "parallel": true},
    {"id": "legal", "specialist": "legal_qa", "parallel": true}
  ],
  "maxSteps": 6,
  "deadlineMs": 45000,
  "responseMode": "PARTIAL_ALLOWED"
}
```

Ưu tiên tool deterministic/read-only trước LLM. Không chạy router LLM thứ hai
nếu keyword/classifier đã xác định được specialist an toàn. Specialist độc lập
chạy song song; writer chỉ chạy sau khi evidence đã được checkpoint.

### Bước C — Thực thi có checkpoint

Checkpoint bắt buộc:

1. Input guardrail.
2. Supervisor plan.
3. Specialist output kèm `inputHash`, `planHash`, `outputHash`.
4. Evidence verification.
5. Output guardrail.
6. Delivery idempotency.

Retry cùng request phải replay checkpoint tương thích, không gọi provider lại.
Retry khác input hoặc khác plan phải tạo run mới. Lease heartbeat phải tiếp tục
trong toàn bộ specialist run.

### Bước D — Verify trước khi viết

Verifier kiểm:

- tenant và owner của mọi entity;
- source identity hợp lệ, thời điểm và đơn vị;
- evidence có thực sự hỗ trợ claim;
- dữ liệu stale/missing/contradictory;
- quyền gọi tool và quyền thực hiện action;
- PII/secret/prompt injection trong tool output;
- câu trả lời đủ mọi phần của compound question.

Nếu không pass, writer phải nói rõ "chưa xác minh", không chuyển uncertainty
thành câu khẳng định.

### Bước E — Tổng hợp và giao tiếp nhanh

Tách response path khỏi audit/memory path:

- Trong 8 giây đầu: trả lời trực tiếp nếu đã xong, hoặc `202 PENDING` nếu run
  còn chạy.
- Widget không khóa composer nhiều phút; socket/reconcile là nguồn sự thật.
- Khi outbound interaction được ghi, emit một lần theo `agentRunId`.
- Memory, telemetry và journey write chạy background, không giữ HTTP request.

## 4. Chính sách quyền và approval

### Read

Minh được đọc dữ liệu tenant hiện tại theo owner/user/lead scope. Không dùng
memory generic như grounding. Specialist không nhận trực tiếp `tenantId` từ
khách; supervisor lấy tenant từ session/token/server context.

### Suggest

Minh có thể đề xuất:

- đổi intent hoặc specialist;
- tạo draft landing;
- gợi ý listing;
- đề xuất lịch hẹn;
- đề xuất đổi lead stage.

### Act

Các hành động sau luôn qua approval broker và idempotency key riêng:

- publish social/email/landing;
- gửi broadcast;
- đổi trạng thái CRM;
- tạo booking;
- sửa/xóa dữ liệu;
- gửi báo giá hoặc cam kết tài chính.

Approval chỉ xác nhận payload đã được chuẩn hóa; không dùng approval để biến
một provider response mơ hồ thành thành công.

## 5. Huấn luyện bằng dữ liệu và evaluation

Không đưa toàn bộ transcript vào prompt vô thời hạn. Dùng bốn tập dữ liệu có
provenance:

1. **Routing set**: câu hỏi → intent/workstream đúng.
2. **Grounding set**: claim → source bắt buộc và caveat.
3. **Action set**: action → permission/approval/deny.
4. **Conversation set**: lịch sử → câu trả lời ngắn, đúng ngôn ngữ, không lặp.

Mỗi mẫu cần `tenantScope`, `source`, `reviewer`, `labelVersion`, `createdAt`,
`expectedOutcome`. Feedback chưa xác minh chỉ tạo candidate lesson, không
được đưa thẳng vào system prompt.

### Chỉ số bắt buộc

- routing accuracy theo intent và theo compound question;
- grounded-claim precision/recall;
- tool argument validity;
- tenant isolation violations = 0;
- unauthorized action rate = 0;
- duplicate delivery rate = 0;
- P50/P95 first acknowledgement;
- P50/P95 final answer;
- pending-to-delivered success rate;
- provider fallback rate;
- human escalation precision;
- calibration error của confidence;
- replay correctness sau timeout/restart.

### Promotion gate

Một policy/model chỉ được promote khi:

- không có regression critical về tenant, approval, PII hoặc grounding;
- đạt ngưỡng latency và error budget;
- replay cùng request cho cùng kết quả;
- evaluation set giữ nguyên và có holdout set;
- rollback được bằng version/config, không sửa tay database.

## 6. Sổ tay xử lý lỗi chậm và mất tin nhắn

Mỗi request phải truy được bằng:

```text
requestId -> inboundInteractionId -> durableRunId -> traceId
           -> specialist checkpoints -> provider attempts -> outboundInteractionId
```

Log chỉ chứa hash, loại intent, latency, provider/model và mã lỗi; không log
nguyên văn brief, giá, PII hoặc secret.

Phân loại latency:

- `T0`: client tạo request id và hiển thị bubble local;
- `T1`: inbound đã commit;
- `T2`: server acknowledge `202 PENDING`;
- `T3`: specialist evidence xong;
- `T4`: outbound reply commit;
- `T5`: socket delivered/reconciled.

Alert khi `T2` không xuất hiện đúng hạn, `T4-T2` vượt SLO, hoặc `T5` không
khớp với outbound interaction. Không yêu cầu khách bấm gửi lại nếu run đã
được claim.

## 7. Lộ trình triển khai

### Giai đoạn 1 — Reliability

- Chuẩn hóa error contract và request tracing.
- Hoàn tất pending/socket/reconcile path.
- Bổ sung test timeout, duplicate, provider unavailable, DB commit-then-reset.

### Giai đoạn 2 — Supervisor

- Manifest cho specialist.
- Compound planner và evidence verifier riêng.
- Checkpoint/resume theo plan hash.
- Budget theo tenant, session và request.

### Giai đoạn 3 — Governance

- Approval payload schema.
- Human question queue.
- Evaluation dashboard và calibration.
- Shadow mode cho policy mới.

### Giai đoạn 4 — Learning loop

- Thu feedback đã resolve.
- Chạy evaluation định kỳ.
- Tạo candidate lesson có provenance.
- Promote/rollback tự động theo gate; không tự học từ lỗi chưa giải quyết.

## 8. Định nghĩa hoàn thành: chỉ được gọi là "bộ não chủ động"

Minh **chỉ** được gọi là **"bộ não chủ động"** khi mỗi opportunity/decision
đều có một decision dossier hợp lệ và có thể trả lời đầy đủ tất cả câu hỏi sau:

1. **Vì sao phát hiện cơ hội này?** — rationale phải gắn với detector và claim cụ thể.
2. **Evidence nào hỗ trợ?** — mỗi evidence phải có source, claim, tenant và thời điểm quan sát.
3. **Evidence đó còn mới không?** — phải có trạng thái `FRESH`, `STALE` hoặc `UNKNOWN`,
   thời điểm kiểm tra, policy freshness và lý do; không được suy luận missing thành zero.
4. **Dữ liệu thuộc tenant nào?** — dossier và từng evidence phải có tenant scope đã xác minh.
5. **Specialist nào đã chạy?** — ghi tên, trạng thái, run/checkpoint và evidence liên quan.
6. **Specialist nào bị bỏ qua và vì sao?** — phải ghi rõ từng specialist bị skip; nếu không có
   specialist thì phải ghi rõ "không cần chạy" và lý do.
7. **Hành động này là Read, Suggest hay Act?** — action mode và loại action phải là enum,
   không suy ra từ tên detector.
8. **Có cần approval không?** — lưu boolean và lý do. Act/high-impact không được bypass approval.
9. **Nếu retry thì có tạo bản ghi hoặc tin nhắn trùng không?** — phải có idempotency key và
   chính sách replay riêng cho record và message. Provider outcome không rõ không được retry mù.
10. **Nếu model/policy mới lỗi thì rollback về đâu?** — phải có target rollback, trigger và
    trạng thái approval. Target mặc định là policy/model last-known-good hoặc tắt proactive rollout.

Decision dossier thiếu một câu trả lời phải bị fail-closed và không được gắn nhãn
"bộ não chủ động", không được đưa vào Suggest queue. Command Center phải hiển thị
dossier này cạnh opportunity và approval để người vận hành kiểm tra cùng một nguồn sự thật.

Một câu trả lời hay nhưng không truy được nguồn, không biết quyền, không biết retry có
gửi trùng hay không, hoặc không chỉ ra được rollback target không phải là hệ thống đã
được huấn luyện hoàn chỉnh.