# M4 production-readiness audit and hardening — Patient Records Management

Audit date: 2026-10-04 (Asia/Manila). No commit, push, merge, M3 or M5+ work.

## 1. Starting git state

Branch `feature/m4-patient-records-production-hardening`, created from `7a5dd41` ("docs: synchronize canonical 26-module architecture") on a clean tree synchronized with origin. Baseline backend suite: 363 tests, one transient PostgreSQL connection timeout in an unrelated Analytics test that passed on immediate rerun. Baseline frontend: 686 passing.

## 2. Evidence basis

Interview facts used: Q17 (Patient records and treatment history are already digital) and Q18 (the clinic values its centralized, multi-branch software). Everything else below is a **project decision** or a **technical choice**; nothing is presented as something the clinic said. No policy was invented for the items in section 32.

## 3. Architecture discovered

`persons` is the identity hub. `users` and `patients` are independent siblings, each with a unique `person_id` foreign key (no `patients.user_id`). `users.person_id` unique, `patients.person_id` unique, `persons.email` unique, `patients.patient_code` unique, `patients.public_id` ULID unique. Staff/Dentist profiles also hang off `persons`. Downstream modules (appointments, visits, treatments, invoices, HMO, documents/consents) reference `patients.id` internally and expose the Patient `public_id`.

## 4. Patient / Person / User relationship

Confirmed as the actual schema. A Patient may exist with no User (front-desk walk-in). Registration (M1) creates Person + Patient + User in one transaction; walk-in registration (M4) creates Person + Patient. Both paths hold the same `LOCK TABLE patients` while allocating a code and checking duplicates.

## 5. Patient authority before changes

Server: identity (Person + Patient), the directory (`GET /patients`, minimal fields) and walk-in creation. Nothing else — **no endpoint to read a Patient record, no profile update, no linked-record view**. The Patient route binding accepted the ULID, the `patient_code` **or the internal bigint id** (also through `{patient:public_id}`), so M12 and M14 routes could be addressed by sequential numbers. The M14 document filter did the same.

Browser: the entire Patient Records page, "Create Central Patient Record", profile edits and the Patient's own "Me" profile ran on browser-local collections seeded from demo fixtures, including locally generated `PAT-####` codes and a fake local "portal account".

## 6. Patient authority after changes

Server: `GET /api/patients/{patient}` (role-scoped non-clinical profile), `PATCH /api/patients/{patient}` (Staff, allowlisted fields, optimistic revision, audited), `GET /api/patients/{patient}/records` (read-only linked-record index). The front end reads and writes the non-clinical profile only through these for server sessions. Remaining browser-local authority is listed in sections 7 and 33.

## 7. Browser-local / demo sources found

- `INITIAL_PATIENTS` / `INITIAL_PERSONS` (p1–p4, demo clinical notes) persisted in `localStorage` (`dentalops-v4-*`) and listed for every session.
- `createPatientRecord` / `updatePatientRecord` local commands (local codes, local portal accounts, local clinical edits).
- The identity bridge's local Patient projection, created at first sign-in with a technical default `preferredBranchId` (first Open branch) that the Patient "Me" page displayed as if it were a preference.
- Browser-only `allergies`, `medicalHistory`, `dentalHistory`, `emergencyContact`.

**Cut over:** the two local commands now refuse server-authenticated sessions (same pattern as M1/M2); the Patients page and the Patient "Me" page read the server record; the browser Patient collection is **never listed in a server-authenticated M4 view** (see section 35); the technical default branch is no longer shown as a preference.
**Not cut over (blockers):** the local `persons`/`patients` collections themselves and the legacy collections that key on local Patient ids (invoices, prescriptions, follow-ups, messages, loyalty, legacy treatments/HMO) — they belong to modules not yet server-authoritative.

## 8. Duplicate-prevention model

No fuzzy matching and no merging was added. Existing, retained rules:
- exact email: `persons.email` unique; registration and walk-in check it **inside** the locked transaction; the database constraint is the last line (both paths translate it to a 422);
- public registration additionally refuses a matching phone or a matching name + date of birth (existing M1 rule, unchanged);
- walk-in registration refuses only an exact existing email (existing rule, unchanged).

