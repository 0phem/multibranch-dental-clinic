# M17 — Unified Patient Messaging: production hardening

> **2026-10-13:** creation/routing, realtime, encryption at rest and the offline alert are now specified in `docs/M17_REALTIME_MESSAGING.md` (Phase 2 decisions 3–5). Statements below that there is no creation route or live connection are historical.

Branch `feature/m17-patient-messaging-production-hardening`, from `7364dd1` (M16 checkpoint). Uncommitted. **Verdict B.**

## 1. Starting git state
Clean, synchronized tree on `feature/m16-external-inquiry-production-hardening` at `7364dd1`; new branch created from it. No merge to main.

## 2. Architecture discovered (read-only audit)
M17 was a **frontend/browser-local prototype**: `conversations` in `localStorage` (two seeded demo threads, "Can I move my appointment…", "The tooth is still sensitive to cold…"), commands in `src/communication.js` (`markConversationRead`, `replyToConversation`, `closeConversation`), participant logic in `phase3-contracts.js` (`canReadConversation`), a Patient page (`PatientMessages.jsx`) and a Staff/Dentist page (`MessagesPage`). There was **no backend table, endpoint, authorization, history, delivery integration or provider code**. Prototype semantics that the repository evidences (and MODULE_COVERAGE.md states: "Patient/Staff/Dentist two-way threads, authorized replies, closure and participant-specific unread state … explicit user participants, not broad roles. Owner oversight grants no participation; no reopen workflow; no Patient-initiated conversation command yet"): a conversation belongs to one Patient and one branch and has explicit participant users; participants read and reply while it is Open; Staff/Dentist participants can close it; closed is final; unread is per participant; a reply is idempotent by command id. System reminders were a separate `notifications` collection (M18), not conversation messages.

## 3. Authority before/after
Before: browser-local arrays. After: **Laravel/PostgreSQL authority** (`conversations`, `conversation_participants`, `conversation_messages`; Patient/Staff/Dentist API). In a clinic-server session the local reply/read/close commands refuse ("managed on the clinic server") and demo conversations are never shown or counted; the prototype survives only as the offline demo preview (no server session).

## 4–5. Conversation and message model
`conversations`: public ULID, Patient, branch, `context` label, `status` Open|Closed, `revision`, close audit columns; Patient/branch/context immutable and Closed final (trigger). `conversation_messages`: public ULID, conversation, sender account, text (≤ 4000 DB, ≤ 2000 API), server timestamp; **immutable by trigger (no edit, no delete)**. Messages carry no attachment, rich text, channel, provider id, delivery or seen field (tested absent).

## 6. Public identity
ULID `public_id` for conversations and messages; routes bind it; numeric/malformed/unknown ids → 404; internal ids are never returned.

## 7–8. Patient relationship and participants
Every conversation belongs to an authoritative Patient row; nothing accepts a client `patient_id` and no Patient is created from free text. Participation is an **explicit participant row** (`conversation_participants`, unique per conversation/user), mirroring the prototype's `participantUserIds`; not a group-chat redesign and no roles-as-membership.

## 9. Sender attribution
The sender is the authenticated account; `sender`, `sender_id`, `sender_role`, `sent_by`, `actor_id` etc. are **refused (422)** if supplied. Projections show the sender's display name and role only; `mine` is derived per viewer.

## 10. Role/access matrix
| | Guest | Patient | Staff | Dentist | Owner |
|---|---|---|---|---|---|
| list / view / read history | 401 | own Patient's conversations where a participant | participant **and** branch authorization | participant **and** assigned to the branch | 403 |
| send | 401 | participant, Open | participant + branch scope, Open | participant + branch, Open | 403 |
| mark read (own marker) | 401 | yes | yes | yes | 403 |
| close | 401 | 403 | participant + branch scope | participant + branch | 403 |
| create / add or remove participant / edit / delete | no endpoint | – | – | – | – |
| view Patient contact data | not exposed (display name and code only) |
Access is re-checked under the conversation row lock on every command; removing a Staff member's branch authorization ends access at once (tested).

## 11–13. Staff scope, Dentist and Owner boundaries
Staff: the prototype required being a participant **and** the conversation's branch — kept. **TECHNICAL BOUNDARY — NOT CONFIRMED CLINIC POLICY** (no shared inbox, no routing). Dentist: the prototype did contain Dentist participants, so a Dentist who is a participant **and** assigned to the conversation's branch has access; no other Dentist (including one who treated the Patient) does. Owner: no participation or read access ("Owner oversight grants no participation"), fail-closed; POLICY DECISION REQUIRED if oversight is wanted.

