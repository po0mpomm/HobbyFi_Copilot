# TRD: HobbyFi Copilot — AI Assistant for the Vendor Portal

**Owner:** Eng — HobbyFi (Clam.AI Venture Pvt. Ltd.)
**Doc status:** Draft v1
**Companion doc:** `HobbyFi_Copilot_PRD.md` (this TRD implements PRD §6–§11; section numbers below cross-reference it)
**Surface:** partner.hobbyfi.in (Vendor Portal), Phase 1 = Play + Pass tracks

---

## 1. Purpose & Scope

This TRD specifies the system architecture, APIs, data contracts, prompt/tool design, and guardrail implementation needed to ship HobbyFi Copilot Phase 1: natural-language **read** Q&A and approval-gated **write** actions for Play-track and Pass-track vendors, per PRD §15 Phasing.

It does not re-derive product rationale (see PRD §1–§5); it defines *how* the system is built so that:
- reads are fast and vendor-scoped,
- writes are never auto-executed,
- KYC/financial fields are structurally unreachable by the assistant, and
- every action is auditable.

## 2. Architecture Overview

```
┌─────────────────────┐
│  Vendor Portal (Web) │
│  Copilot Chat Panel  │
└──────────┬───────────┘
           │ HTTPS (session-authenticated)
           ▼
┌───────────────────────────────────────────────────────────┐
│                 Copilot Gateway (BFF)                      │
│  - Session/auth validation (reuses portal session)         │
│  - Rate limiting                                            │
│  - Request/response logging                                 │
└──────────┬───────────────────────────────┬─────────────────┘
           │                               │
           ▼                               ▼
┌────────────────────┐         ┌────────────────────────────┐
│ Orchestrator        │         │  Copilot Audit Service      │
│  Service            │◄───────►│  (writes to                 │
│  - Intent routing   │  logs   │   copilot_audit_log)        │
│  - Context/session  │         └────────────────────────────┘
│    memory           │
│  - Tool-calling loop│
│  - Track-aware tool │
│    registry filter  │
└──────────┬──────────┘
           │ function/tool calls (JSON)
           ▼
┌───────────────────────────────────────────────────────────┐
│                     Tool Layer (server-side)                │
│  ┌─────────────────┐        ┌──────────────────────────┐   │
│  │ Read Tools       │        │ Write Tools               │   │
│  │ (query builders, │        │ (diff builders — always   │   │
│  │  vendor_id-      │        │  return "proposed", never │   │
│  │  scoped)         │        │  commit directly)         │   │
│  └────────┬─────────┘        └────────────┬──────────────┘   │
└───────────┼───────────────────────────────┼──────────────────┘
            │                               │ (only on Approve)
            ▼                               ▼
┌────────────────────┐         ┌────────────────────────────┐
│ Read replicas /     │         │ Existing Portal Services    │
│ analytics store     │         │ (booking svc, membership    │
│ (bookings, MRR,     │         │  svc, payout svc, community  │
│  trials, etc.)      │         │  svc, notification svc)      │
└─────────────────────┘         └──────────────┬──────────────┘
                                                │
                                                ▼
                                     ┌────────────────────┐
                                     │ Source-of-truth DB  │
                                     │ (owned by existing  │
                                     │  portal services)   │
                                     └────────────────────┘
                                                ▲
                              (excluded entirely: pan_number,
                               bank_account, gst_number — never
                               exposed to any tool or the LLM)

              ┌───────────────────────┐
              │  LLM Provider          │
              │  (Claude, via          │
              │   Anthropic API,       │
              │   tool use / function  │
              │   calling)             │
              └───────────────────────┘
```

**Key architectural decision:** Copilot never writes directly to the source-of-truth database. All writes are executed through the *same* internal APIs the portal UI already calls (booking service, membership service, payout/notification service). This guarantees Copilot can't bypass business logic (e.g., billing recalculation, notification fan-out) that already lives in those services, and keeps a single write path to audit.

## 3. Components

