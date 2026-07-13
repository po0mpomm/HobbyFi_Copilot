# PRD: HobbyFi Copilot — AI Assistant for the Vendor Portal

**Owner:** Product/Eng — HobbyFi (Clam.AI Venture Pvt. Ltd.)
**Doc status:** Draft v1
**Surface:** partner.hobbyfi.in (Vendor Portal)

---

## 1. Background

HobbyFi is a consumer app built around four pillars — **Play** (court booking + "Join a Game" bill-splitting), **Pass** (memberships + free trial classes + QR check-in), **Swipe** (hobby-buddy matching), and **Community** (chat/polls/calls). Vendors are the supply side: court owners, fitness studios, coaches, and academies who list courts, classes, and membership plans on `partner.hobbyfi.in`.

**Vendor onboarding confirms a track-based model.** At sign-up (`partner.hobbyfi.in/onboarding`), a vendor is asked *"How do your customers pay you today?"* and picks one primary track (can activate others later from the dashboard):

- **Play track** — hourly slot bookings (sports complexes, turfs, badminton courts, multi-sport arenas). Features: hourly rentals, marketplace boost/discovery, smart calendar (rain blocks, seasonal/lighting pricing), real-time payouts. *Memberships & CRM are explicitly not included in this track.*
- **Pass track** — memberships & CRM (gyms, martial arts academies, coaching centers, studios). Features: subscription auto-billing, client CRM & roster (waivers, profile images, check-in logs), staff & coach panels (schedules, commissions, roles), waivers & finance (GST billing, secure signings). Dashboard shows CRM Sales Analytics — MRR stream, active member count, 30-day MRR trend, per-plan breakdown (e.g. "Monthly Gold," "10-Class Pass," "Weekend Club"), and per-member status tags (*Auto-Paid*, *Trial Active*). *Hourly court slot bookings are not included in this track.*
- **Community track** — online cohorts & live events (digital courses, coaching panels, community chat channels, event hosting). Marked **Coming soon** on the current onboarding flow (waitlist only), but the in-product "Community Help Hub" FAQ already defines the intended mechanics, which this PRD should design toward:
  - **Community basics:** a community is a dedicated space for an interest group to organize, chat, and play together; joining is mostly free, though a vendor may set up premium (paid) memberships or charge for specific events; end users can belong to and participate in multiple communities at once.
  - **Payments & trust:** vendor decides per-session whether an event/game is free or paid; HobbyFi collects payment in-app and settles to the vendor's verified bank account; a platform fee is deducted for processing/maintenance; cancellation refunds follow the vendor's stated policy, generally auto-processed based on a cancellation timeframe.
  - **Joining & participation:** members discover a community via an Explore tab and request to join; the vendor sets the community to **Instant Join** or **Approval Required**; members can belong to multiple communities and can join just for chat/discussion without joining any paid event.
  - **Events & activities:** vendor creates games/sessions/workshops inside their community, each independently priced (free or paid); events surface in the community feed, and the vendor can invite members by pushing a notification about the event to the whole community.
  - **Safety & trust:** every vendor goes through onboarding/verification before their community is considered "verified," and HobbyFi gives vendors their own moderation tools on top of that — a Report button on posts/profiles (with HobbyFi also monitoring flagged content), and full admin authority to block or remove members who violate rules.
  - **Monetization:** beyond one-off paid events, vendors can sell recurring (monthly/yearly) community memberships for exclusive access; HobbyFi handles payout to the vendor's bank for both paid events and memberships.

Onboarding itself is a 4-step wizard (Registration → Details → Bank Details → Review) inside a 3-stage flow (Verification → Select Track → Launch), and requires KYC docs: **PAN Card** (required), **Bank Account Details** — account number, IFSC, holder name, branch (required), and **GST Number** (optional).

Today, vendors have to navigate dashboards, tables, and filters to answer basic operational questions ("how much did I make today," "who's on a free trial right now") or to make simple edits (extend a trial, shift a membership date). **HobbyFi Copilot** is an AI assistant embedded in the vendor portal that lets a vendor ask these questions in natural language and, for anything that changes data, propose the change and execute it only after the vendor explicitly approves it.

## 2. Problem Statement

Vendors lose time hunting through portal screens for answers that are one query away, and are wary of any AI tool that can silently modify bookings, memberships, or revenue records. We need an assistant that is **fast and trustworthy for reads**, and **safe and auditable for writes** — never a black box that changes vendor/customer data on its own.

## 3. Goals

