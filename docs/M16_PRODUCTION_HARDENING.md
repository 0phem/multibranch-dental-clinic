# M16 — Social Media & External Inquiry Management: production hardening

Branch `feature/m16-external-inquiry-production-hardening`, from `e7c2d80` (M7 checkpoint). Uncommitted. **Verdict B.**

## 1. Starting git state
Clean, synchronized tree on `feature/m7-patient-ai-support-production-hardening` at `e7c2d80`; new branch created from it. No merge to main.

## 2. Architecture discovered (read-only audit)
M16 was a **purely frontend/browser-local prototype**: `inquiries` lived in `localStorage` (seeded with two demo inquiries "Prospective Patient"/"Nicole Reyes" via Facebook/Instagram), commands in `src/communication.js` (`createInquiry`, `updateInquiry`, `convertInquiry`), a Staff page in `FinanceCommunication.jsx`, and dashboard/analytics counters. There was **no backend table, endpoint, model, history, authorization, webhook or provider configuration** (the only backend mention was an automation rule's text). Prototype behaviour that the repository evidences: Staff capture an inquiry (source Facebook/Instagram/Website, name, contact, topic) that is assigned to that Staff member and branch; statuses Open → Responded → Closed, or Converted by linking an existing appointment; only the assigned Staff in their branch with the inquiries permission could see it.

## 3. Authority before/after
Before: browser-local arrays. After: **Laravel/PostgreSQL authority** (new `inquiries` + append-only `inquiry_history`; Staff-only API). In a clinic-server session the local inquiry commands refuse ("managed on the clinic server") and the local demo inquiries are never counted; the prototype survives only as a labelled **offline demo preview** with no server session.

## 4–5. External source/channel model and direct-integration status
**NO DIRECT SOCIAL PLATFORM INTEGRATION IMPLEMENTED — and none was added.** `source` ∈ {Facebook, Instagram, Website} is the channel *reported by Staff* (no other platform was invented); `capture_method` is a constant `staff_manual` (DB CHECK) and the API returns `capture: "Recorded manually by Staff"`. There is no webhook, token, provider id, delivery status or credential anywhere (tested: no such column, no `Http::`/webhook/Anthropic/M7 code in M16, no Meta/WhatsApp service config, no outbound request ever sent).

## 6. Lifecycle (named commands only; no generic status update)
Existing prototype states kept exactly: `Open → Responded | Closed | Converted`, `Responded → Closed | Converted`; **Closed and Converted are final** (also enforced by a DB trigger). Commands: `POST /inquiries` (capture), `/respond`, `/close`, `/convert`; each needs `Idempotency-Key`; respond/close/convert need `expected_revision` (stale → 409); repeating the same target is a no-op, not an error. No Cancelled/Assigned/In Progress/escalation state was invented. **"Responded" only records that Staff replied outside this system** — nothing is sent, delivered, read or synchronized, and the UI says so.

## 7. Assignment
The inquiry is assigned to the Staff member who recorded it (no routing rule exists; no automatic assignment by city, service, branch or load; no reassignment command). Visibility = assigned Staff **and** current branch authorization — carried over from the prototype and labelled a **technical boundary, not clinic-approved ownership policy**. Authorization is re-checked under a row lock, so removing a Staff member's branch scope ends access immediately.

## 8. Branch behaviour
A branch (`branch_ref`) must be supplied explicitly, exist, and be in the Staff member's scope; nothing is routed by branch. Branch values are internal operational references (legacy_ref + name) shown to Staff only; no public branch name or b1/b2/b3 mapping is exposed to inquirers (there is no inquirer-facing surface). An out-of-scope or unknown branch filter matches nothing and reveals nothing.

## 9. Patient linkage / identity matching
An inquiry starts with **no Patient**. A Patient is attached only by the explicit `convert` command, from an **existing, non-cancelled appointment in the inquiry's branch** (the appointment's Patient). No matching by name/phone/email, no Patient or user is created, no M4 data is changed (tested with an inquiry named exactly like another Patient: `patient_id` stays null; Patient/appointment/user/person counts are unchanged by conversion).

