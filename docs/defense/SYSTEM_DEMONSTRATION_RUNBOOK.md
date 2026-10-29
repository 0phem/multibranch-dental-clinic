# System demonstration runbook

Prepared by Joevan, 2026-10-29 (Asia/Manila). Use with the [acceptance matrix](FEATURE_ACCEPTANCE_MATRIX.md) and [known limitations](KNOWN_LIMITATIONS_AND_PENDING_QA.md). This is a demonstration guide, not a record that the following live outcomes occurred.

The product identity is **Dr. Dana E. Roxas Dental Clinic**. Four roles: Patient, Staff, Dentist and Owner. Manifests declare Laravel 13 and React 19; see the matrix for exact constraints.

## Prepare the demonstration

Use an already authorized demonstration environment containing fictional accounts, Patients, appointments, shifts, visits and payments. Obtain credentials privately through the team's approved account process; this guide contains none. Do not access the protected `dental_clinic` database, change environment files, reset data, create real payments or send messages to real recipients for this demonstration. Do not run database setup commands from historical guides without separate environment verification.

Record the served commit and environment before starting. Shared integration was verified at `010a386f147bed285c58821a0a2cc800c393982e`; A8 is accepted on `179cfb4903f46648666d2dbdeb0b0d70b3829dd6` but not integrated. A9 is documentation stacked on A8. Do not present B3/B4/B5 behavior on that build. A candidate must receive its own coordinated integration acceptance before substituting it.

Have a fictional same-day appointment and eligible on-shift Dentist ready. Dates and schedules must match **Asia/Manila**; screenshots use fixed synthetic dates and do not establish today's availability. If a prerequisite or connection is unavailable, explain it and open the linked synthetic evidence instead of claiming a successful live transaction. No application or database change is required merely to show the screenshots.

## 1. Sign-in and role access

- **Role:** one fictional account for each role, with approved branch scopes.
- **Prerequisites:** authorized demo session service; accounts provisioned privately. Patient account has a linked Patient profile.
- **Steps:** sign in as Patient, show the Patient navigation, sign out, then show Staff/Dentist/Owner navigation in turn. Use separate profiles or sign out between roles.
- **Expected observation:** each role sees its permitted experience; a hidden menu alone is not proof of server authorization. Never attempt to display another real Patient's data.
- **Acceptance:** A1 persisted Patient-only Gemini JSON/SSE authorization is integrated; [Wave 1](../INTEGRATION_WAVE_20261029.md) records denied roles/session revocation tests. A9 did not execute a new live sign-in audit.
- **Disclose:** mocked provider responses do not approve live AI transmission. Do not activate a provider to demonstrate authorization.

## 2. Patient records

- **Role:** authorized Staff; optionally Patient for their own portal view.
- **Prerequisites:** fictional server-backed Patient visible through the authorized directory/appointment projection, plus a second distinguishable fictional Patient.
- **Steps:** search the directory and select the intended record. Show identity/contact information and the access tier. On an A8 build, open Appointments and activate **Open Patient Record** on that Patient's row; verify the selected name/code.
- **Expected observation:** the corresponding Patient is selected without a second search; unavailable/mismatched identities have no shortcut. The destination still enforces its own scope and server access.
- **Acceptance:** [A8](../GEN09_A8_STAFF_WORKFLOW_ACCEPTANCE.md), GEN-09 partial, is isolated/accepted, not shared-integrated. Existing record APIs/source are present; no new production acceptance is claimed.
- **Disclose:** Owner oversight and Dentist care context do not imply unrestricted clinical record access. A8 synthetic navigation measurement is 2→1 only when the old path required selecting the Patient.

## 3. Appointment scheduling

- **Role:** Staff; Patient booking can be shown separately using only the Patient's own authorized portal.
- **Prerequisites:** supported server Patient, authorized open branch, active offered service and server-provided available slot; test-only booking environment.
- **Steps:** on A8, choose **Book Appointment** from the selected Patient record. Verify the locked Patient and authorized branch choices. Explicitly choose service, date and time; review any consultation acknowledgement; confirm once. In shared A7, use the existing New appointment workflow instead.
- **Expected observation:** no service, medicine or Dentist is chosen by the shortcut. Server availability and conflict validation remain. Show success only if returned; otherwise show the actual failure without repeated blind submissions.
- **Acceptance:** A8 rendered required fields, restricted confirmation, conflict/validation/success, reschedule and follow-up prefill; isolated only. GEN-09 record→Patient-prefilled form: 3→1 control activations, excluding subsequent booking choices/confirmation.
- **Disclose:** synthetic responses do not prove a live persisted booking or payment. Do not claim a reserved slot before the authoritative response.

