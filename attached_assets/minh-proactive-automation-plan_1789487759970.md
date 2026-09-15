# Kế hoạch huấn luyện Minh thành bộ não chủ động & tự động hoá của hệ thống agent (SGS LAND)

> Tài liệu này bổ sung cho `docs/minh-brain-training-and-orchestration.md` đã có trong repo.
> Tài liệu gốc mô tả **kiến trúc/nguyên tắc** một supervisor đúng chuẩn nên như thế nào.
> Tài liệu này khảo sát **hiện trạng code thật** (đã đọc trực tiếp `server/ai/*` và `server/services/*`),
> chỉ ra khoảng cách còn lại, và lên kế hoạch cụ thể để Minh chuyển từ
> **"bộ định tuyến phản ứng theo tin nhắn + vài job nền rời rạc"**
> sang **"bộ não chủ động, tự vận hành cho toàn nền tảng"**.

---

## 1. Hiện trạng thật (đã audit trong code)

### 1.1 Đã có, hoạt động tốt

| Năng lực | File | Ghi chú |
|---|---|---|
| Router LLM chọn 1 specialist + keyword fallback | `server/ai/minhOrchestrator.ts` | Chỉ chọn **đúng một** intent/tool mỗi lần — chưa phải compound planner |
| Delegation engine + ngân sách 24h/tenant | `server/ai/minhBrain.ts` | `MINH_DAILY_DELEGATION_BUDGET`, có cổng LangGraph (`isLangGraphActive`) |
| Đăng ký specialist tập trung | `server/ai/agentOrchestrationRegistry.ts` | 14+ specialist, có `ownerIntent`, nhưng **chưa có manifest đầy đủ** (inputSchema/outputSchema/scopes/SLA) |
| Guardrail input/output | `server/ai/agentGuardrails.ts` | Chống prompt injection (cả tiếng Việt không dấu), chống lộ secret, allowlist tool tự-thực-thi, gate publish/outreach 2 lớp (compliance+SEO+human, hoặc broker+consent) |
| Hợp đồng vận hành | `server/ai/agentOperatingContracts.ts` | `gateAgentOutput` (confidence ≥ 0.7 + có evidence mới được `canAct`), idempotency fingerprint, retry→replan→escalate |
| Event daemon (agent tự nhận việc) | `server/services/agentOperatorDaemon.ts` | Poll `agent_operating_events`, lease + heartbeat 30s, backoff khi DB lỗi, dead-letter sau 5 lần |
| Vòng tự sửa lỗi (self-repair) | `server/services/selfRepairService.ts` | Mỗi 15 phút: reap execution kẹt, resume chat lỗi tạm thời, replay dead-letter đã fix handler, **phát hiện repair-spike (≥3 lỗi giống nhau) → tự tạo `agent_human_questions` hoặc `approvalRequestRepository`** — đây chính là mầm proactive tốt nhất hiện có |
| Nhắc việc quá hạn | `server/services/taskEventHandlers.ts` | task.created → tự đánh dấu "urgent" nếu deadline ≤ 2 ngày, ghi vào memory |
| Follow-up khách hàng theo lịch cố định | `server/services/freeFollowupScheduler.ts`, `sequenceService.ts` | Cron nội bộ 15 phút gọi 2 endpoint email/chat follow-up + xử lý sequence enrollment đến hạn |
| Báo cáo ngày cho admin | `server/services/dailyAdminReportService.ts` | 18:00 Asia/Ho_Chi_Minh, có replay khi gửi email thất bại, có báo cáo ca vận hành Agent kèm theo |
| Vòng học hàng tuần | `server/services/learningCycleRunner.ts` | Chủ nhật 03:00 ICT: evaluate golden-set, adjudicate feedback (chất lượng/độ tin cậy/poisoning), fit trọng số match — **có tạo `draft` candidate nhưng chưa thấy nơi tự động gọi `promoteCandidate`** |
| Cơ chế promote/rollback có gate | `server/services/autonomousLearningService.ts` | `evaluatePromotionGate`, `detectRuntimeRegression`, `promoteCandidate` (SHADOW→CANARY→ACTIVE), `rollbackCandidate` — **đã viết sẵn nhưng chưa thấy được gọi tự động theo lịch** |
| Dashboard sức khỏe Minh | `server/ai/minhHealth.ts` | delegation 7 ngày, tỉ lệ đúng, capability gap, SLO breach — theo tenant, chưa gộp toàn hệ thống |