| Component | Responsibility | Notes |
|---|---|---|
| **Copilot Chat Panel (frontend)** | Renders conversation, confirmation cards (diff view + Approve/Edit/Reject), streams responses. | Side panel or command bar embedded in existing portal SPA. |
| **Copilot Gateway (BFF)** | Terminates the portal's existing session/auth; attaches `vendor_id`, `staff_user_id`, `role`, `active_track(s)` to every request from server-side session data (never trusts client-supplied vendor context). | Thin layer; no business logic. |
| **Orchestrator Service** | Owns the conversation loop: builds the system prompt (track-aware), calls the LLM with the filtered tool registry, executes tool calls, streams the model's response, manages session memory. | Stateless per-request; session state persisted in a session store (§6). |
| **Tool Layer** | Read tools (pure queries) and write tools (diff generators). Every tool function independently re-derives and enforces `vendor_id`/`venue_id` scope server-side — it does not trust scope implied by the LLM's arguments. | This is the primary guardrail enforcement point (PRD §11). |
| **Copilot Audit Service** | Persists every proposed action, its diff, approval/rejection, and execution result to `copilot_audit_log`. Read-only from Copilot's own perspective once written (append-only). | Also serves the "view full report" traceability links (PRD FR-8). |
| **Existing Portal Services** | Booking, membership, payout, and (future) community services — unchanged; Copilot calls their existing internal APIs for both reads (where a live query is cheaper than a replica) and all writes. | No new source-of-truth logic introduced by Copilot. |
| **LLM Provider** | Claude via the Anthropic Messages API, tool-use enabled, model selection per §6.1. | See `product-self-knowledge` skill for current model identifiers before finalizing model choice in implementation. |

## 4. Data Flows

### 4.1 Read flow (sequence)

1. Vendor sends a message → Gateway attaches `{vendor_id, venue_ids[], role, active_track}` from session.
2. Orchestrator loads session context (recent turns) and builds the system prompt + **tool registry filtered to the vendor's active track(s)** (PRD FR-11) — e.g., a Play-only vendor's registry contains no `get_mrr_snapshot` or `list_trial_active_members` tools at all; they are not merely instructed not to use them.
3. Orchestrator calls Claude with the user turn + filtered tools.
4. Claude emits one or more tool-use calls (e.g., `get_revenue(vendor_id, venue_id?, date_range)`).
5. Tool Layer executes against the vendor's own data only — the tool function itself re-applies `WHERE vendor_id = :session_vendor_id`, ignoring/overriding any vendor_id-like value the model might have hallucinated into arguments.
6. Tool result returned to Claude → Claude composes the final natural-language answer, optionally with a compact table, plus a portal deep link for verification (PRD FR-8).
7. Response streamed to the chat panel. Turn logged (read-only log, lighter retention than write audit log — see §11).

### 4.2 Write flow (sequence, approval-gated)

1. Vendor sends a request implying a change (e.g., "extend Rahul's trial by 3 days").
2. Orchestrator resolves entities via read tools first (e.g., `find_user(name="Rahul", venue_id)`) — if multiple matches, Claude asks one clarifying question (PRD §7.3) instead of guessing.
3. Once resolved, Claude calls a **write tool** (e.g., `propose_trial_extension(trial_id, extra_days)`).
4. The write tool **never commits**. It returns a structured **diff object**:
   ```json
   {
     "action_type": "extend_trial",
     "target": {"entity": "trials", "id": "trial_789"},
     "current_value": {"end_date": "2026-07-15"},
     "proposed_value": {"end_date": "2026-07-18"},
     "downstream_effects": ["next billing/renewal check shifts by 3 days"],
     "requires_extra_confirmation": false
   }
   ```