- Let a vendor get any operational answer about their venue(s) in one conversational turn (revenue, bookings, trials, memberships, check-ins, players).
- Let a vendor request common data edits in natural language, with the system drafting the exact change and requiring one explicit approval tap before it's committed.
- Every write is logged, reversible where feasible, and scoped strictly to that vendor's own data.
- Reduce time-to-answer for common vendor questions from portal navigation (~1–3 min) to a single chat turn (~seconds).

## 4. Non-Goals (Phase 1)

- Copilot does not perform actions on behalf of *end users/players* (e.g., cannot message a player, cannot process refunds to a bank account without existing portal refund flow).
- No autonomous/unattended writes — every write needs a human-in-the-loop approval, always.
- No cross-vendor analytics or benchmarking against other vendors.
- No voice interface in Phase 1 (text chat only).
- No changes to pricing/commission/HobbyFi platform-level settings — only operational entities the vendor already manages (bookings, memberships, trials, class schedules, check-ins).

## 5. Target Users

| Persona | Description | Primary needs |
|---|---|---|
| **Play-track vendor** (turf/court/arena owner) | Runs hourly slot bookings, no memberships. Cares about occupancy and payouts. | Today's bookings/revenue, slot occupancy, no-shows, split-payment status ("Join a Game"). |
| **Pass-track vendor** (gym/studio/academy owner) | Runs subscriptions, trials, and a client roster. | MRR, active members, trial pipeline & conversion, plan-wise breakdown, coach schedules. |
| **Front-desk / Ops staff** | Handles day-to-day check-ins, trial conversions, member queries, on either track. | Lookup a specific user/booking fast, make small corrections (date, trial extension, no-show mark). |
| **Multi-venue chain admin** | Manages several venues/courts (possibly mixed Play + Pass) under one vendor account. | Cross-venue/cross-track rollups, per-venue breakdowns, edits done one at a time with approval. |
| **Community moderator/host** *(future — Community track)* | Runs a community: hosts paid/free events, manages join requests, moderates members. | Join-request queue, event revenue, flagged content, member growth. |

## 6. Scope Overview — What the Copilot Does

### 6.A. Read / Q&A capabilities ("ask anything about my business")
Natural-language questions answered from the vendor's own data, e.g.:
- "What is my revenue today / this week / last month?"
- "List trial users of badminton at [venue]."
- "How many members are expiring this week?"
- "Show me today's check-ins for [venue]."
- "Which bookings were cancelled yesterday and why?"
- "Who are my top 10 most active members this month?"
- "What's my court occupancy rate for evenings this week?"
- "How many free trials converted to paid last month?"
- "What's my current MRR, and how has it trended over the last 30 days?" *(Pass track)*
- "How many active members do I have on the Monthly Gold plan vs the 10-Class Pass?" *(Pass track)*
- "Which members are Trial Active right now and expiring in the next 3 days?" *(Pass track)*
- "Show me [coach]'s schedule this week." *(Pass track — staff & coach panel)*
- "How many slots are still unbooked this evening at Court 1?" *(Play track)*
- "What's my payout for this week?" *(Play track — real-time payouts)*
- "How many pending join requests do I have?" *(Community track)*
- "How much did my last paid event earn, after platform fees?" *(Community track)*
- "How many new members joined my community this month?" *(Community track)*
- "Are there any flagged/reported posts in my community right now?" *(Community track)*
- "Is my community set to Instant Join or Approval Required right now?" *(Community track)*
- "How many of my members are in a paid membership vs. just following for free?" *(Community track — premium vs. free membership split)*

### 6.B. Write capabilities ("do something for me," always approval-gated)
Natural-language requests that resolve to a **proposed, reviewable change**, e.g.:
- "Extend [user]'s free trial by 3 days."
- "Update [user]'s membership end date to [date]."
- "Mark [booking ID] as a no-show."
- "Cancel and refund [booking ID]." (refund only triggers HobbyFi's existing refund workflow — Copilot doesn't move money itself)
- "Add a new trial slot for badminton on Saturday 6 PM."
- "Reschedule [user]'s class from Tuesday to Thursday."
- "Reassign [coach]'s Thursday 6 PM slot to [other coach]." *(Pass track — staff & coach panel)*
- "Switch [user] from the 10-Class Pass to Monthly Gold." *(Pass track — plan change)*
- "Approve [user]'s pending join request." *(Community track)*
- "Change my community's join setting to Approval Required." *(Community track)*
- "Remove [user] from my community for [reason]." *(Community track — moderation action; always shown with an extra explicit warning, see §11)*
- "Mark next Saturday's workshop as paid, ₹200 per seat." *(Community track)*
- "Send a push notification to all my community members about Saturday's workshop." *(Community track — event invite/promotion)*