## 10. M17 boundary
Conversion creates **no conversation**: the prototype created a local conversation on conversion; the server version deliberately does not, because M17 owns ongoing conversations and is not hardened. Nothing pretends an M17 conversation exists (tested: no conversation row, no notification/mail code).

## 11–13. M6, M7, M25 boundaries
M6: M16 only links an existing appointment (read + lock); it never creates/reserves/changes one (appointment status/revision untouched, tested). M7: no reuse of the assistant provider or any LLM (source scan test). M25: inquiries are never marketing contacts and no consent is inferred.

## 14–15. Authorization matrix
| | Guest | Patient | Staff (assigned + branch scope) | Dentist | Owner |
|---|---|---|---|---|---|
| capture | 401 | 403 | allowed (branch in scope) | 403 | 403 |
| list / view (+history) | 401 | 403 | own assigned only | 403 | 403 |
| respond / close | 401 | 403 | own assigned only | 403 | 403 |
| link appointment/Patient | 401 | 403 | own assigned only | 403 | 403 |
| edit fields / reassign / link branch | no endpoint | – | – | – | – |
Owner and Dentist are deliberately denied (no confirmed contract; fail closed); Owner dashboard shows "Managed by Staff" instead of a fabricated count. There is no Patient self-service and no public submission endpoint (so no public rate limiting was needed).

## 16. IDOR / mass assignment
Public ULID route binding; numeric/malformed/unknown ids → 404; other Staff (other branch, same-branch colleague, no scope) → 403 on show/commands and absent from lists. Capture and command requests **refuse (422)** injected `id`, `public_id`, `status`, `revision`, assignee/created-by, `branch_id`, `patient_id`, `appointment_id` (on capture), `capture_method`, external/provider/platform ids, `delivery_status`, timestamps, `history`, `audit`.

## 17. Untrusted content / XSS
Text is bounded (name 120, contact 200, topic 500), control characters and line breaks (in single-line fields) refused, non-ASCII accepted. It is stored and returned **verbatim as data** (tested with script/`onerror`/`javascript:`/short-link text) and the UI renders only React text (no `dangerouslySetInnerHTML`, no anchors, no fetch/preview — source-scanned and browser-verified: no injected script or handler ran, no image/link element created). No URL in an inquiry is ever fetched server-side.

## 18. Privacy / logging
Detail and list projections expose only Staff-needed fields (no internal ids, actor ids, tokens). No inquiry text is logged. History stores actions/status changes, never inquiry text. No transcript is copied into M22.

## 19. Pagination
`GET /inquiries`: keyset, newest first by internal id, `per_page` 1–100 (default 50), public-id cursor, filters `status`/`source`/`branch_ref` applied after the authorization scope; foreign/unknown cursors → empty page; malformed input → 422. The Staff page loads 25 at a time with "Load older inquiries", an honest "Showing N… older inquiries are available / that is all of them", and a recoverable "Older inquiries unavailable — Retry". The old local prototype had no cap because it held everything in the browser.

## 20–21. Concurrency and idempotency
Real-process races (3): two conversions to different appointments → exactly one wins, the Patient is always that appointment's Patient, one history row, one audit event; respond vs close → one consistent final state with matching history; a double-submitted capture with one key → one inquiry. All commands take the inquiry row lock and use the shared `Idempotency-Key` mechanism (same key + same body replays; different body → 422; a new key with identical text is a **separate** inquiry — never deduplicated by text/contact).

## 22–23. History and M22
`inquiry_history` is append-only (trigger) with server actor/role/time and from→to status only. **One** M22 event: `inquiry.linked_to_patient` (identifiers, appointment public id, state change, revision — never inquiry text), written in the convert transaction because it is the only M16 action that touches identity. Capture/respond/close stay in module history (M22 must not copy every inquiry).