## 4. Staff check-in and queue

- **Role:** Staff authorized for the appointment branch.
- **Prerequisites:** fictional confirmed appointment for Manila today, eligible Dentist shift and approved current admission requirements.
- **Steps:** open Check-In; locate the appointment, review the displayed Patient/branch/Dentist and current admission requirements, then use the supported admission action. Show the resulting queue only if admission succeeds. Demonstrate the single Refresh and walk-in search without creating a new identity automatically.
- **Expected observation:** shared B2 combobox supports search, keyboard selection and clearing; admission errors remain visible. A rejected off-shift admission is not success.
- **Acceptance:** STF-02/09/10 and STF-12 combobox evidence is integrated in [Wave 1](../INTEGRATION_WAVE_20261029.md). B4 exact-context row/Call/Message improvements are isolated, not on shared A7. B6 successful walk-in acceptance remains pending.
- **Disclose:** STF-11 auto-confirm/ID/cancellation-reason redesign and STF-13 unified find/create remain pending policy. Preserve Staff-controlled admission and queue exceptions; do not claim those proposed automations are accepted.

## 5. Dentist schedule and treatment

- **Role:** Dentist assigned to the fictional encounter.
- **Prerequisites:** same-day appointments, a past appointment and exact authorized queue/visit context. Use a disposable fictional encounter if demonstrating a write.
- **Steps:** open My Clinical Schedule. Show the full selected date, Previous/Today/Next, calendar input and Refresh; inspect a past date. Return to My Queue, open the exact encounter, and review the existing treatment form. Enter or complete treatment only through an explicit Dentist decision in the approved demo environment.
- **Expected observation:** schedule shows only the assigned Dentist's entries; times/statuses remain readable on a phone. Treatment uses the selected encounter rather than an assumed Patient.
- **Acceptance:** DEN-01/02 and scoped A6/A7 UI acceptance integrated: [A6](../DENTIST_UI_A6_ACCEPTANCE.md), [A7](../DENTIST_WORKFLOW_A7_ACCEPTANCE.md). Treatment is existing source behavior, not newly reaccepted end to end in A9.
- **Disclose:** the vague DEN-03 bug report and DEN-12 work-hours UI do not become complete merely because this schedule demonstration works. No automated diagnosis or treatment decision.

## 6. Prescriptions and follow-ups

- **Role:** treating/authorized Dentist; Staff can show permitted issued-record/follow-up worklists afterward.
- **Prerequisites:** recent fictional server Visit; an editable draft with fictional custom medication text; any follow-up tasks needed for the worklist. No real prescribing.
- **Steps:** open/reload the existing draft and show custom values. On A7, use **Edit draft** directly from its review dialog. Explain allergy review and explicit issue confirmation; do not issue unless the demonstration includes an authorized fictional clinical decision. Show the labelled follow-up statuses and supported workflow controls.
- **Expected observation:** custom fields survive draft save/reload/edit; issuing locks a prescription and requires confirmation. Follow-up status colors have text labels. Wording approval is explicit and revision-bound.
- **Acceptance:** B1 custom-value API/rendered checks integrated; A6 prescription/license/status/wording presentation and A7 review→edit 2→1 clicks integrated. Evidence in the matrix.
- **Disclose:** no automated medicine/dosage, no drug-interaction certification and no invented recall policy. Follow-up booking remains operational, clinical follow-up decisions remain with the Dentist.

## 7. Owner branch management

