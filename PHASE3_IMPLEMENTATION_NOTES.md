# Phase 3 implementation notes

## Scope and protected checkpoint

Phase 3 extends the existing React/Vite frontend and shared workflow commands. Protected Phase 2 HEAD: `c440d5f` (`Complete Phase 2 clinical and billing workflow`). The initial clean baseline passed all 100 Phase 1/2 tests and the production build. Those test files and `src/phase2.js` remain unchanged. Phase 3 changes are intentionally uncommitted.

No backend, external provider connection, email delivery, WebSocket, payment gateway, clinical decision automation, analytics redesign, or Phase 4 branding work is introduced. M24/M25 remain Proposed Enhancements.

## HMO responsibilities and lifecycle

- **M12:** prepare a clinic-side case for an explicitly selected insured appointment/treatment; prefill canonical patient, branch, provider, membership and encounter references; track local requirements.
- **M13:** record submission performed outside this application and externally received provider outcomes. Staff supplies the channel and tracking note. The application never independently verifies coverage or invents an approval number.
- **M14:** calculate elapsed pending time, create follow-up work, record Staff contacts and escalate unresolved cases.

The lifecycle is `Missing Requirements / Draft → Ready for Submission → Pending → Approved / Rejected / Returned`. Returned responses identify requirements needing correction. Correcting and locally validating them restores Ready for Submission; resubmission retains the case ID, increments its submission cycle and returns to Pending. Previous responses and submissions remain in history. Stale responses for an earlier cycle are rejected.

`Pending → Escalated` requires overdue pending time and a recorded contact for the current submission cycle. Escalated remains pending: Staff can record further contacts and any externally received response, including Returned. Escalation is neither approval nor rejection. Final Approved/Rejected cases cannot be silently reopened by document changes.

Case preparation is idempotent by exact appointment (or treatment for an encounter without an appointment). Completion links an existing appointment case to the treatment rather than making another case. Missing membership does not fabricate a policy or case. Conflicting patient/branch/treatment/appointment relationships and duplicate legacy encounter cases require review and cannot be processed through another encounter.

### Requirements and documents

The frontend catalog defines HMO Card, Valid ID and Dentist treatment request rules. Each case stores rule IDs and deterministic case requirement IDs. States are Missing, Provided and Validated locally. Patient document input stores metadata only; Staff must validate local completeness. A completed treatment may supply its own treatment-request reference. Local completeness never sets a provider approval outcome.

Patients receive only a safe case projection: their own status, public outcome, dates and requirement labels/states. Membership snapshots, contact notes, response notes, internal identities and submission history are excluded. Staff processing requires the HMO permission and matching actual/session branch. Dentist visibility requires the linked treating Dentist identity and exposes status only. Owner scope supports oversight without operational controls. Inactive accounts cannot read these views.

### Time and contacts

All commands use the centralized injectable clinic clock. Timezone-less legacy clinic timestamps are interpreted in Asia/Manila (+08:00). Pending duration is calculated from submittedAt; terminal duration ends at providerRespondedAt. Persisted static pendingHours is discarded. Missing timestamps are not replaced with fabricated submission dates; malformed/future pending timestamps block processing until reviewed.

The simple frontend threshold is 12 hours (`HMO_PENDING_HOURS`). Explicit timer evaluation creates at most one follow-up task per case/submission cycle. Staff login and a foreground interval evaluate eligible work while the application is open. This is not a background scheduler. Repeated evaluation does not duplicate tasks, events or alerts.

Contacts store case ID, submission cycle, responsible Staff user, timestamp, method, note and next action. Recording contact means Staff recorded outreach; it does not imply a provider reply. Provider responses are a separate history. Cross-case replay IDs and malformed contact ownership are rejected.

## Notifications (M18)

Notifications are separate records from human conversations. Each generated record carries recipientUserId (and appropriate person/patient/Dentist/branch IDs), event type and event ID, related entity type/ID, concise title/body, timestamp and recipient-specific read state. Broad role names never grant notification ownership. Branch notifications expand to individual active permitted Staff accounts.

| Action | Intended recipient / context |
| --- | --- |
| Appointment created, changed, cancelled | Exact Patient / appointment |
| Check-in, queue update, next-patient or significant delay | Exact Patient / encounter or queue |
| Treatment completed, follow-up required | Exact Patient / treatment |
| Prescription task requested | Treating Dentist / treatment |
| Prescription authorized | Exact Patient / prescription |
| Draft invoice prepared | Permitted branch Staff / invoice |
| Invoice issued, payment receipt available | Exact Patient / invoice |
| Follow-up booked, rescheduled, cancelled | Exact Patient / linked appointment |
| HMO requirements missing | Exact Patient and permitted branch Staff / case |
| Patient requirement metadata provided | Permitted branch Staff / case |
| HMO submission or external response recorded | Exact Patient / case; Returned also alerts Staff |
| HMO overdue or escalated | Permitted branch Staff / case |

Foreground appointment reminder and queue-delay evaluation uses controlled time and stable event keys. There is no true background delivery. Notification text avoids diagnosis, medication and internal operational notes.

The bell exposes own unread count, recent notifications and full history, individual read and current-user Mark All Read. Navigation validates the actual referenced entity and rebuilds canonical context; stored arbitrary navigation context is not trusted. Retry deduplication uses event/action and recipient keys. Reading records changes only the current recipient, not another user's flags.

## Messages (M17) and inquiry linkage (M16)