## 24. Frontend / demo findings
New `pages/Inquiries.jsx` + `inquiries-api.js` (server worklist, capture form with a stable idempotency key per attempt, respond/close/link, loading/empty/error/Retry, paging). **Misleading prototype text removed:** "…would generate reminder tasks after the configured response period" (an invented response period) and the wording that implied an automated follow-up. The demo page is labelled "Offline demo preview" and unreachable with a clinic account. Staff dashboard "N new social inquiries" and Owner/analytics inquiry counters no longer read the browser's demo data in a server session.

## 25. Schema
New forward-only migration `2026_10_15_000100_create_inquiry_tables.php` (CHECKs on source/capture/status/converted/closed; NOT applied to `dental_clinic`; tests ran on `dental_clinic_test`).

## 26–27. Files and tests
Backend: migration; `Inquiry`, `InquiryHistory`; `InquiryService`; `InquiryController`; `InquiryResource`; `CreateInquiryRequest`, `InquiryCommandRequest`; routes; tests `InquiryTest` (11) and `ConcurrentInquiryTest` (3). Frontend: `api-client.js`, `inquiries-api.js`, `pages/Inquiries.jsx`, `pages/FinanceCommunication.jsx`, `communication.js`, `pages/Dashboards.jsx`, `pages/Admin.jsx`, `tests/m16-inquiries.test.js` (6), `scripts/m16-inquiry-browser-qa.mjs`.

## 28–35. Results
Superseded by the final gate run in §39 (earlier run: 624 backend / 735 frontend / 110 browser checks)., 0 failures, 0 errors, 0 px overflow (Staff/Owner/Dentist/Patient × 375/430/768/1024/1440); `git diff --check` clean.

## 36. Unresolved clinic questions (not answered)
1. Which social platforms are official clinic channels? 2. Will M16 integrate directly with them? 3. Who receives new inquiries? 4. Are inquiries assigned by branch, Staff member or a shared inbox? 5. What determines branch routing? 6. What response time is expected? 7. When is an inquiry overdue? 8. Who may escalate? 9. When does an inquiry become an M17 Patient conversation? 10. How does an unknown person become/link to a Patient? 11. May Dentists answer external inquiries? 12. How long is inquiry history retained? 13. Should Staff record replies sent outside the system (supported today as a status flag only)? 14. May marketing consent ever be collected from inquiry contacts? 15. Which outcomes should M21 report?

## 37. Remaining blockers
No direct platform integration (and none is approved); assignment/ownership and visibility are a technical boundary pending policy (assigned-only; no shared inbox/reassignment); no response SLA/overdue/escalation; M17 handoff not implemented; Patient-link/identity policy; inquiry retention unresolved; Owner/Dentist access undefined (fail closed); no reply text/outbound channel (by design); pre-existing local inquiries in browsers are demo data and are not migrated (nothing is fabricated into the server).

## 39. Pre-checkpoint gate (conversion provenance, source taxonomy, metrics, history)

**Converted semantics — exact provenance (audited against the pre-hardening prototype `communication.js` `convertInquiry`, `MODULE_COVERAGE.md` row M16 and `ERD_v2_Data_Dictionary.md`).**
- **A. "Converted = linked to an existing appointment/Patient": pre-existing.** The prototype's `Converted` status is set only by `convertInquiry`, which takes an existing appointment and records `bookedAppointmentId` and the appointment's `patientId`. `MODULE_COVERAGE.md` states "conversion links an existing validated booking" and "link booked appointment…"; the data dictionary says an inquiry "can convert into a patient/appointment without losing source history".
- **B. Same branch: pre-existing.** The prototype refused an appointment whose `branchId` differed from the Staff member's session branch, and an inquiry was only visible/actionable when its `branchId` equalled that session branch — so appointment branch = inquiry branch.
- **C. Non-cancelled appointment: pre-existing** (`a.status==='Cancelled'` refused).
- **D. Linking the appointment's Patient: pre-existing** (`patientId: a.patientId`; an existing different patient link was refused).
- Also pre-existing and kept: only Open/Responded can convert; an inquiry links one appointment once (same appointment = no-op, another = refused).
- **Not carried over (deliberately narrower):** the prototype also created/linked a local conversation; the server version creates none (M17 not hardened). **Nothing was invented in the conversion rule, so no remediation was needed.** The command stays explicit and transactional; the appointment is locked and read only (appointment status/revision unchanged, tested), no Patient is created/merged, no conversation exists. New tests added for key replay, a reused key with another appointment, and no side effects.

