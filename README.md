# Multi-Branch Dental Clinic Operation System

React/Vite frontend for Patient, Staff, Dentist and Owner/Admin experiences. This is the canonical repository for the clinic operations project (client: Dr. Dana Roxas; Business Process Automation, Group 3 — BSIT 3B).

The protected implementation checkpoint is **`dac864e` — Complete Phase 3.5 safeguards and user acceptance hardening**. Phases 1–3.5 implement and test the frontend workflow with local persistence; they do not constitute a production backend or a finished production UI. Phase 4A (the shared UI foundation) and Phase 4B (the Patient experience, including the M24 Referral & Loyalty prototype) have since been completed on top of that checkpoint; the Staff, Dentist and Owner/Admin role experiences are later phases.

## Current workflow

**Appointment → Check-In → Queue → Treatment → Performed Procedures → Draft Invoice → Review → Issue → Payment → Receipt**

- Patient booking and its Suggested times use the same scheduling validator. Booking takes no payment. Staff records a distinct arrival; Dentist works from their own exact queue encounter.
- Dentist explicitly documents actual procedures and decides whether a Prescription or Follow-Up is required. Completion closes the linked encounter and prepares administrative handoffs. Nothing chooses diagnosis, procedures or medication automatically.
- Staff reviews itemized treatment-derived charges, issues invoices and records full payment. Card/Electronic is a labeled local simulation.
- HMO separates local requirements (M12), externally performed submission/provider-response recording (M13), and timestamp-driven contact/follow-up/escalation (M14). Local completeness and escalation never mean provider approval.
- Messages use explicit conversation participants. Notifications use individual recipients, independent unread state and validated destinations.
- M23 coordinates predefined administrative events/actions. Owner/Admin sees a read-only Automation Monitor, not switches for clinical or privacy rules.
- Phase 3.5 adds current-state authorization, encounter/financial integrity, finalized-record protection, stale draft/retry safeguards, storage warnings and spreadsheet-safe CSV output.

M1–M23 have frontend representations with the partial areas documented in [Module Coverage](MODULE_COVERAGE.md). **M24 and M25 are Approved Frontend Enhancements** (previously Proposed Enhancements): M24 Referral & Loyalty is implemented as a team-designed prototype that is not an established clinic program (Phase 4B.2), and M25 Marketing & Reactivation is approved with only a limited frontend campaign-draft preview today (it sends nothing); full management, consent, targeting, delivery and analytics are deferred to a later role phase. Analytics filtering has known limitations; see the [conflict register](DOCUMENTATION_RECONCILIATION.md#conflicts-retained-for-review).

## Run and verify

Use a Node.js version compatible with the Vite 7 dependency in `package.json`.

```bash
npm install
npm run dev
npm test
npm run test:smoke
npm run build
npm run preview
```

Open the URL printed by Vite. At Phase 4B the suite has **402 automated domain/regression/safeguard tests: 402 passing, 0 failing** (260 at the Phase 3.5 checkpoint), 13 passing React render-smoke/integration scenarios and a passing production Vite build. The build has an existing nonfatal JavaScript chunk-size warning. These checks are not full browser automation, accessibility certification, penetration testing or backend integration tests.

## Scope and demo data

Accounts use demo sessions and browser state. There is no server authentication/authorization, secure patient-data storage, database locking, cross-device synchronization, real payment gateway, HMO API or email/social delivery. Timers/reminders run only while the frontend is open. Local storage can fail and is not transactionally atomic across collections. See [Frontend Scope](FRONTEND_SCOPE.md).

Names, branch labels, staffing, fees and records in seeds are illustrative, not client facts. The clinic already uses digital booking, billing and records; prescriptions are a paper-based exception. This project addresses workflow coordination, not an entirely manual clinic. The [reconciliation record](DOCUMENTATION_RECONCILIATION.md#client-context) preserves the supplied business context.

Use **Reset demo data** only when intentionally discarding local demo changes. Saved historical dates do not advance on reload; pristine/reset demo seeds use the current Manila clinic date. Unreadable saved data is preserved and requires recovery rather than silent replacement.

## Documentation

- [Documentation Reconciliation](DOCUMENTATION_RECONCILIATION.md): source hierarchy, conflicts, policies and Phase 4 inputs.
- [Frontend Scope](FRONTEND_SCOPE.md), [Module Coverage](MODULE_COVERAGE.md), [ERD Alignment](ERD_ALIGNMENT.md).
- [Professor Demo Guide](PROFESSOR_DEMO_GUIDE.md), [Agent instructions](AGENTS.md), [Branding Alignment](BRANDING_ALIGNMENT.md).
- [ERD Data Dictionary](docs/architecture/ERD_v2_Data_Dictionary.md) and unchanged diagrams in `docs/architecture/`.
- [Phase 4B Patient experience and M24](PHASE4B_PATIENT_EXPERIENCE.md).
- Historical implementation records: [Phase 1](PHASE1_IMPLEMENTATION_NOTES.md), [Phase 2](PHASE2_IMPLEMENTATION_NOTES.md), [Phase 3](PHASE3_IMPLEMENTATION_NOTES.md), [Phase 3.5](PHASE3_5_SAFEGUARDS.md), [P0](P0_IMPLEMENTATION_NOTES.md), [P1 UI refresh](P1_PRODUCTION_UI_REFRESH.md).

Production UI/UX, accessibility and responsive polish belong to Phase 4: the shared foundation (4A) and the Patient role (4B) are complete, and the Staff, Dentist and Owner/Admin role passes remain. The application's visible identity is the clinic's own: **Dr. Dana E. Roxas — Dental Clinic**. It is rendered as text beside the unchanged official compact logo `public/images/logo.png`; the supplied `public/images/logo-with-name.png` is preserved unchanged but not rendered until its usage is confirmed. See [Branding Alignment](BRANDING_ALIGNMENT.md). Internal identifiers such as the `dentalops-v4-` storage namespace are intentionally unchanged so saved workspaces keep loading.