### 1.2 Khoảng cách so với "bộ não chủ động, tự động hoá thật sự"

1. **Minh chỉ phản ứng, chưa tự đặt câu hỏi "giờ nên làm gì?".**
   Mọi lần Minh chạy đều do có **input bên ngoài** kích hoạt: tin nhắn khách (`INBOUND_MESSAGE`, `LIVE_CHAT_MESSAGE`), task event, hoặc tick cron cố định giờ. Không có vòng lặp nào để Minh **tự quét toàn tenant, tự xếp hạng cơ hội/rủi ro, và tự đề xuất việc cần làm** — kiểu "lead X im lặng 3 ngày dù đã hẹn xem nhà", "listing Y định giá lệch 20% so với thị trường tuần này", "landing Z tạo nháp 5 ngày chưa ai duyệt".
   → Đây là **khoảng cách lớn nhất** giữa "router phản ứng" và "brain chủ động".

2. **5 job nền chạy độc lập, không ai là "não" điều phối chung.**
   `agentOperatorDaemon`, `selfRepairService`, `freeFollowupScheduler`, `dailyAdminReportService`, `learningCycleRunner` đều tự khởi động timer riêng, tự quyết định riêng. Minh (`minhBrain`/`minhOrchestrator`) **không đọc, không xếp hạng, không tổng hợp** kết quả của các job này thành một bức tranh vận hành duy nhất. Ghép chúng lại dưới một "Brain Scheduler" là điều kiện để nói Minh "đúng là bộ não hệ thống".

3. **Compound planning chưa tồn tại trong code**, dù đã được thiết kế trong tài liệu gốc (mục 3B).
   Prompt hiện tại ép LLM "chọn **ĐÚNG MỘT** specialist" (`minhOrchestrator.ts`). Một câu hỏi ghép (vd: "so với mặt bằng giá khu vực thì có nên vay mua không, pháp lý sổ hồng riêng có ổn không") hiện chỉ được gán 1 intent, phần còn lại bị bỏ qua — đúng với gotcha "Minh không tự thực hiện hành động có tác động cao" nhưng vi phạm nguyên tắc "trả lời đủ mọi phần của compound question" ở mục 3D tài liệu gốc.

4. **Specialist chưa có manifest chuẩn hoá** (inputSchema/outputSchema/readScopes/writeScopes/maxLatencyMs/requiresApproval/evidenceRequirements) như tài liệu gốc yêu cầu — hiện chỉ có `role`, `intents`, `mode`, `ragDomains` trong registry.

5. **Vòng học chưa khép kín tự động.** `learningCycleRunner` tạo candidate (`fitWeights`) nhưng không thấy lịch nào gọi `promoteCandidate`/`rollbackCandidate` sau đó — nghĩa là "học" dừng ở bước tạo đề xuất, con người phải tự vào xem và promote thủ công (nếu có UI), chưa phải "tự động hoá" đúng nghĩa Giai đoạn 4.

6. **Không có "Decision Queue" chủ động thống nhất.** `agent_human_questions` và `approvalRequestRepository` đã tồn tại (dùng cho self-repair, marketing approval...) nhưng mỗi nơi tạo câu hỏi/đề xuất theo cách riêng, chưa có một nơi Minh xếp hạng ưu tiên toàn bộ đề xuất chủ động (business + vận hành) cho admin duyệt trong một hàng đợi.

7. **Không có kill-switch / rate-limit riêng cho hành vi chủ động.** Ngân sách 24h hiện chỉ tính theo lượt Minh trả lời khách (`agent_runs` với `trigger_source ILIKE 'minh%'`), chưa có ngân sách riêng cho số hành động Minh **tự khởi xướng** (không phải do khách hỏi) — rủi ro spam nếu proactive loop lỗi.

**Kết luận hiện trạng:** hạ tầng "reliability" (Giai đoạn 1) và một phần "learning loop" (Giai đoạn 4) đã có nền khá tốt. Phần thiếu nhiều nhất là **Giai đoạn 2 (Supervisor: compound planning, manifest, decision queue)** và **tính chủ động thật sự (proactive scanning)** — đây là trọng tâm của kế hoạch huấn luyện dưới đây.

---

## 2. Định nghĩa "chủ động" và "tự động hoá" cho Minh (để đo lường được, không chỉ là khẩu hiệu)

