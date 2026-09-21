# Approved Frontend Rebuild Audit — Current Status

> Historical pre-Phase-1 rebuild audit. Its “Current Status” and P1/P2 remaining-work statements describe that earlier checkpoint, not the implementation through Phase 3.5. See [Documentation Reconciliation](DOCUMENTATION_RECONCILIATION.md) for current status; the original audit is preserved.

The team-approved audit is the basis of the frontend rebuild. **P0 architecture is implemented; P1/P2 UI/UX work remains.**

## Locked decisions
1. Structured identity fields with PERSON as the source of truth.
2. Module 1 account creation synchronizes the linked Staff/Dentist/Patient profile instead of duplicate encoding.
3. Appointment booking does not collect the final treatment payment; normal billing follows completed treatment.
4. Check-In remains a distinct but lightweight arrival/admission event.
5. HMO uses state-driven completeness/submission/follow-up logic; provider approval is external.
6. Dentist workflow opens the current queue/schedule patient; professional judgment is never automated.
7. Module 23 remains the orchestration layer; the clinic-facing target UI is a safer Automation Monitor.
8. System notifications are separate from two-way messages; chatbot scope is administrative, not diagnostic.

## P0 verified changes
- PERSON-linked users/patients/staff/dentists.
- service catalog and scheduling reference state.
- treatment-context workflow and downstream draft invoice/follow-up/Rx orchestration.
- treatment-driven billing foundation.
- state-driven HMO foundation.
- role/branch scope restrictions.
- source syntax/static logic checks passed.

## P1/P2 still to implement
Patient mobile-first shell, booking stepper, final queue/check-in UX, Dentist treatment completion UX, People & Access consolidation, Owner charts/analytics, Automation Monitor presentation, Notification Center, chatbot, and PE polish.

## Production disclaimer
Authentication, server-side authorization, database persistence, payment/HMO/message integrations, background jobs, secure storage, immutable audits and concurrency remain backend work.