## 14. Conversation lifecycle
Existing states only: Open → Closed by the named `close` command (Staff/Dentist participants, `expected_revision`, idempotent when already closed); no reopen, no Archived/Resolved/Escalated; Closed refuses sends (422) and is final in the database.

## 15. Message lifecycle / immutability
Sent messages are immutable: no route and no database path edits or deletes them (model, builder and raw SQL attempts all refused). Edit/delete would be a policy question (none was invented).

## 16. Read-state semantics
Per participant, in-application only: `last_read_message_id` (the last message that participant has opened; a participant's own send counts as read up to it). `unread` = other participants' messages after that marker. Opening a conversation records it (`POST /read`, naturally idempotent, own marker only). It is **not** delivery/seen/receipt anywhere: no `delivered`, `seen`, `typing` or `online` appears in any API field, UI text or column (tested).

## 17. Fake-delivery findings
The prototype UI had no external-delivery claims, but the Patient/Staff screens now state explicitly: "These messages stay inside this application. Nothing is sent by SMS, e-mail or social media, and ‘unread’ only means not yet opened here." No presence, typing or receipt indicators exist or were added; the periodic refresh is a plain re-read while the tab is visible (existing `useVisibleRefresh`), not a live connection.

## 18. Pagination
Conversations: keyset by id, `per_page` 1–100 (default 50), public-id cursor looked up inside the viewer's own visible set. Messages: newest first by serial id, `per_page` 1–100 (default 30), cursor looked up **inside that conversation only** (a message from elsewhere reveals nothing); authorization first; malformed → 422. UI shows the recent page, **Load older messages** (prepends without duplicates), a recoverable "Older messages unavailable — Retry", and never loads unbounded history.

## 19. Ordering
Deterministic: the serial id, assigned while the conversation row is locked, so concurrent sends are totally ordered per conversation (tested with four real concurrent sends).

## 20. Idempotency
`Idempotency-Key` is required to send/close. Same key + same text replays the stored message (one row); same key + different text → 422; a new key with identical text is a distinct message; a double-submit race stores one message. The UI keeps the typed text and the same key after a failure, so **Try again cannot post twice**; editing the text starts a new key.

## 21. Concurrency
Real-process tests (3): simultaneous sends from both participants all persist in one order with correct read markers; a duplicate-key race stores one message; a send racing closure either lands before the closing instant or is refused (never after `closed_at`).

## 22. IDOR / mass assignment
Foreign Patient, non-participant Staff (same or other branch), a non-participant Dentist, a participant without the role link (wrong branch), Owner, numeric/malformed/unknown ids, other participants' read markers and foreign cursors are all refused or empty. Injected `sender*`, `patient_id`, `branch_id`, `conversation_id`, `owner`, `read_at`, `delivered_at`, `seen_at`, `status`, timestamps, `external_id`, `channel`, attachment/HTML fields are refused with 422.

## 23. Privacy / logging / rate limit
List and summary projections carry **no message text**; message text appears only in the participant's own history endpoint. No message text is logged (tested). Message text is untrusted: bounded (2000), control characters refused, stored/returned verbatim as data, rendered only as React text (browser-verified: no injected script, element or link; no server-side URL fetch). Send is rate-limited per **account**: 20/minute and 200/hour (config `messaging.*`; technical spam/storage bounds, **not clinic policy**; multi-instance deployments need a shared cache).

## 24. Retention / FK behavior
Everything is `RESTRICT`: deleting an account, Patient, branch, conversation or message that has history is refused (tested); no cascade or SET NULL can erase history. No retention period was invented: **RETENTION POLICY REQUIRED.**

## 25. M16 boundary
M16 conversion still creates **no** conversation, and M16 was not changed. The prototype's evidence-backed handoff (convert → a conversation with the staff member and the Patient's account) is **not wired**: the M17 server exists now, but routing/ownership/handoff policy is unresolved, and there is deliberately **no conversation-creation command at all** (so, today, a server Patient/Staff sees an honest empty state until a reviewed handoff exists). Contract for later: an identified Patient (the appointment's Patient), an authorized branch, explicit participants chosen by a human or an approved routing rule, a one-time link, and an M22 event.

## 26–27. M18 and M7 boundaries
No notification, mail, SMS or HTTP call exists in M17 (source-scanned and asserted with fakes); system reminders remain M18's `notifications` collection and never render as Staff text. No M7/LLM code is reachable from M17 and no AI text can be written as a message.

## 28. M22
Deliberately **no M22 events**: M22 must not become a transcript, messages are immutable in their own table, and a closure carries `closed_at`/`closed_by` in the conversation row. (Tested: no audit rows.)

## 29. Dashboard / demo findings
In a server session: Patient unread badge comes only from `GET /conversations/summary` (no badge when unknown/unavailable, never a fabricated number); the Owner dashboard "Active conversations" shows **"Not available to Owner"** (no authoritative source, Owner has no access) instead of a demo count; analytics "Communication" is already "Unavailable". Local demo conversations and the seeded threads are never counted or shown with a clinic account.

## 30. Schema
New forward-only migration `2026_10_16_000100_create_messaging_tables.php` (not applied to `dental_clinic`; tests on `dental_clinic_test`).

## 31–32. Files and tests
Backend: migration, `Conversation`, `ConversationParticipant`, `ConversationMessage`, `MessagingService`, `ConversationController`, `ConversationResource`, `MessageResource`, two request classes, `config/messaging.php`, `routes/api.php`, `AppServiceProvider` (limiter), tests `MessagingTest` (12) and `ConcurrentMessagingTest` (3). Frontend: `api-client.js`, `appointments-api.js` (retry_after kept), `messaging-api.js`, `pages/ServerMessages.jsx`, `pages/FinanceCommunication.jsx`, `communication.js`, `layout.jsx`, `pages/Dashboards.jsx`, `tests/m17-messaging.test.js` (9), `scripts/m17-messaging-browser-qa.mjs`.

## 33–41. Results
Superseded by the final gate run in §45 (earlier run: 642 backend / 746 frontend / 225 browser checks); browser QA, 0 failures, 0 errors, 0 px overflow (Patient/Staff/Dentist/Owner × 375/430/768/1024/1440: own-conversation-only, inert malicious text, older-page failure + Retry, duplicate-safe retry with the same Idempotency-Key, rate-limit state, Patient cannot close, Owner has no Messages entry and no fabricated counts, no delivered/seen/typing/online claims, no demo conversation); `git diff --check` clean.

## 42. Unresolved clinic questions (not answered)
1. May Patients start conversations or only reply? 2. Who receives a new Patient conversation? 3. Shared inbox, branch inbox or assigned Staff? 4. May Staff reassign? 5. May Dentists participate directly (and start)? 6. May Owner read or reply? 7. Should conversations have Archived/reopen states? 8. Expected response time? 9. When is a conversation overdue/escalated? 10. Should M16 conversion create an M17 conversation? 11. Message edits/deletes? 12. Attachments (would consume M14)? 13. Retention period? 14. Read receipts? 15. Will SMS/e-mail/social feed the same conversation (and so M18 delivery)? 16. Which M17 facts should M21 report?

## 43. Remaining blockers
No conversation-creation command (policy: who starts, who is a participant, routing); M16 → M17 handoff not wired; assigned/participant-only Staff visibility is a technical boundary; Dentist and Owner policy unresolved; no SLA/overdue/escalation; no external channels or M18 delivery; retention unresolved; no attachments or edit/delete by design; no message-quality/response metrics store (M21 undefined); pre-existing browser demo conversations are not migrated.

## 45. Pre-checkpoint gate (read markers, summary consistency, close authority, rate-limit deployment)

**Read-marker model — before this gate.** `conversation_participants.last_read_message_id` (+ `last_read_at`) holds the **internal serial id** of the last message that participant opened (never exposed). `POST /conversations/{id}/read` took no target: it set the caller's marker to the conversation's *current latest* message with a forward-only guard, and sending set the sender's marker to their own message. Findings: the client could not forge a marker (so a stale tab could not submit "message 15"), but (1) opening a thread marked **everything the server had** as read, including messages that arrived after the page loaded and were never displayed; (2) the same-conversation property and forward-only movement were enforced only by application code, not the database; and (3) a message's sender was not tied to a participant row in the database.

**Final design.**
- `POST /read` now **requires `up_to`** (the public id of the newest message the browser has actually displayed). The server resolves it **inside this conversation only**; a message of another conversation, an unknown id and a malformed id all give the identical refusal (`message_not_in_conversation`/422) so nothing about another conversation leaks. Marker fields (`last_read_message_id`, `message_id`, `user_id`, `seen_at`, `read_at`, …) are refused. Reading a **closed** conversation is allowed (closing never marks anything read — tested).
- **Monotonic:** one conditional `UPDATE … WHERE marker IS NULL OR marker < target` under the conversation lock; an older or duplicate target changes nothing. Ordering is the serial id, never a timestamp.
- **Database integrity (new, in the unapplied migration):** composite FK `(conversation_id, last_read_message_id) → conversation_messages (conversation_id, id)` so a marker can only reference a message of the same conversation (NULL = nothing read); a trigger refuses decreasing or clearing a marker and changing a participant's conversation/user; composite FK `(conversation_id, sender_user_id) → conversation_participants` so a message's sender must be a participant. No policy was added; the participant model is unchanged. Tested through raw SQL: a marker in another conversation, a non-existent marker, an older/cleared marker, a non-participant sender, and moving a participant row are all refused.
- The UI marks read up to the **newest displayed** message (an effect on that id; also after new messages arrive while the thread is open) and then **re-reads the server's unread** — the browser never decides a count.

**Concurrency (real processes, repeated 3×, stable).** 20 and 15 submitted at the same instant in both orders and as a duplicate pair → final marker is the furthest message every time; 15 then 20 advances; 20 then a stale 15 does not regress; a read racing a new message and a foreign-conversation message → exactly one accepted read, one refusal, one created message, the marker is exactly the requested message, later messages stay unread, the other conversation is untouched.

**Unread semantics (final, tested).** Unread for a participant = messages in this conversation, authored by someone else, with a serial id after that participant's marker. Own messages are never unread to their sender; messages at or before the marker are read; reading up to message 2 of 5 leaves 3 unread regardless of paging or page-load time; closing does not mark anything read; the request cannot supply the marker.

**Summary/badge consistency.** `GET /conversations/summary` and every list row use the **same** subquery (`summaries()`), so they cannot disagree (tested through zero, one, several conversations, own messages, marker advancement and a stale marker, another account's view, and Owner → 403). The Patient badge comes only from the summary: a failed or unreadable summary shows **no number** (browser-verified), never a fabricated zero; a genuine zero stays a zero.

**Cross-user read receipts: none.** The projections expose only the viewer's own `unread`; no participant's marker or "seen" is returned anywhere (tested: no `last_read`, `read_at`, `seen`, `receipt` or `delivered` in any payload). No receipt policy exists.

**Close-authority provenance (audited against the pre-hardening prototype).**
- **A. Staff may close — pre-existing:** `closeConversation` allowed `session.role` in `['staff','dentist']` when the actor could read the conversation (a participant); the Staff UI offered "Mark resolved".
- **B. Dentist may close — pre-existing:** same rule; the seeded conversation `c2` is a Dentist-participant thread ("Clinical clarification"); MODULE_COVERAGE.md lists "Patient/Staff/Dentist two-way threads, authorized replies, closure".
- **C. Patient cannot close — pre-existing:** the role check excluded `patient`, and the Patient screen only shows "closed" as read-only text.
- **D. Closed is final — pre-existing:** replies to a closed conversation were refused ("This conversation is closed"), and MODULE_COVERAGE.md records "no reopen workflow".
- Carried over narrower than the prototype: the prototype also required the local 'messages' permission for Staff/Dentist; the server uses participant + branch link instead (the local permission model is not server data). **No authorization was added or broadened, so no remediation was needed.** **CLINIC POLICY CONFIRMATION REQUIRED** for who may close.

**Rate-limit deployment.** The limiter (20/minute, 200/hour per account, values unchanged) uses Laravel's cache. `.env.example` sets `CACHE_STORE=database` (config default `database`), which is **shared by every application instance that uses the same database**; the `array` store (tests only) and per-server `file` stores count each instance/request separately and would multiply the effective limit. **DEPLOYMENT REQUIREMENT:** run every instance against one shared cache store (database or Redis) so the limits are global. No infrastructure was added.

**Verified unchanged:** database-enforced message immutability (model, builder and raw SQL edits/deletes refused), one participant row per user per conversation, role + link rechecks under the lock, send idempotency and the send-vs-close race, RESTRICT retention, no conversation-creation command (honest empty state), M16/M18/M7 boundaries.

**Final verification (gate, final tree):** Messaging 22 tests / 392 assertions (5 real-process concurrency tests, re-run 3×, stable); cross-module Inquiries 17 (M16 unchanged), Patients 31, Assistant 85, Audit 40 pass; **full backend 649 passed / 6,596 assertions**; frontend **747 passed** (m17 file 10); smoke 16 groups; build passes; browser QA **233 checks**, 0 failures, 0 errors, 0 px overflow (adds: read marker sent as the newest displayed message only, unread badge from the server count, unavailable summary shows no number).

## 44. Verdict
**B.** Every engineering criterion that does not depend on unresolved clinic policy is met; none of those policies was invented.