Every write request follows the same lifecycle: **Interpret → Draft change (diff) → Vendor reviews & approves/edits/rejects → Execute → Confirm & log.** No write is ever auto-executed.

## 7. Core User Flows

### 7.1 Read flow
1. Vendor types/asks a question in the Copilot chat panel (persistent side panel or command bar in the portal).
2. Copilot identifies intent + entities (metric, venue, sport, date range, user).
3. Copilot queries vendor's own data, scoped by `vendor_id` (and `venue_id` if applicable) — never another vendor's data.
4. Copilot returns a direct answer, optionally with a small table/chart, and a "view full report" link to the relevant portal screen for verification.

### 7.2 Write flow (approval-gated)
1. Vendor makes a request in natural language.
2. Copilot resolves the target record(s) (e.g., matches "Rahul" to a specific `user_id` at a specific venue — asks a clarifying question if ambiguous, e.g. more than one "Rahul").
3. Copilot shows a **confirmation card**: current value → proposed new value, which record(s) it affects, and any downstream effects (e.g., "this will also update the next billing date").
4. Vendor taps **Approve**, **Edit**, or **Reject**.
   - Edit lets the vendor tweak the proposed value before approving (e.g., change "3 days" to "5 days").
   - Reject cancels the action; nothing is written.
5. On Approve, Copilot executes the change via the same write path/API the portal UI uses (no direct DB writes), then confirms success/failure back in chat.
6. Action is recorded in an audit log (who asked, what was proposed, who approved, what changed, timestamp, before/after values).

### 7.3 Ambiguity & error handling
- If a request is ambiguous (multiple matching users/bookings, unclear date range), Copilot asks one clarifying question rather than guessing.
- If a request is out of scope (e.g., "change my commission rate," "message all my members"), Copilot declines and explains what it can/can't do, pointing to the right portal screen or support contact if relevant.
- If a request would affect another vendor's data or a record outside the logged-in vendor's account, Copilot refuses — this is a hard boundary, not a soft one.

## 8. Mock Data Schema (Phase 1)

This is illustrative data the Copilot reads from / writes to (mirrors what the vendor portal already manages — Copilot does not introduce new source-of-truth tables, it operates on these).

**`vendors`**
`vendor_id, business_name, track (play | pass | community), category (sports_court | fitness_studio | academy | coach), contact_email, phone, onboarding_status (verification | select_track | launch | live), pan_number, gst_number (nullable), bank_account (holder_name, account_number, ifsc, bank_name, branch), created_at`

> Note: `pan_number` and `bank_account` are sensitive KYC/financial fields captured at onboarding — see Guardrails §11 for access restrictions specific to these fields.

**`venues`**
`venue_id, vendor_id, name, city, address, sports_offered[], amenities[]`

**`courts_or_slots`** *(Play track)*
`slot_id, venue_id, sport, capacity, price_per_hour, is_active, seasonal_pricing_rules (json), rain_block (bool)`

**`bookings`** *(Play track)*
`booking_id, slot_id, venue_id, sport, booked_by_user_id, booking_date, start_time, end_time, status (confirmed | cancelled | completed | no_show), total_amount, split_type (solo | join_a_game), created_at`

**`booking_participants`** (for "Join a Game" bill-splitting)
`participant_id, booking_id, user_id, amount_owed, payment_status (paid | pending)`

**`payouts`** *(Play track — real-time payouts)*
`payout_id, vendor_id, venue_id, period_start, period_end, gross_amount, commission_deducted, net_amount, status (pending | settled), settled_at`

**`membership_plans`** *(Pass track)*
`plan_id, venue_id, sport, plan_name (e.g. "Monthly Gold", "10-Class Pass", "Weekend Club"), duration_days | class_count, price, trial_available (bool), trial_duration_days`

