# Phase 2 — clinical-to-financial workflow

> Historical Phase 2 record. Phases 3–3.5 supersede its deferred HMO/communications and historical receipt-display behavior; unsupported Paid records are now withheld as Patient receipts. See [current reconciliation](DOCUMENTATION_RECONCILIATION.md).

Phase 1 remains the foundation. This change preserves React/Vite, ClinicProvider, browser persistence, the Manila clock, exact queue encounters, and the shared appointment validator. No backend, external integrations, dependencies, branding changes, or Phase 3 work were introduced.

## Commands and orchestration

`saveTreatment` / `completeTreatment` now validate and persist multiple performed procedures. Draft saves keep the encounter In Treatment and create no financial or clinical downstream obligations. Completion closes only the linked queue/check-in/appointment, prepares one itemized Draft invoice, exposes a prescription task only for an explicit Dentist request, creates one follow-up obligation only for an explicit Dentist request, and records workflow events. Prescription tasks are derived from completed treatment requirements, not empty prescription records; this preserves the original Phase 1 contract.

`src/phase2.js` provides bounded helpers and shared `reviewInvoice`, `issueInvoice`, `postPayment`, `savePrescription`, and `authorizePrescription` commands through the existing command runner. ClinicProvider commits patches and advances its synchronous snapshot before the next command. Pages no longer independently issue/pay invoices or author prescription/follow-up records.

Important commands reuse existing records on retries without additional events. Draft prescription saves avoid unchanged writes; authorized prescriptions and completed treatments cannot be edited through these commands. These guarantees apply to this single-client prototype, not multi-tab/server concurrency.

## Clinical records and ERD mapping

- `treatments` maps to TREATMENT_PLANS. It retains `patientId`, `dentistId`, `branchId`, `appointmentId`, `queueEntryId`, requested service context, and explicit clinical decisions.
- `treatment.procedures[]` maps to TREATMENT_PROCEDURES: child ID, treatmentId, serviceId, quantity, configured unitFee snapshot, amount, and procedure notes.
- `invoice.items[]` maps to INVOICE_ITEMS: child ID, invoiceId, treatmentId, procedureId, serviceId, quantity, unitFee, and amount.
- `invoice.payment` maps to one PAYMENTS record: payment ID, invoiceId, patientId, branchId, amount, method, status, Staff identity, time, simulation marker, and receipt reference. No partial payments are introduced.
- `prescriptions` and `prescription.items[]` map to PRESCRIPTIONS and PRESCRIPTION_ITEMS, with explicit Dentist authorization, timestamp, user ID, and version.
- `followups` maps to TREATMENT_FOLLOW_UPS, retaining the source treatment/patient/Dentist/branch and the explicitly linked return appointment.
- Existing workflowLog/audit records retain the SYSTEM_EVENTS/orchestration concepts.

Children are embedded in their owning persisted frontend collection instead of adding parallel collections and synchronization mechanisms. IDs are the relationships. Service names are derived for new records; historical fee snapshots do not change when catalog prices change later.

The treatment UI begins with no confirmed procedures. The Dentist adds actual procedures explicitly. The single-service command input remains supported for Phase 1 callers documenting a performed procedure; it is converted to a structured line. Existing drafts can expose their previously documented service for review. No diagnosis, medication, procedure, or follow-up decision is generated.

## Billing and prescription lifecycle

Billing: Draft → Review → Issued → Paid with a completed payment and linked receipt. Staff must open an itemized review before issuing. Payment requires the exact positive full amount and an issued unpaid invoice. Cash is Staff-recorded; Card/Electronic is prominently labeled a simulation. It does not contact or claim verification by an external processor. Zero-value bills may be issued but cannot be paid with a fictitious positive payment.

Only assigned Staff performs financial transitions. Owner/Admin keeps reporting oversight; Dentist and Patient cannot process payments. Invoice transitions verify source procedures, exact encounter links, unique invoice ownership, line arithmetic, totals, and payment state. Unrelated or malformed historical records cannot generate new charges/payment transitions.

Prescription: requested task → optional Draft → Authorized. Only the treating Dentist enters medication, dose, instructions/frequency, and optional duration. Patients only see their own authorized prescriptions. Multiple medication items are supported. Drafts remain private, and authorization retains audit information.

## Follow-up lifecycle

Open (displayed as Awaiting Scheduling) → Scheduled → Completed. The Dentist makes the clinical request in Treatment; the standalone page is a worklist and scheduling surface. Existing patient self-scheduling remains available alongside Staff scheduling. Known patient/branch/Dentist context is locked in the follow-up form.

Booking uses `saveAppointment` and the complete Phase 1 validator. Rescheduling retains the same appointment ID and cannot change the obligation's patient, branch, or Dentist. Cancellation/no-show returns a matching obligation to Open and clears the appointment link; rebooking creates a new link. Completion of the linked return encounter marks the obligation Completed. Missing or conflicting relationships are rejected; another patient's malformed follow-up is not closed.

## Patient experience

The existing dashboard's Your care card shows completed treatments and links to authorized prescriptions/follow-ups. Prescriptions, follow-ups, and itemized invoices/receipts use existing cards and controls without a visual redesign. Patient invoices remain hidden through Draft/Review. Shared selectors check ownership and clinical relationships; malformed cross-patient payment references are not exposed.

## Legacy compatibility and actual conflicts

- Older P0/scope documents describe implemented UI features as future work. Those features remain intact.
- The professor walkthrough mentions direct Staff queue completion. The approved current rule remains Dentist treatment completion; Staff cannot complete the queue independently.
- Phase 1 notes explicitly defer multiple procedures and full billing/prescription lifecycle work. This phase supersedes those implementation-status statements while preserving Phase 1 tests.
- Historical demo invoice `inv1` includes consultation and prophylaxis charges while treatment `t2` only documents a single performed service. Historical paid invoices lack structured payment records. They remain historical displays; no performed clinical work or payment audit is fabricated from their charges.
- Demo invoice `inv2` has `treatmentId: null`. It is retained for scoped Staff review, but financial processing is blocked. Malformed persisted records are similarly retained rather than silently repaired or deleted. An administrative legacy-reconciliation workflow is not part of Phase 2.
- Nullable appointment IDs for walk-ins remain the documented Phase 1 deviation from the older required appointment relationship.
- The ERD requires future server/provider verification for real electronic payment. This frontend's explicit simulation flag and copy distinguish simulated records from such verification.

## Verification and scope limits

Initial baseline: 37/37 tests and production build passed; `public/` was already untracked and was not changed.

The unchanged 37-test Phase 1 file is supplemented by 63 focused Phase 2 tests: 100 tests total, all passing. Render smoke checks cover all 38 existing role/page combinations plus itemized completion, prescription draft privacy/authorization, Patient Care, billing review/issuance/payment/receipt, follow-up scheduling, immediate repeated Provider commands, and persisted clinical/financial reloads.

Checks: `npm test`, `npm run test:smoke`, `npm run build`, and `git diff --check`. Render verification uses React server rendering, not browser interaction/device automation.

Deferred: legacy administrative reconciliation, major production UI/accessibility work, HMO/notifications/Automation Monitor/analytics redesign, chatbot and proposed enhancements. Backend authentication, secure RBAC, external payment/HMO/email integrations, and multi-user consistency remain outside the frontend scope.