Changes: `patient_code` allocation moved from `count()+1` to *highest existing suffix + 1* (`Patient::nextCode()`), so a removed record can no longer make a new code collide (it was a latent unique-violation/500). Both registration paths share it under the existing table lock. Email changes through the new PATCH take the same table lock and check people **and** users (including soft-deleted accounts). Real-process race tests: two simultaneous walk-ins with the same email → one 201 + one 422, one row; two simultaneous different people → distinct codes; two edits from one revision → one 200 + one 409.

Known gap, deliberately not closed: emails are normalized to lowercase when written, but no case-insensitive unique index exists; a duplicate phone or name is allowed in walk-in and PATCH. Both need a clinic decision (section 32).

## 9. Public identity model

Patients already carry a non-null, unique ULID `public_id` (migration `2026_09_28_000050`). **Binding is now ULID-only**: `Patient::resolveRouteBinding` ignores the field argument and the `patient_code` / bigint fallbacks, so numeric ids, patient codes and malformed values are 404 on every `{patient}` route (M4, M12 `hmo-membership`, M14 consents). The M14 `patient_id` filter no longer resolves codes or bigints. Persons have no public id and none is exposed. No redundant identifier was created.

## 10. Role / access matrix (final, after the pre-checkpoint remediation in section 35)

| Capability | Guest | Patient | Staff (≥1 scope) | Staff (no scope) | Dentist | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /patients` directory (identity fields) | 401 | 403 | yes | 403 | 403 | yes |
| `POST /patients` walk-in | 401 | 403 | yes | 403 | 403 | yes |
| `GET /patients/{id}` identity tier (code, name, phone, DOB) | 401 | own | any Patient | 403 | **403** | any Patient |
| `GET /patients/{id}` full profile (+ sex, email, address, emergency contact, preferred branch) | 401 | own | only a Patient with an appointment or Visit in the Staff account's branch scopes | 403 | **403** | **identity tier only** |
| `PATCH /patients/{id}` | 401 | 403 | same condition as the full profile | 403 | 403 | 403 |
| `GET /patients/{id}/records` | 401 | own | filtered by branch scope | 403 | **403** | all (links only) |

Branch scope never creates "Patient at Branch A"; it only filters the linked-record lists through each module's own `visibleTo` scope. The Owner is not treated as a Dentist or as a front-desk editor: the Owner keeps exactly the directory-level identity access that already existed, and any wider Owner access is POLICY DECISION REQUIRED.

## 11. Field-level mutation ownership

Staff (with the full-profile tier for that Patient) may change: first/last name, phone (+63 mobile), date of birth (≤ Manila today), sex, address, emergency contact, preferred branch (legacy_ref or public ULID; null clears), and email **only when the Patient has no portal account** (a portal account's email belongs to M1: verification and session revocation). A request that contains any of `allergies`, `medical_history`, `dental_history`, `clinical_notes`, `id`, `public_id`, `patient_code`, `person_id`, `user_id`, `patient_id`, `role`, `account_status`, `password`, `branch_scopes`, `consent`, `revision`, `created_by`, `approved_by`, `created_at`, `updated_at` is **rejected with 422 (not silently stripped)**. `consent` stays with M14. Clinical history has no server representation and is not editable on the generic profile route.

## 12. Privacy / IDOR findings

Fixed: numeric and `patient_code` addressing on M12/M14 routes and the M14 filter (sections 5, 9). Verified by test: Patient A cannot read or edit Patient B or B's record index (403); unscoped Staff 403; a Dentist without a Visit/appointment 403; malformed, unknown and bigint ids 404; guests 401. Projections come in two tiers: *identity* (the directory fields) and *full* (adds sex, email, address, emergency contact, preferred branch, revision, timestamps); the tier is decided by `PatientPolicy`, not by the client. No internal ids, account/security metadata, clinical history, consent flag, HMO, billing or storage paths are projected; the audit payload carries field names only.

## 13. Cross-branch behaviour

One Patient identity serves every branch (test: one Patient with appointments at b1 and b2 shows both to the Owner; Staff scoped to b1 see only b1's). The unresolved b1/b2/b3 ↔ public-location mapping was not used to rewrite any history.

## 14. Longitudinal record design

`GET /patients/{id}/records` returns, per family (appointments, visits, treatments, invoices, HMO cases), only `{id (public), status, date(s), branch}` — at most 100 newest per list — each filtered by that module's own `visibleTo` scope. No amounts, no treatment documentation, no HMO decisions, no document paths are copied; M4 stores no second copy. Families with no server source (`clinical_history`, `prescriptions`, `follow_ups`) are listed in `unavailable` so a client never reads an empty list as "none". Documents/consents stay in M14's endpoints. A Patient sees only the families their own endpoints already serve (appointments, invoices).

## 15. M1 integration

Registration retries and failures were already transactional and locked (M1); the walk-in path is unchanged except for the shared code allocator and an audit event. The walk-in DOB bound used the UTC date (`before_or_equal:today`) — it now uses the Manila clinic date, like M1. M1's privileged provisioning and identity-projection blockers are untouched.

## 16. M5 / M6 / M8 / M9 / M11 / M12 relationship findings

All of them already reference `patients.id` and resolve request Patients by `public_id`. The only cross-module defect found was the loose route binding affecting M12 and M14 (fixed in M4's model, covered by tests). Nothing in these modules was rewritten. The full backend suite (including their regression and concurrency tests) is green.

## 17. Database / schema changes

One forward-only, additive migration `2026_10_11_000100_add_patient_record_fields.php`: `patients.revision` (default 1), `patients.emergency_contact` (nullable), `patients.preferred_branch_id` (nullable FK → branches, restrict). No clinical column was added. **It was exercised only on `dental_clinic_test` and has not been applied to `dental_clinic`; apply it before deploying this code.**

## 18. Audit coverage (M22)

New events: `patient.registered` (front desk walk-in; no personal values) and `patient.profile.updated` (changed field names only). M1 already audits account registration. Not audited: reads of Patient records (no audit policy for sensitive-record access is defined — section 32); a failed or refused edit.

## 19. Security findings

Loose route binding (fixed); UTC-based DOB bound (fixed); count-based code allocation (fixed); unconstrained local clinical writes through the browser are not server security and remain labelled as such. Frontend checks are not authorization: every rule above is enforced by the backend policy, request and controller.

## 20. Frontend cutover

`src/patient-records-api.js` (client; no storage). Patients page: for server Patients (public ids) a `StaffPatientSummary` loads the record with loading, error + Retry and conflict + Reload states, saves only changed allowlisted fields against the loaded revision, shows the linked-record counts and an explicit notice that clinical history is not on the server. New Patient uses the server registration (no local code or portal account). Staff search queries the server directory. A Staff identity-tier record is read-only with an explanatory notice; a Dentist's Patient list is built from their workflow records and the summary makes no Patient-record request (explanatory notice instead). The Patient "Me" page reads the Patient's own server record. Server Patients are in scope for server Staff sessions (the server already decided access). **Capability honestly removed:** in a server session a Dentist can no longer type allergies/medical/dental history, because there is nowhere authoritative to store it; the page says so. The Owner shell has no Patient Records page (unchanged); the Owner identity-tier read exists at API level only.

## 21. Files changed

Backend: `app/Models/Patient.php`, `app/Policies/PatientPolicy.php` (new), `app/Http/Controllers/PatientRecordController.php` (new), `app/Http/Requests/Patient/UpdatePatientRecordRequest.php` (new), `app/Http/Resources/PatientRecordResource.php` (new), `app/Http/Controllers/PatientRegistrationController.php`, `app/Http/Controllers/Auth/RegisteredPatientController.php`, `app/Http/Controllers/DocumentController.php`, `app/Http/Requests/Patient/RegisterWalkInPatientRequest.php`, `routes/api.php`, `database/migrations/2026_10_11_000100_add_patient_record_fields.php` (new), `tests/Support/concurrent_request.php` (optional HTTP method argument).
Frontend: `src/patient-records-api.js` (new), `src/api-client.js`, `src/pages/Clinical.jsx`, `src/pages/PatientMe.jsx`, `src/administration.js`, `src/workflow.js`, `src/contracts.js`.
Tests/tools/docs: `backend/tests/Feature/Patients/PatientRecordTest.php` (new), `backend/tests/Feature/Patients/ConcurrentPatientRecordTest.php` (new), `tests/patient-records-api.test.js` (new), `tests/safeguards.test.js`, `scripts/m4-patient-records-browser-qa.mjs` (new), `docs/M4_PRODUCTION_HARDENING.md`.

## 22. Tests added / changed

Backend, 27 new: ULID-only binding on M4/M12/M14 routes and the document filter; patient codes never reused; Manila DOB bound; audit without personal values; read matrix by role (Patient own, Staff scope/none, Dentist relationship, Owner, guests); role-specific projections with no internal/clinical leakage; Staff-only edits; Patient/Dentist/Owner edit refusal; allowlist round trip and audit field names; unchanged save is a no-op; 20 prohibited fields refused; invalid values; stale revision 409; preferred branch by legacy_ref/ULID/clear and bigint refusal; account-holder email owned by M1, email uniqueness across people and users; cross-branch single identity; record-index linkage, per-module scope filtering and no internal ids; 3 real-process races.
Frontend, 12 new (updated in the remediation): record mapping, changed-field allowlist (no clinical fields, no account-holder email), revision-bound save, no-op save, 409, explicit failures with no fallback Patient, record index, no storage use and id encoding, server Staff scope rule, source assertions for loading/error/retry and no browser clinical fields; plus two safeguard tests (local commands refuse server sessions; unchanged without one).

## 23–28. Verification results

- Targeted M4 backend (`tests/Feature/Patients`): **31 passed / 270 assertions**.
- Cross-module regression (M1 registration/auth, M5 treatments, M6 appointments, M8 visits, M9 queue, M11 billing, M12 HMO, M13/M14, M21–M23): ran as part of the full suite.
- Full backend: **394 passed / 3,331 assertions** (baseline 363 / 3,058).
- Targeted frontend (patient-records-api, safeguards, workflow): **109 passed**.
- Full frontend: **698 passed**, zero failures/skips (baseline 686).
- Render smoke: **16 passing groups** (now including a server-session Patients-page assertion).
- Production build: **PASS**, initial JS 455.31 kB / 138.92 kB gzip; no dependency changes (Playwright was installed outside the repository for QA only).
- A regression check that the new binding tests fail on the old model was run: the consent/HMO numeric-binding test failed against the pre-change `Patient.php`.

## 29. Browser QA

`scripts/m4-patient-records-browser-qa.mjs` (installed Chrome, HTTP fixtures; backend rules are covered by the Laravel tests): **161 checks passed** across Patient, Staff, Dentist and Owner at 375, 430, 768, 1024 and 1440 (20 role/width runs), **0 px horizontal overflow** everywhere. Verified: server record shown, only changed fields + revision sent, stale save and reload, load failure + Retry with no fallback profile, browser-only record read-only, server registration form (no local create form), Dentist read-only projection without email/address, Patient "Me" from the server with no default branch shown, Owner navigation without Patient Records. The only console errors are the deliberately injected 409/500 fixture responses. Screenshots/results are outside Git in `/tmp/m4-browser/`. Not physical-device, cross-browser, screen-reader or live-backend certification.

## 30. `git diff --check`

PASS.

## 31. Follow-up scope kept out

No M3/M5/M14/M19/M20/M26 work; no module renumbering; no new role; no Patient matching or merge policy; no clinical schema; no retention policy.

## 32. Unresolved policy questions (not answered here)

1. Which demographics may a Patient edit themselves (currently none)?
2. Which medical/dental history fields are mandatory, how are they structured, and what is the correction workflow for clinical history?
3. Should the Owner read the full profile or clinical records, and may the Owner edit demographics? (**POLICY DECISION REQUIRED**; Owner stays at identity tier.)
4. What generic, longitudinal Patient-record access, if any, should a Dentist have beyond their workflow records? (**POLICY DECISION REQUIRED**; currently none.)
5. Should Staff reach the full profile of a Patient who has no appointment/Visit in their branches (for example a just-registered walk-in)? (Currently no; identity only.)
6. What duplicate policy applies to a shared phone number or name + birth date at walk-in and on edit, and who may merge records?
7. Should reads of Patient records be audited?
8. Retention and archival periods; branch-specific Patient ownership (none assumed).

## 33. Remaining production blockers

1. **Clinical history has no server model.** Allergies, medical and dental history exist only in browser-local demo data; Dentist workflows cannot record them in a server session. Needs question 2.
2. **Browser-local Patient collections remain in state** (`persons`, `patients`, demo seeds, the identity-bridge projection) because unmigrated modules key on local ids. They are classified in section 35 and are not shown, listed or treated as authoritative in any server-authenticated M4 view.
3. Dentist generic Patient-record access and the Owner full-profile policy (questions 3–4) are unconfirmed, and a just-registered walk-in is identity-only to Staff until it has an appointment or Visit (question 5).
4. Duplicate policy (6) and case-insensitive email uniqueness at database level.
5. The migration must be applied to non-test databases deliberately.

## 34. Verdict

**Verdict B — not production-ready as a complete module.** The server-side identity, authorization, privacy, concurrency, audit and linked-record foundations are hardened and tested, and the visible Patient profile paths now fail visibly instead of falling back to demo data. Verdict A is not available because clinical history has no authoritative store, browser-local Patient collections still exist for unmigrated modules, and several production behaviours depend on unresolved clinic policy.

**Suggested process-document status for M4:** "Server-authoritative Patient identity (Person/Patient), ULID-only addressing, role-scoped non-clinical profile read, Staff-only audited profile edit with optimistic revision, and a read-only linked-record index hardened and tested. Clinical history, browser-local Patient collections for unmigrated modules, and several access/duplicate/retention policies remain open; Verdict B."

## 35. Pre-checkpoint remediation (narrow; no scope expansion)

### Findings before remediation (technical defects)

1. **Demo Patients were visible in server-authenticated M4 views.** Yes: the first pass listed the browser collection (`INITIAL_PATIENTS` demo rows) next to server Patients and merely made them read-only ("Earlier browser record"). That is no longer accepted behaviour.
2. **Dentist generic access was new, not pre-existing.** There was no Dentist Patient-record endpoint before M4 (`PatientDirectoryController` is Staff/Owner only). Existing Dentist server entitlements are *workflow-specific*: `AppointmentPolicy` and `Appointment::visibleTo` (assigned appointments), `VisitPolicy` / `Visit::visibleTo` (responsible Dentist), `TreatmentPolicy` (authored Treatments, plus *completed* Treatments of a Patient currently treated on an active Visit). The client function `patientInScope` is a UI visibility rule and is not server authorization, and CONTRACTS.md §5 only says clinical changes go through Dentist workflows. "Any Visit or appointment, indefinitely" was therefore introduced by M4 to make the new endpoint work.
3. **Staff full-profile read was broadened by M4.** The clinic-wide read for any Staff account with at least one branch scope is a *pre-existing* contract, but only for the directory fields (`PatientDirectoryController`, M6 cutover `5f002b8`: "Patients are clinic-wide records … a Staff member needs at least one authorization branch scope"). Email, address, emergency contact, preferred branch and the edit right were new.
4. **Stale Patient references.** `DocumentStorageService::resolvePatient` (document upload) still accepted `patient_code` and the numeric id, and the Patient documents tab fell back to `patientCode`/local id as the identifier.

### Remediation

- **Server sessions list only authoritative Patients.** The Patients page filters to server Patients (`serverProjection`, public ids) whenever the session is server-authenticated; the read-only legacy path and its "Earlier browser record" notice were removed. The page always shows the directory search (the empty state tells Staff to search, tells a Dentist the list comes from their appointments and queue). A failed directory search or record load is a visible error with Retry and never reveals browser Patients. The browser collection is untouched in state for unfinished modules and is still used in a non-server (demo/local) context, asserted by the smoke suite.
- **Dentist:** generic `GET /patients/{id}`, `/records` and `PATCH` fail closed (403) even when the Dentist has an appointment or Visit with the Patient. Workflow screens are unchanged (a test confirms the Dentist still reads their own appointment with its Patient context). The Dentist summary makes no Patient-record request and says why. Recorded as **POLICY DECISION REQUIRED**; no replacement rule (active-only, time-boxed, same-branch, assigned-forever) was invented.
- **Staff:** two tiers. Identity (code, name, phone, DOB — the existing directory fields) stays clinic-wide for any Staff account with a branch scope. The full profile and edits are limited to a Patient with an appointment or Visit inside the account's authorization branch scopes (the existing M6/M8 branch read scopes). No branch-based Patient ownership was created. **This full-profile boundary is a conservative technical authorization boundary, not confirmed clinic policy**; the final Staff rule remains POLICY DECISION REQUIRED. A just-registered walk-in is therefore identity-only until it has an appointment or Visit; this is recorded as a policy question, not hidden.
- **Owner:** identity tier only; no edit; not treated as a Dentist.
- **ULID references:** `DocumentStorageService::resolvePatient` now accepts only the public ULID (numeric id and `patient_code` → 404 `patient_not_found`); the documents tab addresses a Patient by `publicId` only. Verified: M12 `hmo-membership` callers already pass `patientPublicId`; the M14 consent routes, document filter and upload all reject codes and numeric ids; the M4/M12/M14 binding test suite is green. (`DocumentStorageService` still resolves *Visits* by numeric id — an M14 item outside M4, noted for that module.)

### Classification of browser-local Patient collections

| Collection / path | Class | Disposition |
| --- | --- | --- |
| `state.patients` / `persons` / `users` (local projection, including the identity-bridge projection created at sign-in) | **A** — required by unfinished modules (local invoices, prescriptions, follow-ups, messages, loyalty, legacy treatments/HMO) and by the Patient role's own session | Kept in state; never listed, never treated as authoritative in server M4 views; `patientInScope` for a server Staff session accepts only server projections |
| `createPatientRecord`, `updatePatientRecord` local commands (local `PAT-####`, fake portal account, local clinical edits) | **B** — obsolete duplicate Patient authority | Refuse every server-authenticated session (done in the first pass) |
| Read-only "Earlier browser record" rows/notice in the Patients page | **B** | Removed |
| `INITIAL_PATIENTS` / `INITIAL_PERSONS` demo seeds and test fixtures | **C** — historical fixtures | Preserved for tests and the non-server demo context |
| M24 loyalty patient picker (`Admin.jsx`) and other non-M4 pickers over `state.patients` | **A**, outside M4 | Left for those modules' cutovers |

