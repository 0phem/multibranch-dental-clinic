# GEN-09 A8 Staff workflow acceptance

Implementer: Joevan. Original QA owner: Richmon. 2026-10-29, Asia/Manila. GEN-09 remains globally TODO; this is partial synthetic acceptance, not production acceptance.

## Integration and purpose

Approved A7 was fast-forwarded normally from `b46fa230f9f9335ec929f143eac0c7f08e2377f0` to `010a386f147bed285c58821a0a2cc800c393982e`. Remote integration SHA was verified before A8 started. No main update, force push, B branch change or A7 retest.

Reduce repeated Staff navigation and Patient selection by carrying an already-known exact Patient identity between existing workflows. Checkout dependencies declare Laravel 13 and React 19; no framework upgrade was performed.

## Rendered measurement

Baseline was exercised in local headless Chrome with the actual AppointmentsPage, PatientsPage and AppointmentForm before modifying production code. The fixture navigation substitutes two role-navigation buttons; it does not claim a measurement of the full authenticated shell. No typing, scrolling, loading or appointment confirmation is counted. Counts are control activations: selecting a dropdown value counts once, independent of browser-native popup mechanics.

| Workflow | Before | After | Improvement |
| --- | ---: | ---: | --- |
| Appointment → exact Patient Record | 2 | 1 | 1 fewer navigation/selection action |
| Selected Patient Record → New Appointment Form with that Patient selected | 3 | 1 | 2 fewer navigation/selection actions |

Baseline A: open Patient Records (with another Patient selected), then select the appointment's Patient. After A: activate Open Patient Record on the appointment row. If that Patient was already selected, the old path could already take one click; no universal saving is claimed.

Baseline B: open Appointments, New appointment, select the already-known Patient. After B: Book Appointment in that Patient's record opens the reused form with the exact Patient locked. Selecting service, date/time, reviewing restrictions and explicitly confirming creation remain necessary. These counts do not measure clinical time savings or completed bookings.

## Safeguards and component reuse

- Appointment shortcut is Staff-only. It requires an in-scope appointment, an accessible server Patient projection at the exact `patientId`, and an authoritative public ID matching `appointment.patientPublicId`. Names, codes and array position are never identity matches. Missing, legacy and contradictory identities have no row link.
- Navigation uses `setPage('patients', {patientId})` with the projection key. PatientsPage retains its independent `patientInScope` and server-projection filtering; patient-record API access remains server-enforced.
- Book Appointment appears for Staff viewing an accessible Patient. `publicPatientIdFor` resolves the public ID; unsupported legacy identities disable the action with guidance. The open form re-resolves the selected Patient from the accessible collection.
- Existing AppointmentForm handles submission. Patient-only prefill falls back to an authorized open branch, as the normal new-booking form already does, while keeping branch selection editable. No service or Dentist is selected. Submission also rejects a branch outside the current authorized open branch list.
- Availability requests, conflict handling, consultation acknowledgement, required fields and command keys remain in the existing form. Established `appointmentFlow.create` refreshes projections after server success; A8 adds no duplicate refresh or booking API.
- Existing Reschedule, Cancel and No-show controls remain. Owner and Patient get no new shortcut; shared App, layout, foundation and component files are unchanged. No backend files changed.

## Verification

- `node --test tests/patient-records-api.test.js tests/phase4b3b-scheduling.test.js`: 17 passed.
- `tests/staff-workflow-a8-rendered.mjs`: passed in Chrome at 1440px and 390px. Exact Patient navigation, public ID payload, authorized branch list, blank service/Dentist, required fields, restricted-service acknowledgement, conflict/validation failure feedback, command-key renewal, success/close, reschedule and follow-up prefill, legacy follow-up refusal, unauthorized prefill submission rejection, row identity/branch/role guards, keyboard Enter and no page overflow.
- Production build and `git diff --check` passed. Existing bundle-size warning retained.
- Full suites and backend-writing checks omitted per batch scope. No database accessed, and no predefense environment checks run.

Run Vite on port 5178, then `node tests/staff-workflow-a8-rendered.mjs <path-to-playwright/index.mjs>`. Without a path it imports an installed `playwright` package. The local run used the existing cached package and installed Chrome; no dependency was added.

## Screenshots

| View | Desktop | Phone |
| --- | --- | --- |
| Exact Patient record and Book Appointment | [1440px](ui-review/staff-a8/record-1440.png) | [390px](ui-review/staff-a8/record-390.png) |
| Reused booking form and restriction | [1440px](ui-review/staff-a8/booking-1440.png) | [390px](ui-review/staff-a8/booking-390.png) |

## Limits and remaining GEN-09 scope

Synthetic API responses verify UI contracts; fixture booking commands simulate conflict, validation failure and success and do not prove backend enforcement or persistence. Screenshots use isolated production page components/CSS, not authenticated production accounts. Native select interactions vary by input method; the table uses consistent control-activation counts. No live appointment or Patient record was created. Broader check-in, appointment, Patient-record and prescription workflow acceptance still requires independent review. A7's Dentist evidence remains separate. Zero Developer B file overlap; no deployment or auto-merge.
