# Current Frontend Scope

Scope at protected implementation checkpoint `dac864e`, through Phase 3.5. Approved module meanings and ERD concepts remain requirements; this document distinguishes implemented frontend behavior from future infrastructure. See [reconciliation and policies](DOCUMENTATION_RECONCILIATION.md).

## Implemented frontend behavior

| Area | Current behavior | Boundary |
| --- | --- | --- |
| Identity/access | Canonical PERSON identity; linked accounts and operational profiles; current account, role, profile, permission and branch checks in shared commands, sensitive selectors and page navigation | Demo sessions, not secure authentication. Account Active/Inactive differs from scheduling Available/Unavailable |
| Administration | Owner-only validated account, branch/service and personnel commands; explicit desired-state updates; account/profile synchronization | No unrestricted clinical authority; existing administrative exceptions are listed below |
| Scheduling | Branch → Service → Dentist preference → Date/Time → Review; manual and Find Best share validation of current catalog, hours, shift, capability, Patient/Dentist overlap and future time | No booking payment; no invented cancellation/reschedule cutoff |
| Admission/queue | Staff scheduled Check-In and walk-ins; one linked arrival/queue per scheduled encounter; own Patient position, own Dentist queue; reasoned priority and Staff absence controls | No Patient self-Check-In command; wait/capacity values are estimates, not clinical duration predictions |
| Clinical | Exact encounter documentation, multiple actual Performed Procedures, draft revision checks and immutable completed care | No autonomous clinical decisions; no clinical-template library or amendment workflow |
| Financial | Completed procedures/configured fee snapshots → Draft → Review → Issued → exact full payment → Paid/Receipt | No arbitrary manual bill, partial payment, refund or real gateway. Zero-fee settlement remains unresolved |
| Prescription/Follow-Up | Explicit treating-Dentist decisions; entered medication and explicit authorization; private drafts; linked return appointment through the normal validator | No automatic prescribing; Staff schedules an existing obligation. Patient self-scheduling of their obligation is retained |
| HMO | Canonical encounter cases, requirement metadata, local checks, submission cycles, external-response records, Returned correction/resubmission, contacts and actionable Escalated state | Three fixed frontend checklist rules; no verified eligibility, provider API, protected file bytes or complete policy/claims subsystem |
| Communications | Separate Messages and Notifications; actual participants/recipients, independent read states, reply retry protection, scoped notification links, inquiry conversion links | No external social inbox, real email/SMS or cross-user transport |
| M23 | Shared event-driven administrative handoffs; contextual successes, selected attempted failures and warnings; deduplication; read-only Automation Monitor | No generic rules engine, critical-rule toggles, background worker or tamper-proof audit |
| Reporting | Operational projections, capacity/workload, Owner summaries and CSV export with formula escaping | M21 remains partial: period selector is ineffective and some branch/report scopes disagree; legacy totals are not verified accounting evidence |

## Lifecycle safeguards and recovery

Commands read the current synchronous store snapshot rather than trusting an old button or form. Missing identities, removed permissions/assignments, wrong branch/Patient/encounter and malformed links block sensitive actions. Valid retries reuse results or reject safely; retry ownership is checked. Treatment and Prescription draft revisions supplied by forms detect stale saves. This is not a universal record-version protocol or multi-tab locking.

Rescheduling preserves Patient identity and requires an unadmitted Pending/Confirmed appointment. Cancellation before clinical documentation may close an admitted queue/check-in and reopen its Follow-Up; this preserved Phase 1 behavior is distinct from rescheduling. Terminal records cannot be casually reopened. Away/Return preserves arrival time. Treatment completion alone closes clinical queue/appointment state.

Invoice processing checks completed procedures and their exact encounter, item arithmetic and unique ownership. Paid/Receipt requires linked completed full-payment evidence. Historical Paid demo records without that evidence remain available for Staff review, not valid Patient receipts. Prescription authorization retains Dentist identity/time/version; authorized records cannot be edited as drafts. No historical audit evidence is invented.