**Source taxonomy provenance.** Facebook, Instagram and Website are **pre-existing**: the prototype's demo data uses Facebook and Instagram and its capture form offered exactly Facebook/Instagram/Website; the data dictionary describes "social/web/chatbot channels". No platform was added. They stay a legacy/manual taxonomy and their meaning is now explicit in the UI and here: **a source is only where Staff say an inquiry came from** — not an official clinic account, not a connected platform, not fetched automatically, not a delivery route. The column is now "Reported source", the form field "Source reported by Staff", the banner says it "does not mean the clinic has an official account there" and that the system "is not connected to Facebook, Instagram, the website or any other platform, fetches nothing from them and sends no messages". **OFFICIAL CHANNEL POLICY UNCONFIRMED.**

**Dashboard / analytics truthfulness (final behaviour, per surface).**
- *Staff dashboard "Open inquiries"*: **A — authoritative server data.** New Staff-only `GET /inquiries/summary` returns counts for the same scope as the list (assigned to the caller, authorized branches); a genuine zero is a zero. While loading the card shows "…", if the request fails it shows "Unavailable" (and the "everything is on track" claim is withheld) — never zero. Demo inquiries cannot affect a server session.
- *Owner dashboard "Open inquiries"*: **C — "Not available to Owner".** The M16 API denies Owner and no Owner endpoint was added for a counter.
- *Analytics "Communication"*: with the server executive summary the metric is absent (**B — hidden**); in the client-side fallback in a server session it shows **"Unavailable"** (**C**) with a note that no authoritative communication count exists (M16 is Staff-only, M17 is not server-backed, M21 has not defined this report). **Unavailable is distinct from zero everywhere** (tested: failed/forbidden/unreadable summary → failure, loading and unavailable are different states from a real 0). Left untouched: the Owner dashboard's "Active conversations" row is an M17 local-prototype count (M17 scope).

**`inquiry_history` append-only — exact enforcement: A, database-enforced.** A `BEFORE UPDATE OR DELETE` trigger raises for every row (model `update`/`delete`, query-builder, raw SQL, and an actor change are all tested and refused). It is not tamper-proof against a database owner who drops the trigger. No client route can create, change or delete history (`/inquiries/{id}/history` does not exist → 404) and a client cannot supply actor, role, time or history (422); every row is written by the server commands with the server actor/role/clock. **FK/retention finding:** the history's actor FK was `ON DELETE SET NULL`, which would have been an UPDATE of an append-only row (blocked by the trigger, making the intent contradictory); it is now `RESTRICT`, so deleting an account that wrote history, or an inquiry that has history, is refused (tested) rather than blanking or destroying records. No retention period was invented: **RETENTION POLICY REQUIRED.** (Migration edited in place; still unapplied to `dental_clinic`.)

**Final verification (gate, final tree):** Inquiries 17 tests / 304 assertions (3 concurrency tests stable); cross-module Reference 43, Patients 31, Appointments 75, Audit 40 pass; **full backend 627 passed / 6,200 assertions**; frontend **737 passed** (m16 file 8); smoke 16 groups; build passes; browser QA **140 checks**, 0 failures, 0 errors, 0 px overflow (incl. real Staff count, failed count shown as unavailable, Owner/analytics without a fabricated zero, source shown as reported, inert malicious content, paging + Retry).

## 38. Verdict
**B.** Every engineering criterion that does not depend on a platform decision or unresolved clinic policy is met; none of those was invented.