- **Chủ động (proactive)** = Minh tự phát hiện một sự kiện/mẫu hình đáng chú ý **mà không cần ai hỏi**, tự xếp hạng mức độ quan trọng, và tự đề xuất bước tiếp theo (draft/suggest), trong đúng phạm vi quyền hạn `Read/Suggest/Act` đã định nghĩa ở tài liệu gốc mục 4.
- **Tự động hoá (automation)** = một khi đề xuất đã ở dạng chuẩn hoá và (nếu cần) được duyệt, Minh tự thực thi, tự ghi log, tự học từ kết quả — **không cần người vận hành bấm nút cho từng bước trung gian** (vẫn cần người duyệt cho hành động tác động cao, nhưng không cần người "nhắc" Minh chạy).
- Minh **không được** tự nới quyền của chính nó. Mọi hành động "Act" (publish, gửi outreach, đổi trạng thái CRM, tạo booking, sửa/xoá dữ liệu, cam kết tài chính) **vẫn luôn** đi qua approval broker như tài liệu gốc đã chốt — kế hoạch này không thay đổi ranh giới đó, chỉ tự động hoá phần "phát hiện → đề xuất → chờ duyệt → thực thi khi đã duyệt → học lại".

---

## 3. Kiến trúc bổ sung: "Minh Proactive Brain Loop"

