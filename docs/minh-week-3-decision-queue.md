# Minh Week 3 baseline — Decision Queue + Suggest approval

## Scope

Week 3 moves Minh proactive opportunities from observation-only to **Suggest**. A
detector may create a tenant-scoped approval request, but it may not send a provider
message or mutate business data. Approval remains the only path to the next internal
step.

## Action mapping

| Opportunity | Approval action | Approved result |
|---|---|---|
| `COLD_LEAD` | `DRAFT_PROACTIVE_FOLLOWUP` | Creates an internal human question containing a follow-up draft; no provider call |
| `MARKET_PRICE_DRIFT` | `REVIEW_LISTING_PRICE` | Creates an internal review question; listing price is unchanged |
| `CSAT_DROP` | `REVIEW_CSAT_DROP` | Creates an internal review question; customer feedback is not copied |

These are explicit approval action types, not free-form payloads. They are included in
the existing high-impact action vocabulary and use the existing approval/review routes.

## Queue, idempotency, and budget

- Approval requests use `channel='MINH_PROACTIVE'`.
- Every request links to one `source_signal_id`; the database unique index makes
  repeated detector ticks idempotent per tenant.
- Listing and tenant opportunities use `subject_type`/`subject_id`; `lead_id` is
  nullable so a decision cannot be forced onto an unrelated lead.
- The proactive budget is separate from Minh delegation budget and defaults to 20
  suggestions per tenant per calendar day. The claim is serialized with a
  transaction-scoped advisory lock.
- Rejected, approved, and expired requests still count toward the daily budget to
  prevent repeated suggestion spam.

## Approval boundary

The existing approval routes remain the only operator gate. `SUPER_ADMIN`, `ADMIN`,
`MANAGER`, and `TEAM_LEAD` may review the queue. Approving a Week 3 action creates
only an internal human question/draft and records `providerCalled=false` and
`mutation='NONE'`. No Zalo, Facebook, email, listing update, stage update, proposal,
or payment operation is executed by these actions.

The Command Center now shows:

- pending proactive decision queue items;
- action type, subject and rationale;
- tenant/day budget usage;
- approve/reject controls that call the existing approval API.

## Failure behavior

Detector errors remain isolated per detector. Suggestion enqueue failures are logged as
degraded queue work and do not convert a successful read detector into a false
business action. Budget exhaustion returns an explicit `429` for manual suggestion
attempts and stops automatic enqueueing for that tenant.

## Verification target

- Migration registry includes the decision-queue schema changes.
- Unit tests cover approval-boundary decisions and read-only queue UI.
- Full regression, typecheck, migration registry, migration startup, shadow tick,
  health, and unauthenticated overview checks are required before enabling Week 3.