5. Orchestrator persists this as a row in `copilot_audit_log` with `status = "proposed"`, and the diff is rendered as a **confirmation card** in the chat panel.
6. Vendor taps **Approve**, **Edit** (adjust proposed value, re-render diff, re-log), or **Reject** (log `status = "rejected"`, nothing executed).
7. On **Approve**: Orchestrator calls the corresponding **execute** function, which calls the real portal API (e.g., membership service's trial-extension endpoint) using the *same* auth context a portal-UI-driven request would use.
8. Execution result (success/failure) updates `copilot_audit_log.status` to `"executed"` or `"failed"`, records `approved_by` and `executed_at`, and is confirmed back to the vendor in chat.
9. Actions flagged `requires_extra_confirmation = true` (e.g., cancelling a multi-participant paid booking, removing a community member, sending a push notification above an audience-size threshold — see PRD §11 and Open Questions) render a second, more explicit warning before the Approve button is enabled.

### 4.3 Community-track notification write (example of a "soft" write)

Per PRD FR-13, "invite members to an event" is technically a write (it triggers an outbound message), but has no data mutation to roll back. It still follows the identical draft → approve → send lifecycle:
- Draft includes exact notification text and computed **audience size** (`member_count` for the community).
- No execution occurs until Approve.
- Logged with `resolved_action_type = "send_event_notification"` for audit and future rate-limiting.

## 5. Tool Registry (function-calling contract)

All tools are exposed to the LLM as Anthropic tool-use definitions. Representative subset (Phase 1, Play + Pass):

| Tool name | Type | Track | Params | Server-side enforcement |
|---|---|---|---|---|
| `get_revenue` | read | Play, Pass | `venue_id?`, `date_range` | scoped to session `vendor_id` |
| `list_bookings` | read | Play | `venue_id?`, `status?`, `date_range` | scoped to session `vendor_id` |
| `get_occupancy` | read | Play | `venue_id`, `date_range` | scoped to session `vendor_id`, venue must belong to vendor |
| `get_payout_summary` | read | Play | `venue_id?`, `period` | scoped to session `vendor_id` |
| `get_mrr_snapshot` | read | Pass | `venue_id?`, `date_range` | scoped to session `vendor_id` |
| `list_memberships` | read | Pass | `plan_id?`, `status?` | scoped to session `vendor_id` |
| `list_trials` | read | Pass | `status?`, `expiring_within_days?` | scoped to session `vendor_id` |
| `get_coach_schedule` | read | Pass | `staff_id`, `date_range` | staff must belong to vendor |
| `find_user` | read | Play, Pass | `name`, `venue_id?` | results limited to users with a booking/membership at this vendor's venues only — never a global user search |
| `propose_trial_extension` | write (diff) | Pass | `trial_id`, `extra_days` | trial must belong to vendor |
| `propose_membership_date_update` | write (diff) | Pass | `membership_id`, `new_end_date` | membership must belong to vendor |
| `propose_no_show_mark` | write (diff) | Play | `booking_id` | booking must belong to vendor |
| `propose_booking_cancellation` | write (diff) | Play | `booking_id`, `reason` | `requires_extra_confirmation=true` if `booking_participants` count > 1 |
| `execute_action` | execute | Play, Pass | `audit_log_id` | only callable after `status="approved"`; re-validates diff hasn't gone stale before calling the real portal API |

**Explicitly absent from any tool definition, at the registry level (not just prompt instruction):** `pan_number`, `bank_account.*`, `gst_number`, commission-rate fields, any other vendor's `vendor_id`. There is no code path by which the LLM can request these — the fields don't exist in any tool's return schema or parameter set (PRD FR-12, §11).

## 6. Orchestration & Prompting

### 6.1 Model & session

- Model: Claude, tool-use enabled (confirm current recommended model/version against `product-self-knowledge` skill / Anthropic docs at implementation time rather than hardcoding here).
- Each chat turn is a stateless API call; **conversation state is not held by the model** — the Orchestrator reconstructs the message history (or a summarized window) from the session store on every call, per PRD FR-10.
- Session store: keyed by `(vendor_id, staff_user_id, conversation_id)`, holds turn history and any in-flight (unapproved) proposed diffs so a vendor can approve/reject in a later message ("yes go ahead") without re-stating the request.

### 6.2 System prompt construction (per request, server-assembled — not user-editable)

Includes:
1. Fixed operating rules: never fabricate data, always cite the tool result behind a numeric claim, never suggest workarounds for scope boundaries, always produce a diff (never a direct claim of "done") for any write.
2. **Track-aware tool list** — only tools relevant to `active_track(s)` are included in the `tools` array of the API call (this is what actually prevents cross-track leakage — the model literally cannot call a tool it wasn't given, independent of prompt wording).
3. Vendor context: `vendor_id` (used for logging correlation only, never trusted from model output for scoping), `venue_id`s the staff role has access to, current date/timezone.
4. Multi-venue default: "assume all venues the vendor is scoped to, unless the vendor names one" (PRD FR-9).

### 6.3 Ambiguity & refusal handling

- Ambiguous entity match (e.g., two "Rahul"s) → model is instructed to call `find_user` first, and if it returns >1 candidate, ask a single clarifying question before proposing any write (PRD §7.3, FR-6).
- Out-of-scope request (commission rate, cross-vendor data, messaging all end users outside a community-event context) → no matching tool exists in the registry; system prompt instructs the model to decline and point to the right portal screen or support contact (PRD FR-7).

## 7. Guardrail Implementation (mapped to PRD §11)

| Guardrail (PRD) | Implementation |
|---|---|
| Read/write separation at tool layer | Enforced by type system: write tools return a `ProposedDiff` object type; only a distinct `execute_action` tool (gated on `status == "approved"`) can trigger a real portal API call. No write tool has a code path to the portal write API directly. |
| Vendor-scoped data access | Every tool implementation takes `session_vendor_id` as an injected server-side parameter (from the authenticated session, not the LLM's function-call arguments) and applies it as a hard filter in the query/API call. Verified by contract tests that assert cross-vendor IDs passed in tool arguments are ignored/overridden. |
| No destructive action without confirmation | All write tools route through the diff → approve → execute lifecycle in §4.2; there is no tool that both proposes and executes in one call. |
| Extra warning for higher-impact actions | `requires_extra_confirmation` flag computed server-side (e.g., participant count > 1, member removal, notification audience above threshold) — not left to the model to decide. |
| Scope boundaries (platform settings, other vendors, end-user actions) | No tool exists for these; a missing tool is the enforcement mechanism, not a prompt instruction alone. |
| PII handling | `find_user` and similar tools return only fields needed to disambiguate (name, last venue interaction) by default; full contact info only returned when the resolved action needs it (e.g., a booking's phone number for a no-show dispute), not in bulk list views. |
| KYC/financial data lockdown | `pan_number`, `bank_account.*`, `gst_number` are excluded at the ORM/query layer used by every tool — i.e., the tool layer's data access objects for `vendors` never select these columns at all, so there's no accidental serialization path even if a bug elsewhere tried to return the full row. |
| Track-aware scoping | Tool registry filtering in §6.2, plus a defense-in-depth check inside each tool: if a Play-only vendor's session somehow reaches a Pass-only tool (e.g., stale registry cache), the tool itself checks `active_track` and rejects with a scope error before querying anything. |

## 8. API Contracts (Copilot Gateway ⇄ Frontend)

```
POST /copilot/sessions/{conversation_id}/messages
  body: { text: string }
  → streams: { type: "text" | "tool_call" | "diff_card" | "done", ... }

POST /copilot/actions/{audit_log_id}/approve
  body: { edited_value?: object }   // present only if vendor used "Edit"
  → { status: "executed" | "failed", result: object }

POST /copilot/actions/{audit_log_id}/reject
  → { status: "rejected" }

GET /copilot/sessions/{conversation_id}/history
  → { messages: [...], pending_actions: [...] }
```

All endpoints require the existing portal session cookie/token; `vendor_id` and `staff_user_id` are derived server-side from that session, never accepted as request body fields.

## 9. Data Model

Reuses the mock schema defined in PRD §8 as-is; the Copilot introduces exactly one new table:

**`copilot_audit_log`**

| Column | Type | Notes |
|---|---|---|
| `log_id` | uuid, PK | |
| `vendor_id` | uuid, FK | denormalized for fast vendor-scoped audit queries |
| `staff_user_id` | uuid, FK | who was logged into the portal |
| `conversation_id` | uuid | groups related turns |
| `request_text` | text | vendor's original natural-language request |
| `resolved_action_type` | enum | e.g. `extend_trial`, `mark_no_show`, `send_event_notification` |
| `target_entity_type` | text | e.g. `trials`, `bookings`, `communities` |
| `target_entity_id` | uuid | |
| `proposed_diff` | jsonb | current_value / proposed_value / downstream_effects |
| `requires_extra_confirmation` | boolean | |
| `status` | enum | `proposed` \| `approved` \| `edited` \| `rejected` \| `executed` \| `failed` |
| `approved_by` | uuid, nullable | |
| `executed_at` | timestamptz, nullable | |
| `created_at` | timestamptz | |

Retention: indefinite by default (PRD §10 Auditability); final retention period is an open question (PRD §14) pending compliance input.

## 10. Non-Functional Requirements (implementation targets)

| Area | Target |
|---|---|
| Read latency | p50 response start < 2s, full answer < 5s for a single-tool-call query |
| Write proposal latency | Diff card rendered < 3s from vendor's message |
| Availability | Copilot service degradation must fail closed to "Copilot unavailable, use the dashboard" banner — never blocks or slows the underlying portal UI (PRD §10) |
| Tenant isolation | 100% of tool calls pass an automated contract test asserting query results are limited to session `vendor_id`; treated as a release-blocking test, not a metric |
| Auditability | Every `status="executed"` row has non-null `approved_by`, `executed_at`, and a `proposed_diff` capturing before/after state |

## 11. Observability

- **Structured logs** per turn: `conversation_id`, `vendor_id` (hashed in logs shipped to third-party tooling if applicable), tool calls made, latency per tool call.
- **Metrics:** read-query success rate, tool-call error rate, proposal→approval rate, proposal→rejection rate, time-to-approve, notification-tool send volume (for future rate-limiting decisions per PRD Open Questions).
- **Tracing:** each Orchestrator request emits a trace spanning Gateway → Orchestrator → Tool calls → downstream service calls, for debugging slow or failed turns.
- **Alerting:** spike in `failed` executions, spike in cross-vendor-scope rejections at the tool layer (would indicate a registry/session bug, treated as a security alert, not just an error metric).

## 12. Testing Strategy

- **Unit tests:** each tool function, independent of the LLM — assert vendor scoping, KYC-field exclusion, and diff object shape.
- **Contract tests:** Orchestrator ↔ Tool Layer ↔ existing portal service APIs (schema compatibility).
- **Guardrail/red-team tests:** adversarial prompts attempting to (a) request another vendor's data, (b) request PAN/bank/GST fields, (c) get a write auto-executed without approval, (d) get a Play-track vendor to access Pass-track data. All must fail deterministically at the tool-registry or tool-implementation layer, not rely on the model refusing.
- **Approval-flow integration tests:** full diff → approve/edit/reject → execute → audit-log lifecycle against a staging portal-services environment.
- **Load tests:** concurrent multi-venue vendors issuing read queries; confirm p50/p95 latency targets under load.

## 13. Rollout Plan (maps to PRD §15 Phasing)

| Phase | Technical milestones |
|---|---|
| **Phase 1 (MVP)** | Tool registry for Play + Pass reads/writes listed in §5; approval workflow; audit log; track-aware registry filtering; KYC-field exclusion at data-access layer; guardrail test suite passing. |
| **Phase 2** | Additional write tools (reschedule, add slots/plans, coach reassignment); multi-venue rollup queries; conversation history search (requires indexing `copilot_audit_log`/session store by vendor + full-text). |
| **Phase 3** | Proactive nudges (a new, still-approval-gated "suggested action" surface, not a background job that writes); Community-track tool registry (join-request queue tools, event/notification tools, moderation tools) once that product surface leaves waitlist status. |

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Model hallucinates a plausible-looking `vendor_id` or record ID in a tool call | Tool layer never trusts model-supplied `vendor_id`; always injects it server-side from session. Record IDs are validated to belong to the session vendor before any read/write proceeds. |
| Vendor approves a stale diff (underlying data changed between proposal and approval) | `execute_action` re-fetches current state and re-validates the diff is still applicable before calling the portal API; on mismatch, re-propose rather than execute silently. |
| Notification-tool misuse (spam) | Audience-size threshold triggers `requires_extra_confirmation`; frequency capping flagged as an open question (PRD §14) to resolve before Phase 3 Community rollout. |
| Track-registry drift (a vendor's active track changes mid-session) | Session cache TTL kept short; tool layer re-validates `active_track` per PRD §11's defense-in-depth check even if the registry filter is stale. |

---
*This TRD implements PRD §6–§11 for Phase 1 (Play + Pass). Community-track tool specs will be added once that surface exits waitlist, per PRD §15 Phase 3.*
