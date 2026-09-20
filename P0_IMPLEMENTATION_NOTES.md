# P0 Frontend Architecture Implementation Notes

**Baseline:** Module Documentation v1.1 + ERD v2  
**System:** Multi-Branch Dental Clinic Operation System  
**Status:** P0 data/workflow architecture implemented; P1 UI/UX rebuild remains.

## What P0 changed

### 1. Canonical identity model
- Added `persons` as the frontend source of truth for first, optional middle, and last name, email, phone, birth date, sex, and address.
- `users`, `patients`, `staff`, and `dentists` link to a person instead of owning duplicate identity fields.
- Existing screens receive hydrated display fields for compatibility, but writes are split back into the correct person/profile records.

### 2. Account-to-profile synchronization
- Owner/Admin creates a user account from **People & Access / User Accounts**.
- Dentist and Staff roles automatically create a linked operational profile.
- Patient accounts can automatically create a linked patient record.
- Account `Active/Inactive` remains separate from operational `Available/Unavailable`.

### 3. Canonical service catalog
- Services are records with ID, code, name, duration, base fee, category, and status.
- Branch availability is stored through branch-service assignments.
- Dentist capability is stored through dentist-service assignments.
- Smart Scheduling reads the same service/branch/dentist data that treatment and billing use.

### 4. Scheduling rules
Appointment validation now checks:
- no past dates;
- open branch and operating hours;
- active branch-service assignment;
- dentist branch assignment;
- dentist-service capability;
- operational dentist availability and shift; and
- overlapping appointments.

### 5. Treatment-driven downstream workflow
`completeTreatment()` now performs the approved orchestration concept:
- completes/updates the treatment record;
- closes the active queue step;
- updates patient treatment history;
- prepares a draft invoice from the canonical service fee;
- creates a follow-up task only when the dentist indicates a clinical follow-up requirement;
- creates a prescription task/event only when the dentist indicates a prescription is required; and
- records workflow/automation events.

The frontend does **not** diagnose, choose treatment, prescribe, or determine follow-up need on behalf of the dentist.

### 6. Billing workflow
- Removed normal manual **Generate Patient Bill** amount entry.
- Completed treatment prepares the draft invoice.
- Staff reviews/issues the invoice, then records Cash or Card payment.
- Card remains a frontend simulation until PayMongo is connected and verified server-side.
- Receipt generation and patient notification are linked to the same invoice/payment state.

### 7. State-driven HMO foundation
- HMO case creation prefills patient/provider/member data.
- Known local requirements are evaluated automatically.
- Missing requirements remain explicit states instead of a generic “complete docs” action.
- Provider approval/rejection/return remains an external decision.
- Follow-up and escalation remain separate operational states.

### 8. Role and branch scoping
- Owner/Admin may work across branches.
- Ordinary Staff and Dentist users are scoped to their assigned branch in the operational shell.
- Patient has no administrative branch switcher.

### 9. Dentist treatment context
- Treatment is opened from the logged-in dentist’s active queue context instead of a global patient selector.
- Patient, appointment/service, branch, dentist, and suggested assistant are preloaded from existing state.
- Patient identity fields are read-only to the Dentist; clinical data remains dentist-editable.

## Deliberately deferred to P1/P2
These are approved but not part of P0 architecture:
- Patient mobile-first shell and bottom navigation;
- booking stepper/timeline and animated “Find Best Schedule” experience;
- simplified one-action Check-In presentation;
- role-specific queue action redesign and emergency-priority UX;
- final Treatment completion wizard replacing checkbox-style controls;
- Owner/Admin **People & Access** navigation consolidation;
- charts/graphs and fully reactive analytics period controls;
- **Automation Monitor** redesign;
- removal of professor-only Module Coverage from the production navigation;
- global notification bell/Notification Center;
- administrative chatbot; and
- PE polish.

## Validation performed
- JSX/JavaScript TypeScript-transpile syntax check across every source file: **PASS**.
- Smart Scheduling sample: valid slot accepted; past date blocked: **PASS**.
- Queue priority recalculation sample: urgent patient placed ahead of normal priority: **PASS**.
- Search for deprecated normal billing action (`Generate patient bill`): **no remaining match**.

## Build limitation
A fresh Vite production build was attempted, but the runtime environment could not complete dependency installation from the network and `vite` is therefore unavailable in the working container. This is not presented as a successful production build. Source parsing/static logic checks above passed.