Conversations have explicit participantUserIds, assignedUserId, patientId and branchId. Messages retain senderUserId; unreadUserIds and readAtByUser belong to individual participants. Patient access requires their linked account; Dentist access requires explicit participation and a matching Dentist account. Staff access additionally requires branch scope and messaging permission. Owner oversight does not grant conversation access.

Opening/marking a conversation read clears only the current participant. Replies require authorized participation, an open thread, nonempty text and an idempotency command ID. A replay cannot append to another conversation or impersonate another participant. Closing a thread is limited to its assigned operator. Replies do not create system notification records or combine unread counters.

Inquiry conversion retains inquiry/conversation/appointment links, validates patient and branch context, and reuses existing conversation linkage. A unique legacy named assignee may be migrated to an actual user; a broad role cannot supply ownership. Existing Receptionist inquiry capability is retained through the current messaging permission where the old seed lacks a distinct inquiries permission.

## M23 shared orchestration and monitoring

`workflow.js` remains the command boundary, composing `phase2.js`, `hmo.js` and `communication.js`. `orchestration.js` centralizes contextual event creation and recipient notification delivery. Treatment completion preserves the exact Phase 2 queue/appointment/invoice/prescription/follow-up chain and adds applicable HMO preparation. Clinical judgment remains entirely Dentist-owned.

Events preserve stable command keys, module/type, result/status, timestamp, actor and relevant entity IDs. Notifications link back to event IDs. The event ledger is retained rather than truncated, preserving replay deduplication. No generic rule engine or background worker is introduced.

Phase 3 command failures discard business patches and record one contextual Failed event per deduplicated attempted failure. Rendering never logs a failure. Phase 1/2 failure return contracts remain intact. If HMO preparation fails after valid treatment completion, the clinical/financial transition is retained and the result plus monitor expose a warning explaining the failed handoff. It is not reported as a fully successful HMO chain.

The Owner Automation Monitor is a read-only projection of workflow records: recent successes, failures, warnings, affected entities, actors and timestamps, with descriptive rules. It cannot toggle critical business or privacy rules. M21/M22 remain reporting layers over operational records, not new transaction stores.

## ERD mapping and compatibility

| Logical ERD | Frontend representation |
| --- | --- |
| HMO_PROVIDERS / HMO_REQUIREMENT_RULES | Canonical frontend catalogs |
| PATIENT_HMO_POLICIES | Existing patient provider ID/member fields; no invented eligibility engine |
| HMO_CASES / HMO_CASE_REQUIREMENTS | hmo cases with embedded requirement records |
| HMO_FOLLOW_UP_TASKS | Embedded per-case, per-cycle followUpTasks |
| PATIENT_DOCUMENTS | Requirement document metadata; no file bytes/storage service |
| CONVERSATIONS / CONVERSATION_MESSAGES | Separate conversations collection with embedded messages |
| PATIENT_NOTIFICATIONS | notifications collection, also identity-targeted operational Staff/Dentist notifications |
| SYSTEM_EVENTS / AUTOMATED_ACTIONS | Contextual workflowLog records and action outcomes; existing audit projection |
| WORKFLOW_RULES | Existing descriptive read-only catalog; protected command behavior |

Normalization is pure and produces no workflow events. Canonical IDs are authoritative; display branch/provider labels are derived. Known legacy names may recover IDs only unambiguously. Unknown assignee labels are retained for review during persistence but confer no access. Legacy broad-role notifications are not broadcast. Legacy thread sender identity is recovered only when its role matches the exact assigned account or linked Patient; unknown authors stay unresolved.

Legacy HMO document labels can recover local checklist state, not provider verification. Unknown provider/branch labels remain available for review; static timer and derived display fields are not persisted as competing facts. Existing externally recorded terminal statuses remain historical data. Malformed relationships are withheld from Patient access and operational mutation. Demo timestamp rebasing applies only to pristine seeds, never persisted submission history.

Actual legacy implementation differences repaired here are role-wide messaging/read ownership, static HMO pending-hour values and misleading local eligibility labels. The approved ERD already requires identity scope, external provider authority and protected rules. Its provider/service-specific checklist and separate policy/claim tables are broader than this frontend's fixed checklist and existing membership model; provider-specific policies, eligibility and claims integration remain future work. Older implementation-status documentation is not rewritten to erase these differences.

## Verification and limitations

The original 100 Phase 1/2 tests remain unchanged. Phase 3 adds focused domain, privacy, replay, migration and timing tests. `npm run test:smoke` checks all existing role/page renders, the clinical/financial chain, HMO return/resubmission/escalation, patient-safe views, scoped notifications/messages, read-only monitoring, persistence reload and render purity. This is React render/integration coverage, not a full interactive browser/accessibility audit.

Required final gates: `git diff --check`, `npm test`, `npm run test:smoke`, `npm run build`, `git status`. Final observed results are reported with the completed work.

Limitations: local frontend persistence only; no server enforcement or cross-device synchronization, real HMO API, actual email delivery, true background reminders, external payment processing, or document storage. Accounts without a linked portal user cannot receive a portal login experience. Ambiguous legacy ownership and invalid encounter/timing records need explicit data review; the application does not guess replacements. Foreground notification delivery does not mean an external service was contacted.

Phase 4 preparation only: retain the verified workflow fixtures while later applying the production UI skill, official existing logo, responsive Patient experience, Staff/Dentist interaction polish, Owner oversight presentation and accessibility/browser testing. No Phase 4 work is included here.
