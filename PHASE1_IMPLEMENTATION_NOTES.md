# Phase 1 — shared contracts and encounter handoff

This pass preserves the approved React/Vite frontend, ClinicProvider, localStorage, role experiences, and M23 orchestration model. It does not add a backend or redesign the visual system.

## Files and responsibilities

- `src/clock.js`: live Asia/Manila clock, date helpers, deterministic test clock, pristine seed rebasing.
- `src/contracts.js`: durable branch references, legacy record normalization, role scope, exact encounter context, persistence serialization.
- `src/workflow.js`: shared commands consumed by ClinicProvider; booking, cancellation, admission, queue controls, clinical progress/completion, and patient creation.
- `src/store.jsx`: command integration, immediate state snapshot for repeated clicks, ID migration, clock refresh, persisted check-in collection, patient-edit/billing scope guards.
- `src/data.js`: live-date compatibility export; seed queue dates and checked-in appointment states; correct the seeded restoration appointment's dentist capability.
- `src/App.jsx`: demo session and encounter-aware page navigation.
- `src/pages/Scheduling.jsx`, `PatientFlow.jsx`, `Clinical.jsx`: existing screens use shared commands and exact scope/context.
- `src/pages/Dashboards.jsx`: clock/day filters and exact chart/continue-treatment links; no style changes.
- `src/pages/FinanceCommunication.jsx`: billing scope filter only; HMO and messaging workflows unchanged.
- `src/pages/Admin.jsx`: preserve branch IDs when editing personnel assignments only; analytics/PE unchanged.
- `src/layout.jsx`: branch choices derive from branch records instead of fixed names.
- `package.json`, `tests/workflow.test.js`, `scripts/render-smoke.mjs`: reproducible checks using installed tooling; no added packages.

## Shared commands

`saveAppointment(form, { appointmentId, commandId, followupId })`, `cancelAppointment(id)`, `checkInAppointment(id)`, `admitWalkIn(form, commandId)`, `updateQueue(id, status, extra)`, `saveTreatment(input, status)`, `completeTreatment(input, status)`, and `createPatientRecord(input)`.

Commands use the active demo session, validate scope, read the latest state snapshot, and commit their related collection changes together in React. Idempotency is record/command based; replaying an arrival, unchanged queue/treatment update, or completed treatment does not duplicate records/events. This is single-client frontend consistency, not database atomicity or cross-tab locking.

## Relationship and lifecycle assumptions

- `branchId` is authoritative. `branch` and appointment `service` are display projections. Staff/dentist branch assignment IDs survive branch renames. PERSON remains the identity source.
- Each scheduled appointment is one encounter with one check-in and one queue entry. An admitted appointment cannot be rescheduled; cancellation before clinical documentation closes its queue and reopens any linked follow-up obligation. Completed/no-show/cancelled appointments cannot be admitted again.
- Walk-ins have `appointmentId: null`, an explicit requested `serviceId`, and a recorded clinic day. One active arrival per patient/day prevents duplicate walk-in admission. Walk-ins check valid patient, branch, service, capability, availability, hours and shift; they join the queue without creating a reserved calendar slot.
- Encounter context includes `queueEntryId`, `patientId`, `appointmentId`, `dentistId`, `branchId`, `serviceId`, and `treatmentId`. A direct treatment link takes precedence. There is no patient + dentist + date matching.
- Dentist flow: Waiting → Called → open exact treatment → In Treatment → Completed. Only treatment completion closes its queue and appointment. Staff alone manages temporary absence, return, no-show, and reasoned emergency priority (Owner may also perform authorized administrative commands). Arrival timestamps never change when a patient is away.
- The dentist explicitly documents the performed procedure and selects the performed service. The existing single-service invoice model uses that service's configured fee. This pass does not introduce a multi-procedure billing editor.
- Prescription and follow-up decisions remain explicit dentist decisions. Completion records the existing prescription-required event/derived task and creates a follow-up obligation only when requested. It never writes medication or chooses a clinical decision.
- Staff worklists use their assigned branch; dentist operational context uses their dentist ID; patients see their records. Centralized longitudinal clinical history remains available within an authorized patient's chart, per M4. Cross-branch capacity alternatives are read-only references.

## Clock and saved-data handling

Scheduling, arrivals, queue day scope, treatment timestamps and touched dashboards use the central live Manila clock. Slots at/before the current minute cannot be newly booked. Provider refreshes clock-dependent screens every 15 seconds; commands read the clock again at execution.

Only pristine appointment/queue/clinical/billing/follow-up/prescription seed dates are rebased relative to their original demo day. Saved dates are never advanced on reload. Reset demo data explicitly recreates seeds for the current day. Legacy walk-ins with no recoverable date remain stored but are excluded from today's operational queue; no arrival day is invented.

Existing v4 localStorage records are normalized and recovered IDs persisted once. Branch-name fallback is compatibility-only. Unknown legacy relationships remain unassigned; historical text is preserved when an ID cannot be recovered. No migration deletes records or infers an encounter from patient/dentist/day. Existing corrupt/duplicate/orphaned historical records are not silently merged.

## Documentation alignment/conflicts

Approved context: README, ERD_ALIGNMENT, FINAL_UI_AUDIT, FRONTEND_SCOPE, MODULE_COVERAGE, PROFESSOR_DEMO_GUIDE, P0_IMPLEMENTATION_NOTES, P1_PRODUCTION_UI_REFRESH, and the ERD v2 dictionary/diagram.

- Older P0/final-audit/scope files still call implemented P1 UI features future work. This pass preserves those features.
- The professor walkthrough mentions Staff queue completion. The current explicit requirement controls: clinical completion belongs to the Dentist and completes the linked queue through treatment.
- ERD `TREATMENT_PLANS.appointment_id` is shown as required, while the approved UI includes walk-ins. This frontend uses an explicit queue/check-in encounter and nullable appointment ID for walk-ins; it does not invent a scheduled appointment or a backend schema change.
- The ERD models multiple performed procedures and invoice lines. This baseline represents one performed service per treatment; expanded procedure/charge editing remains later work.
- The original M4 documents describe cross-branch clinical history. Operational worklists are now scoped while the authorized centralized chart retains longitudinal history.
- The original seeded appointment a5 assigned a restoration to a dentist without that service capability. The pristine seed now uses the qualified Branch B dentist. Saved user data is not silently rewritten.

## Verification

- `npm test`: focused Node tests of shared contracts and transitions.
- `npm run test:smoke`: all 38 role/page combinations, Login/Module Coverage, created-patient selection, booking/check-in visibility, exact treatment/completion/billing, immediate repeated Provider commands, and persisted ID-only reload renders.
- `npm run build`: production Vite build.

The render smoke check uses React server rendering; it does not claim browser click, keyboard, layout, or device verification. No browser automation package was added.

## Deferred

HMO lifecycle issues, analytics filters, chatbot, PE modules, major dashboard/mobile/accessibility styling, full invoice exception/payment lifecycle work, multi-procedure clinical billing, comprehensive notification routing, and real multi-user/backend behavior remain outside this pass. Standalone prescription/follow-up authoring still uses the existing frontend flows; completion-triggered handoffs are centralized here.