- **Role:** Owner.
- **Prerequisites:** fictional branch updates permitted in the demo environment; four active services for a 2×2 desktop example. Use screenshots if changes are not authorized.
- **Steps:** inspect the code dropdown, current map pin and weekday Open/Closed controls. Show the service grid. If demonstrating persistence, change a synthetic value, explicitly Publish, then reopen it.
- **Expected observation:** a saved pin persists; moving a pin does not imply an immediate save. The last operating day cannot be closed through the weekday toggle. Weekly opening hours and branch operational status remain distinct.
- **Acceptance:** OWN-02–06, [A3](../OWNER_BRANCH_A3_ACCEPTANCE.md), integrated with isolated PostgreSQL and rendered evidence.
- **Disclose:** update-only scope; no new branch-creation contract. Synthetic coordinates do not establish clinic location. Live map tile availability was not accepted by A3.

## 8. Owner revenue analytics

- **Role:** Owner.
- **Prerequisites:** synthetic payment/refund records with known date/branch totals, or the committed [illustrative showcase](OWNER_ANALYTICS_FEATURE_SHOWCASE.md).
- **Steps:** open Analytics, select branch and detailed period, inspect exact daily values and the accessible table. Show the fixed Last 30 Days comparison separately. Select the weekly report date and explain any in-progress preview.
- **Expected observation:** gross collections, refunds and net cash flow are separately labelled; refund-only days may have negative net. Branch changes clear stale figures; failures show unavailable rather than fabricated zeros.
- **Acceptance:** OWN-01, [A4](../OWN01_A4_ACCEPTANCE.md)/[A5](../OWN01_A5_ACCEPTANCE.md), integrated; separate synthetic PostgreSQL reconciliation and rendered tests.
- **Disclose:** collections are not profit. Weekly Mon–Sat report excludes Sunday; Saturday status is an on-demand calendar flag, not an immutable scheduled close. No production financial/live-payment acceptance is implied.

## 9. Staffing, leave and duty status

- **Role:** Staff or Dentist requester; Owner approver.
- **Prerequisites:** fictional weekly shifts, an approved test scope and a coordinated build that actually contains any proposed B3/B5 demonstration.
- **Steps:** on shared A7/A8, show existing work-hours/leave screens and identify known limitations. Use read-only [B5 evidence](https://github.com/ccadaverr/multibranch-dental-clinic/blob/c43417c93cfabdcfbb2520fd8f3955e5a49999aa/docs/STF07_B5_ACCEPTANCE.md) to explain the isolated duty projection. Do not switch or modify Developer B's branch to stage the demonstration.
- **Expected observation on an accepted future candidate:** partial-day leave uses one date with explicit hours; Owner decisions respect server authority. Staff duty distinguishes on-duty-today from working-now, handles branch scope and exposes estimated fallback honestly.
- **Acceptance:** B3 (`74b91a7`, `5cdba7f`) and B5 (`c43417c`) are **not shared-integrated**. DEN-12 has no established item-specific acceptance here.
- **Disclose:** no invented leave entitlements, roster facts or auto-approval. The shared build may still attempt a denied requester self-approval call; B3 removes that attempt but is isolated. B5 does not accept the separate Dentist dashboard badge.

## 10. Messaging and appropriate notifications

- **Role:** fictional Patient and authorized branch Staff; Dentist only within supported participants.
- **Prerequisites:** an existing authorized fictional conversation with enough history to search/scroll; test recipient notifications. Never show private real messages to the Owner.
- **Steps:** open the thread, search existing history, clear search and scroll older messages. Show role-distinct bubble presentation. Open Notifications separately and inspect only that account's notices; describe unsupported actions honestly.
- **Expected observation:** search/history retains participant/branch scope; Messages and Notifications are distinct. Delivery is shown only as supported by actual state.
- **Acceptance:** STF-22/23/24 and DEN-14 have integrated A2/Wave 1 evidence. STF-21 switch-Dentist history contract remains partial; GEN-10 full notification redesign remains TODO. B4 queue→existing-thread shortcut is isolated.
- **Disclose:** no new Staff conversation-start authority; no guaranteed live email/WebSocket delivery from fixture tests. Production-scale encrypted-history search is unbenchmarked.

## Close the demonstration

Open the matrix's tracker-discrepancy table, explain the difference between implemented code, isolated acceptance and deployment approval, and show the pending list. Record any actual rehearsal failures as new observations; never overwrite historical test results with an assumed pass. All reused screenshots are synthetic/illustrative and linked in the matrix; A9 adds no Patient screenshots or application changes.