**`memberships`** (a user's purchased/active plan) *(Pass track)*
`membership_id, plan_id, user_id, venue_id, start_date, end_date, status (active | expired | cancelled), is_trial (bool), converted_from_trial (bool), payment_mode (auto_paid | manual), display_status (Auto-Paid | Trial Active | Expired)`

**`trials`** *(Pass track)*
`trial_id, plan_id, user_id, venue_id, sport, start_date, end_date, status (active | expired | converted | no_show)`

**`waivers`** *(Pass track — client CRM)*
`waiver_id, user_id, venue_id, membership_id, signed_at, document_url`

**`staff_coaches`** *(Pass track — staff & coach panel)*
`staff_id, vendor_id, venue_id, name, role (coach | front_desk | manager), commission_rate (nullable), assigned_classes[]`

**`checkins`**
`checkin_id, user_id, venue_id, booking_id | membership_id, checkin_time, method (qr | manual)`

**`transactions`**
`transaction_id, vendor_id, venue_id, related_booking_id | membership_id, amount, payment_gateway (razorpay | payu), status (success | failed | refunded), gst_invoice_id (nullable), created_at`

**`mrr_snapshots`** *(Pass track — CRM Sales Analytics)*
`snapshot_id, vendor_id, venue_id, date, mrr_amount, active_members_count`

**`users`** (players — read-only from Copilot's perspective, vendor cannot edit user profile fields, only their venue-scoped records)
`user_id, name, phone, email, city, hobbies[], joined_at`

**`communities`** *(Community track)*
`community_id, vendor_id, name, description, join_type (instant | approval_required), is_free_to_join (bool, default true), verification_status (verified | pending), member_count, created_at`

> Note: joining a community is free by default; `is_free_to_join` reflects that a vendor may still charge for specific paid events or offer an optional premium (recurring) membership tier — see `community_memberships` below. `verification_status` reflects that all vendors complete onboarding verification before their community is marked verified, per the product's "Are communities verified or moderated?" trust signal.

**`community_members`** *(Community track)*
`member_id, community_id, user_id, status (active | pending_approval | removed | banned), joined_at, removed_reason (nullable)`

**`community_memberships`** *(Community track — recurring paid access)*
`membership_id, community_id, user_id, plan_name, billing_cycle (monthly | yearly), price, status (active | expired | cancelled), start_date, end_date`

**`community_events`** *(Community track)*
`event_id, community_id, title, type (game | session | workshop), price (nullable — null = free), start_time, capacity, cancellation_policy, status (upcoming | completed | cancelled)`

**`event_registrations`** *(Community track)*
`registration_id, event_id, user_id, payment_status (paid | free | refunded), registered_at`

**`moderation_reports`** *(Community track — safety & trust)*
`report_id, community_id, reported_by_user_id, target_type (post | profile | member), target_id, reason, status (open | reviewed | actioned), created_at`

**`copilot_audit_log`** (new table specific to this feature)
`log_id, vendor_id, staff_user_id (who's logged into portal), request_text, resolved_action_type, target_entity_type, target_entity_id, proposed_diff (json), status (proposed | approved | rejected | executed | failed), approved_by, executed_at`

## 9. Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Copilot must scope every query and action to the authenticated vendor's `vendor_id` (and permitted `venue_id`s for multi-venue accounts). |
| FR-2 | Copilot must support natural-language read queries across bookings, trials, memberships, check-ins, revenue/transactions, and users associated with the vendor. |
| FR-3 | Copilot must support the write intents listed in §6.B, each resolving to a structured, reviewable diff before execution. |
| FR-4 | No write action executes without an explicit vendor "Approve" action in the UI. |
| FR-5 | Every proposed and executed write is recorded in `copilot_audit_log` with before/after state. |
| FR-6 | Copilot must ask a clarifying question when a request is ambiguous (multiple matches, missing date range, missing venue in multi-venue accounts). |
| FR-7 | Copilot must decline out-of-scope or cross-vendor requests with a clear explanation. |
| FR-8 | Copilot responses for numeric/data answers must be traceable — vendor can click through to the underlying record(s)/portal screen. |
| FR-9 | Copilot must support both single-venue and multi-venue vendor accounts, defaulting to "all my venues" unless a venue is specified. |
| FR-11 | Copilot must only expose tools/data relevant to the vendor's active track(s) (Play / Pass / Community) — no cross-track prompts or data leakage into an unrelated dashboard. |
| FR-12 | Copilot must never read, display, or modify PAN, bank account, or GST onboarding fields under any request phrasing. |
| FR-10 | Conversation history should be retrievable within a session and (later phase) searchable across past sessions per vendor account. |
| FR-13 | For Community track, "invite members to a game/event" resolves to a push-notification action (a write, since it triggers an outbound message) — it still goes through the same draft → approve → send lifecycle as any other write, showing the vendor the exact notification text and audience size before sending. |

## 10. Non-Functional Requirements

- **Data isolation:** hard tenant isolation by `vendor_id` at the query layer — not just prompt-level instruction.
- **Latency:** read answers in a few seconds; write proposals generated quickly enough to keep the approval flow feeling instant.
- **Auditability:** every write traceable to a specific vendor-approved request, indefinitely retained.
- **Reversibility:** where the underlying entity supports it (e.g., dates, statuses), store enough of the "before" state to support manual rollback by support/ops.
- **Availability:** Copilot degrading or failing must never block the vendor from using the normal portal UI to do the same task.

## 11. Guardrails (summary — detailed framework in the technical report)

- **Read/write separation at the tool layer:** read tools and write tools are distinct; write tools always return a "pending approval" object, never a committed result, until an approval signal is received.
- **Vendor-scoped data access:** every tool call is parameterized/filtered by the logged-in vendor's ID server-side, independent of what the model outputs.
- **No destructive actions without confirmation**, and some actions (e.g., cancellations affecting a paid booking with multiple participants) get an extra explicit warning in the confirmation card.
- **Scope boundaries:** Copilot refuses requests about platform-level settings, other vendors, or end-user actions outside the vendor's own operational data.
- **PII handling:** user contact info (phone/email) is surfaced only as needed to resolve/identify a record, not dumped in bulk without a clear operational reason.
- **KYC/financial data lockdown:** onboarding fields — PAN number, full bank account/IFSC details, GST number — are never read out, summarized, or editable by Copilot, even to the vendor who owns them. These are display-masked in the normal portal UI and out of Copilot's tool scope entirely (not just a prompt instruction); vendors change these only through the existing verified onboarding/settings flow, never via chat.
- **Track-aware scoping:** Copilot only surfaces tools/entities relevant to the vendor's active track(s) — e.g., a Play-only vendor never gets asked about or shown MRR/membership data, and vice versa, matching what "Memberships & CRM not included in this track" / "Hourly court slot bookings not included in this track" already communicate in the product.

## 12. Success Metrics

- % of vendor questions resolved by Copilot without falling back to manual portal navigation.
- Median time-to-answer for read queries.
- Write-request approval rate vs. edit/reject rate (signals how well Copilot resolves intent correctly).
- Zero cross-vendor data leaks (hard requirement, tracked via audit + testing, not just a metric to optimize).
- Vendor-reported trust/satisfaction with the assistant (qualitative, post-launch survey).

## 13. Assumptions & Constraints

- Vendor portal already has authenticated sessions with `vendor_id` (and role) available — Copilot rides on existing auth, doesn't introduce a new identity system.
- Underlying write operations reuse existing portal APIs/services (booking service, membership service, etc.) rather than Copilot writing directly to the database.
- Mock data schema in §8 is a working approximation for development; will be reconciled with the actual production schema before integration.

## 14. Open Questions

- Do multi-venue vendor staff have per-venue role restrictions we need to respect (e.g., a venue manager who can only see/edit their own venue)?
- What's the existing refund flow/API — does Copilot only *initiate* a refund request or can it fully execute one?
- Should there be a monetary/impact threshold above which even an "approved" write needs a second confirmation (e.g., large refunds)?
- Retention period for `copilot_audit_log` and conversation history?
- Can a vendor have both Play and Pass active simultaneously (dashboard hints "activate Play module later" from a Pass account) — if so, does Copilot need a track-switcher, or does it infer from what's active on the account?
- Once Community track exits "coming soon," what write actions (if any) will vendors need there — cohort scheduling, event capacity changes?
- Should Copilot-initiated push notifications to a community be capped in frequency/audience size to prevent spam, similar to the "extra warning" treatment given to member-removal actions?

## 15. Phasing

- **Phase 1 (MVP):** Read Q&A + core writes for **Pass track** (highest data complexity: MRR, trials, memberships, coach schedules) and **Play track** (bookings, occupancy, payouts) — trial extension, membership date update, mark no-show, cancel booking — with full approval workflow and audit logging.
- **Phase 2:** Broader write intents (reschedule, add slots/plans, coach reassignment), multi-venue and mixed-track rollups, conversation history search.
- **Phase 3:** Proactive nudges (e.g., "3 trials expire today with no conversion yet — want to send a reminder?"), still approval-gated for any action. Extend to **Community track** once that product surface leaves waitlist/coming-soon status.

---
*Next: build Phase 1 (read Q&A + core approval-gated writes) against the mock schema above, then write up the architecture/tools/memory/guardrails/orchestration report once the product is functional.*