```text
                 ┌─────────────────────────────────────────────┐
                 │            MINH BRAIN SCHEDULER              │
                 │   (tiến trình mới, thay thế 5 timer rời rạc) │
                 └───────────────┬───────────────────────────────┘
                                 │ mỗi N phút / theo cấu hình tenant
                                 ▼
   ┌──────────────────────── OBSERVE ─────────────────────────────┐
   │ Opportunity & Anomaly Detectors (đọc-only, chạy song song):   │
   │ • Lead nguội (không tương tác X ngày, đã hẹn nhưng chưa xác   │
   │   nhận, điểm score cao nhưng chưa được liên hệ)               │
   │ • Listing lệch giá thị trường (so kết quả valuation vs giá    │
   │   niêm yết, đã có sẵn AVM 9 hệ số)                             │
   │ • Landing/content nháp tồn đọng chưa duyệt quá X ngày         │
   │ • CSAT trung bình giảm / lowCsatReasons tăng đột biến          │
   │   (đã có sẵn trong dailyAdminReportService)                    │
   │ • capability_gap / repair_spike tăng (đã có signal sẵn)        │
   │ • ngân sách delegation gần chạm trần (đã có getBudgetStatus)   │
   │ • sequence/automation bị kẹt (processDueSequenceEnrollments   │
   │   claimed=0 nhiều chu kỳ liên tiếp dù có enrollment mới)       │
   └───────────────┬────────────────────────────────────────────┘
                   ▼
   ┌──────────────────────── PRIORITIZE ───────────────────────────┐
   │ Decision Queue thống nhất (bảng mới, vd `agent_opportunities`)│
   │ mỗi phát hiện = 1 hàng: loại, tenant, mức ảnh hưởng, độ tin    │
   │ cậy, hành động đề xuất, cấp quyền cần (Suggest/Act), TTL       │
   └───────────────┬────────────────────────────────────────────┘
                   ▼
   ┌──────────────────────── DECIDE ───────────────────────────────┐
   │ Compound planner nâng cấp của minhOrchestrator: cho phép tối   │
   │ đa 3 workstream song song, mỗi workstream 1 specialist theo    │
   │ manifest — TÁI SỬ DỤNG agentOrchestrationRegistry hiện có,     │
   │ chỉ thêm bước tách/gộp intent trước khi gọi minhBrain          │
   └───────────────┬────────────────────────────────────────────┘
                   ▼
   ┌──────────────────────── ACT (gated) ──────────────────────────┐
   │ Read → tự làm ngay. Suggest → ghi draft + tạo approval request │
   │ (dùng approvalRequestRepository/agent_human_questions có sẵn). │
   │ Act tác động cao → LUÔN qua evaluateMarketingApproval /        │
   │ HIGH_IMPACT_ACTIONS đã có trong agentGuardrails.ts — KHÔNG bỏ  │
   │ qua bước này dù là do Minh tự khởi xướng hay do khách hỏi.     │
   └───────────────┬────────────────────────────────────────────┘
                   ▼
   ┌──────────────────────── LEARN ────────────────────────────────┐
   │ Kết quả (được duyệt/bị từ chối/khách phản hồi) → agent_signals │
   │ → learningCycleRunner (đã có) → PHẢI nối thêm bước tự động gọi │
   │ promoteCandidate/rollbackCandidate theo gate, không dừng ở     │
   │ bước tạo draft như hiện tại                                    │
   └────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc thiết kế bắt buộc giữ nguyên** (không đổi so với tài liệu gốc):
Minh điều phối; specialist thực hiện; tool cung cấp dữ liệu; approval broker quyết định hành động tác động cao; con người chịu trách nhiệm cuối cùng. Vòng lặp chủ động ở trên chỉ tự động hoá phần "phát hiện + đề xuất + học", **không** tự động hoá phần "quyết định hành động tác động cao".

---

## 4. Lộ trình triển khai theo sprint (mỗi sprint ~1–2 tuần)

### Sprint 1 — Hợp nhất scheduler + đo lường nền tảng
- Gộp 5 timer rời rạc (`agentOperatorDaemon`, `selfRepairService`, `freeFollowupScheduler`, `dailyAdminReportService`, `learningCycleRunner`) dưới **một** `minhBrainScheduler.ts` khởi động ở entrypoint server, log tập trung theo `traceId`.
- Thêm bảng `agent_opportunities` (hoặc tái dùng `agent_signals` với `signalType='proactive_opportunity'` nếu muốn tránh migration) để chuẩn hoá "một phát hiện chủ động".
- Mở rộng `minhHealth.ts` thành **Minh Brain Command Center**: gộp `getMinhBrainHealth` + `dailyAdminReportService` metrics + `autonomousLearningService.listDashboard` vào 1 endpoint duy nhất cho admin xem toàn cảnh.
- *Deliverable:* 1 endpoint `/api/internal/minh-brain/overview`, 1 file scheduler mới, không đổi hành vi nghiệp vụ hiện có (refactor an toàn trước).

### Sprint 2 — Opportunity detectors (chỉ Read, chưa Act)
- Viết 3 detector đầu tiên (ưu tiên theo giá trị kinh doanh): lead nguội, listing lệch giá thị trường, CSAT giảm bất thường. Mỗi detector là 1 hàm thuần đọc dữ liệu tenant hiện có (không tool mới, tái dùng `get_valuation`, `get_market_stats`, `ai_feedback`).
- Mỗi phát hiện ghi vào `agent_opportunities`/`agent_signals`, **chưa** tự gửi gì cho khách — chỉ hiển thị trong Command Center để admin quan sát 1–2 tuần, đo false-positive rate trước khi cho Minh tự đề xuất hành động.
- *Deliverable:* dashboard liệt kê cơ hội theo mức ưu tiên; chưa có nút "duyệt hành động" (đó là Sprint 3).

### Sprint 3 — Decision Queue + Suggest có approval
- Nối mỗi opportunity với 1 hành động đề xuất cụ thể (vd: "soạn tin nhắn follow-up cho lead X" → tạo `approvalRequestRepository` draft, KHÔNG tự gửi).
- Áp dụng lại đúng `evaluateMarketingApproval`/`HIGH_IMPACT_ACTIONS` đã có — không viết luật duyệt mới, chỉ route qua cổng cũ.
- Thêm ngân sách riêng cho hành động **tự khởi xướng** (khác ngân sách delegation theo yêu cầu khách), theo tenant/ngày, tái dùng cấu trúc `getBudgetStatus`.
- *Deliverable:* admin thấy hàng đợi đề xuất chủ động, bấm duyệt/từ chối; mọi hành động qua duyệt mới thực thi.

### Sprint 4 — Compound planner cho minhOrchestrator
- Nâng `buildMinhOrchestratorPrompt` để trả về **mảng tối đa 3 intent** thay vì 1 intent (giữ tương thích ngược: nếu chỉ 1 intent, hành vi y hệt hiện tại).
- `minhBrain.ts`: chạy các specialist độc lập song song (`Promise.all` có giới hạn), gộp evidence trước khi writer tổng hợp — đúng nguyên tắc "writer chỉ chạy sau khi evidence đã checkpoint" ở tài liệu gốc.
- Thêm bước verify tối thiểu trước khi trả lời khách: kiểm tra mỗi claim nhạy cảm (giá/pháp lý) có nguồn hay không — tái dùng `SENSITIVE_CLAIM_PATTERN`/`hasUsableEvidenceSources` đã có trong `agentGuardrails.ts`, chỉ cần gọi chúng ở đúng chỗ cho compound flow.
- *Deliverable:* Minh trả lời được câu hỏi ghép 2–3 phần trong 1 lượt, có test hồi quy so với keyword fallback cũ.

### Sprint 5 — Khép kín vòng học tự động
- Thêm lịch (nối vào scheduler Sprint 1) gọi `evaluatePromotionGate` + `promoteCandidate`/`rollbackCandidate` ngay sau khi `learningCycleRunner` tạo candidate mới — hiện đang dừng ở bước tạo draft.
- Thêm `detectRuntimeRegression` chạy so sánh candidate đang ACTIVE với 24h gần nhất; tự rollback nếu vượt ngưỡng, tự ghi `ai_promotion_decisions` (đã có sẵn cấu trúc, chỉ cần lịch gọi).
- *Deliverable:* một candidate tốt tự đi từ SHADOW → CANARY → ACTIVE mà không cần thao tác tay, có thể rollback tự động, mọi bước có audit log.

### Sprint 6 — Manifest hoá specialist + mở rộng detector
- Bổ sung `inputSchema`/`outputSchema`/`readScopes`/`writeScopes`/`maxLatencyMs`/`requiresApproval`/`evidenceRequirements` cho từng dòng trong `AGENT_ORCHESTRATION_REGISTRY` (tăng dần, không cần làm hết 1 lần — ưu tiên specialist có `mode: 'specialist'` đang được compound planner gọi nhiều nhất theo signal thực tế).
- Thêm detector còn lại theo nhu cầu thực tế đo được ở Sprint 2 (vd: landing tồn đọng, sequence bị kẹt, ngân sách gần cạn).

---

## 5. Dữ liệu huấn luyện — biến 4 tập dữ liệu trong tài liệu gốc thành pipeline thật

| Tập | Nguồn có sẵn trong DB | Cách gắn provenance |
|---|---|---|
| Routing set | `agent_signals` (`minh_delegation`, `minh_delegation_result`) | Đã có `delegationToken`, `confidence`, `source` (`MINH_LLM`/`KEYWORD_FALLBACK`) — chỉ cần export định kỳ thành fixture có review |
| Grounding set | `ai_feedback` + evidence trong `agent_executions` | Lọc theo `signalEligible` từ `assessFeedback` đã có sẵn |
| Action set | `agent_human_questions`, `ai_promotion_decisions`, `approvalRequestRepository` | Nhãn "được duyệt/bị từ chối" đã là ground-truth thật, không cần gán tay |
| Conversation set | `interactions`, `ai_golden_set_cases` | `ai_golden_set_cases` đã có category `match`/`valuation`; cần thêm category `compound_question` cho Sprint 4 |

Nguyên tắc giữ nguyên từ tài liệu gốc: **feedback chưa xác minh chỉ tạo candidate lesson, không đưa thẳng vào system prompt** — pipeline trên không thay đổi nguyên tắc này, chỉ tự động hoá bước trích xuất.

---

## 6. Chỉ số bắt buộc theo dõi khi Minh "chủ động" hơn (thêm vào KPI đã có ở tài liệu gốc mục 5)

- **Opportunities surfaced / ngày** theo loại detector.
- **Tỉ lệ đề xuất được duyệt** (approved / total suggested) — theo dõi theo tenant, cảnh báo nếu quá thấp (detector kém chất lượng) hoặc quá cao gần 100% liên tục (có thể đang duyệt qua loa, cần audit).
- **False-positive rate** của từng detector (đề xuất bị admin từ chối kèm lý do "không đúng").
- **Thời gian từ phát hiện → đề xuất → duyệt → thực thi** (T_detect, T_propose, T_approve, T_execute).
- **Số hành động tự động hoá hoàn toàn** (Read, không cần duyệt) vs **số hành động cần duyệt** — theo dõi tỉ lệ để biết mức độ "tự động hoá" thực chất, tránh nhầm giữa "chủ động" (phát hiện) và "tự động" (thực thi không cần người).
- **Tỉ lệ candidate được tự động promote/rollback thành công** (Sprint 5) — 0 lần cần can thiệp tay là mục tiêu, nhưng luôn có thể can thiệp tay khi cần.

---

## 7. Guardrail bổ sung riêng cho hành vi chủ động (không thay guardrail cũ)

1. **Ngân sách riêng cho hành động tự khởi xướng** (mục 3 Sprint 3) — tách khỏi ngân sách trả lời khách, tránh vòng lặp lỗi tạo hàng trăm đề xuất/giờ.
2. **Rate-limit theo lead/tenant**: một lead không bị Minh "chủ động" đề xuất liên hệ quá 1 lần/ngày dù nhiều detector cùng phát hiện vấn đề trên lead đó — cần dedupe theo `leadId` trước khi tạo approval request.
3. **Kill-switch toàn cục và theo tenant** cho riêng proactive loop (biến môi trường tương tự `AI_ORCHESTRATION_MODE`), tắt được ngay lập tức mà không ảnh hưởng luồng phản hồi khách hàng đang chạy tốt.
4. **Không đổi ranh giới Suggest/Act đã chốt** — mọi hành động tác động cao (publish, outreach, đổi stage, booking, sửa/xoá, cam kết tài chính) tiếp tục bắt buộc qua `evaluateMarketingApproval`/`HIGH_IMPACT_ACTIONS`, bất kể ai/cái gì khởi xướng.
5. **Regression tự rollback bắt buộc có audit** — không được tự động promote nếu thiếu holdout set hoặc thiếu `minSamples`, giữ đúng "Promotion gate" đã định nghĩa.

---

## 8. Định nghĩa hoàn thành (mở rộng mục 8 tài liệu gốc)

Minh được xem là **"bộ não chủ động, tự động hoá"** khi, ngoài các tiêu chí đã có trong tài liệu gốc (giải thích được vì sao chọn specialist nào, dùng evidence nào, quyền nào đã kiểm tra, resume/replay chính xác), Minh còn:

- Tự phát hiện và xếp hạng được cơ hội/rủi ro **mà không cần ai hỏi**, với false-positive rate đo được và giảm dần theo thời gian.
- Có **một** nơi duy nhất (Command Center) để admin thấy toàn bộ trạng thái vận hành + đề xuất chủ động, thay vì rải rác nhiều báo cáo/timer.
- Trả lời đúng và đủ câu hỏi ghép nhiều phần trong một lượt.
- Tự đưa một candidate học tốt từ draft → production mà không cần thao tác tay, và tự rollback khi có regression — có audit log đầy đủ cho cả hai chiều.
- Mọi hành động tác động cao vẫn luôn dừng lại chờ người duyệt — "chủ động" không có nghĩa là "tự quyết định thay người" ở những việc rủi ro cao.

---

## 9. Rủi ro chính & cách giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Proactive loop tạo spam đề xuất do detector lỗi | Rate-limit + ngân sách riêng (mục 7.1–7.2) + giai đoạn Read-only 1–2 tuần trước khi cho Suggest (Sprint 2 trước Sprint 3) |
| Compound planner làm chậm thời gian phản hồi khách | Giữ giới hạn tối đa 3 workstream song song, tái dùng `deadlineMs`/`responseMode: PARTIAL_ALLOWED` đã thiết kế sẵn trong tài liệu gốc |
| Tự động promote candidate xấu ra production | Bắt buộc `evaluatePromotionGate` + `detectRuntimeRegression` chạy trước mọi promote, có holdout set, có rollback tự động (Sprint 5 không được bỏ qua bước gate) |
| Hợp nhất 5 scheduler gây lỗi vận hành đang chạy tốt | Sprint 1 là refactor thuần (đổi nơi gọi, không đổi logic nghiệp vụ), triển khai song song (feature flag) trước khi tắt scheduler cũ |
| Vi phạm cách ly tenant khi gộp dữ liệu vào Command Center | Mọi truy vấn tổng hợp vẫn phải qua `withTenantContext`/RLS như toàn bộ codebase đang làm, không dùng `withRlsBypass` ngoại trừ các chỗ đã có sẵn (vd gửi báo cáo) |

---

## Bước tiếp theo đề xuất

1. Duyệt phạm vi Sprint 1–2 trước (rủi ro thấp nhất, giá trị đo lường được ngay: Command Center + detector read-only).
2. Chạy detector read-only 1–2 tuần thu thập false-positive rate thật trước khi mở Suggest (Sprint 3).
3. Song song, có thể bắt đầu thiết kế schema `inputSchema`/`outputSchema` cho 2–3 specialist quan trọng nhất (Sprint 6) mà không cần chờ các sprint trước xong, vì đây là công việc độc lập.