### Confirmed policy blockers versus technical defects

Technical defects (found and **fixed**): demo rows in server views; Staff full-profile/edit broadened beyond the existing directory contract; Dentist generic access without an existing contract; document upload and the documents tab accepting non-public Patient references.
Policy blockers (**not decided here**): Dentist generic record access; Owner full-profile/edit; Staff access to a Patient with no scoped record; Patient self-edit; clinical-history model and correction; duplicate/merge policy; audit of reads; retention.

### Remediation verification

Targeted backend `tests/Feature/Patients`: 31 passed / 270 assertions (new: Dentist refused despite workflow records and workflow access intact; two Staff tiers; no edit without a scoped record; Owner identity-only; document upload by public id only). Full backend: **394 passed / 3,331 assertions** (an earlier remediation run reported 33 failures after a background process of mine was killed mid-run and left the test database inconsistent; a clean rerun passed 394/394, and the failing test passed in isolation). Targeted frontend `tests/patient-records-api.test.js`: 10 passed; full frontend **698 passed**; smoke **16 groups, exit 0**; production build passes (initial JS 455.31 kB / 138.92 kB gzip). Browser QA: **161 checks**, Patient/Staff/Dentist/Owner at 375/430/768/1024/1440, **0 px overflow**, no demo Patients in any list, a failed directory search shows no demo Patients, Staff identity tier is read-only without profile fields, a Dentist session issues no Patient-record request, legitimate API Patients render, and the only console errors are the injected 409/500 responses. `git diff --check` passes. The M4 migration was not applied to `dental_clinic`.