HMO responses must refer to the current pending cycle. Future/malformed pending/contact timestamps and foreign-case records block processing. Returned requirements can be corrected; Escalated remains unresolved. The documented **12-hour** frontend follow-up threshold is retained; it is not a claim of a verified insurer SLA. HMO historical outcomes are labeled historical and may require review.

Notifications revalidate destination ownership, state and permissions; stale links become unavailable. Conversations require explicit participants and current scope; closed threads reject new replies. Mark All Read affects only the current notification recipient. Normalization/rendering do not create workflow events.

## Roles and explicit exceptions

Patient reads their own care, authorized prescriptions, Follow-Ups, appropriate invoices/receipts and safe HMO status, and participates only in their own conversations. Staff responsibilities depend on current subrole permissions and branch; Staff cannot choose treatment, prescribe or create clinical Follow-Up need. Dentist controls assigned clinical encounters and authorization, not Staff payment/HMO processing.

Owner/Admin administers accounts/configuration and has oversight. Existing Phase 1 shared commands explicitly also allow Owner administrative booking/cancellation, admission, operational queue actions and Patient registration, even though those worklists are absent from Owner navigation. This documented exception is not a grant of Treatment, Prescription, Payment, HMO processing or Message participation. See the [role matrix](DOCUMENTATION_RECONCILIATION.md#role-and-permission-clarifications) for subroles and confirmation needs.

## Clock and local persistence

Asia/Manila is the centralized clinic clock. Commands read time on execution; screens refresh periodically. Foreground Staff timer evaluation supports HMO follow-up, appointment reminders and queue-delay updates. Closing the app stops this work. Existing reminder windows are implementation foundations, not clinic cancellation/no-show policies.

Collections persist in browser localStorage. Canonical IDs remain authoritative; recoverable legacy labels are compatibility inputs, not new relationship keys. Ambiguous ownership is withheld rather than converted to role-wide access. Only pristine/reset demo dates rebase; saved history does not move to today.

Unreadable JSON/collection data is preserved: persistence/migration writes are blocked and the workspace presents recovery feedback. Write failures warn that changes remain only in the open workspace. This does not recover corrupted records automatically, provide backups, or guarantee atomic multi-collection saving. Reset intentionally discards local demo work.

## Future backend/integration responsibilities

A production backend must enforce identity, authorization, scope, record versions, idempotency, relational/financial constraints and immutable audit independently of the client. It must provide secure authentication, encrypted/protected storage, database transactions/locking, durable recovery and authoritative time. Client-side checks can be bypassed by someone controlling the browser.

No real payment processing, HMO-provider verification, email/SMS/social delivery, WebSockets, background scheduler or cross-device synchronization exists. Card/Electronic records explicitly simulate payment; recording an HMO submission/contact/response does not send it. General Patient document cards are illustrative; HMO stores metadata only.

The frontend does not enforce undisclosed clinic timing/override/amendment policies. The central [nine-question policy register](DOCUMENTATION_RECONCILIATION.md#policy-decision-register) remains unresolved. M24/M25 remain Proposed Enhancements. Phase 4 will address UI/UX; no redesign or infrastructure is included in this reconciliation.

## Retained future requirements

The older approved roadmap also names administrative chatbot/Staff handoff, report/PDF presentation, HMO analytics visualization, inquiry SLA/conversion polish and profile/detail UX. Those requirements are not removed by reconciliation or implicitly implemented: the existing assistant is limited navigation/workflow help, not a connected chatbot/handoff service. Their future sequencing requires explicit scope; M24/M25 remain Proposed Enhancements. UI polish belongs to Phase 4, while new integrations or business workflows require separate authorization.

## Verification scope

260 passing domain/regression/safeguard tests; React SSR render/integration scenarios; production Vite build passing at the checkpoint. These do not establish browser interaction correctness, accessibility certification, security penetration coverage, device compatibility or backend integration. The existing >500 kB build warning is a later performance input.
