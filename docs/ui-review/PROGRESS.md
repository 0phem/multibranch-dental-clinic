# Patient portal rebuild: progress notes

Uncommitted work in progress on `feat/auth-messaging-paymongo`, kept here so a dropped connection costs little. Demo database only (`dental_clinic_demo`); nothing touches `dental_clinic`.

## Done (backend)

- [x] **Decision 1:** OTP verification no longer signs in (`EmailVerificationController`). Tests are updated.
- [x] **Decision 2:** name snapshots, `invoices.billed_to_name` (set at issue) and `receipts.received_from_name` (set at payment), used by PDFs and emails. No backfill: issued M11 evidence is immutable.
- [x] **Decision 6:** message routing defaults to the next appointment's branch, then the latest visit, then the preferred branch, then the first branch (`ConversationController::startOptions`). Test is updated.
- [x] **Notifications:** `user_notifications` table, `NotificationCenter` (appointment booked, moved or cancelled; invoice issued; payment received; message from the clinic) and API (`GET /api/notifications`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`).
- [x] **Booking backend:**
  - `branches.operating_days`, enforced in `SchedulingService` (`openOn`, `branch-day` check);
  - `GET /api/appointments/branch-options` (ranked, distance and earliest slot, location never stored);
  - `GET /api/appointments/dentist-options`;
  - `GET /api/appointments/calendar` (closed / full / available / past / outside);
  - `services.description`, with general descriptions in `ServiceSeeder`;
  - demo branch coordinates in `DemoClinicSeeder`.
- [x] Migrations `2026_10_24_000100` and `000200` applied to the demo database.

## To do

- [x] **Assistant:**
  - `IntentGuard` (emergency / medical / extraction / off-topic);
  - `AssistantTools` (services, branches, slots, own appointments, own billing, `suggest_action`);
  - `AssistantFallback` (real data);
  - streaming `AnthropicProvider`;
  - `OutputGuard` (grounded amounts and references);
  - `AssistantController` (`GET /api/assistant`, `POST /messages`, `POST /stream`, daily cap);
  - `assistant_usage` logging;
  - the `demo:check` mode line;
  - `docs/ASSISTANT_PRIVACY.md`;
  - `.env.example`;
  - `AssistantTest` rewritten (11 tests pass). Fallback was verified on the demo database.
- [x] **Backend tests:**
  - `PatientPortalApiTest` (closed days, calendar, branch options, notifications from real events only, message notification without text, email change needs the current password);
  - the name-snapshot test in `DemoUnpaidInvoiceSeederTest`;
  - the verification and messaging tests, updated.
- [x] **Before screenshots:** 24 files in `docs/ui-review/patient/before/`, desktop and phone. They show:
  - the duplicated name and "All Branches";
  - the profile stuck on loading;
  - "Dr. Miguel Reyes";
  - the Prescriptions and HMO cards.
- [x] **Frontend API:** notifications, branch options, dentist options, calendar, assistant info, `streamAssistant` (SSE) in `api-client.js`.
- [x] **Messages:** "To: [Branch] front desk · Change" in `ServerMessages.jsx` (and an `initial` prop for a pre-filled compose or opening a thread); `messaging-api` carries the branch address.
- [x] Patients may choose a Dentist (optional; `dentist_ref` no longer prohibited in the availability and booking requests; the rules still apply). **Report this as an M6 behaviour change.**
- [x] `src/patient/format.js`, `src/patient/ui.jsx`, `src/patient/BookingCalendar.jsx` (calendar plus time chips), and new icons in `components.jsx`
- [x] `src/patient/pages/Book.jsx` (the six-step wizard, geolocation, Review, Success, .ics)
- [x] `pages/Home.jsx`, `Visits.jsx` (reschedule and cancel), `Billing.jsx` (server only, ReviewAndPay, PayMongo return banners), `Account.jsx` (Profile with a read-only name; Security with email change and password by code)
- [x] `src/patient/Assistant.jsx` (streaming, starters, buttons-only actions, disclaimer, handoff), `src/patient/Portal.jsx` (shell, nav, More sheet, profile menu, notifications panel)
- [x] `PatientMePage` has a `documentsOnly` mode (documents and consents, no HMO wording)
- [x] **App wiring:** OTP goes to sign-in with the email, the message and password focus (`Login` `initialEmail`/`notice`); a patient session renders `PatientPortal`; a security change signs out with a message.
- [x] `src/patient/portal.css` (loaded from main.jsx); the build passes.
- [x] **Browser check of the demo patient** (desktop and 390px): home, visits, messages, billing, documents, feedback, the booking steps, notifications, the assistant (fallback, real ₱3,600 balance).
  - Fixed: phone navigation showing on desktop; calendar width.
  - Calendar: stops at the first open slot (0.4–0.8 s per month warm, was ~2 s) and no duplicate fetch.
- [x] **Frontend tests:** `tests/patient-portal.test.js` (9 tests); the lazy-page count is 30; npm test 850/850 expected; smoke passes.
- [x] **After screenshots:** 28 in `docs/ui-review/patient/after/` (demo patient, desktop and phone).
  - Fixed: the phone assistant button is now a compact circle; the inline icons in hints.
- [x] **Backend suite:** 736/739, then 3 tests updated to the requested behaviour (a Patient may choose a Dentist; service `description`), 43/43 on rerun.
- [x] **New-patient journey** (`jaztinalcantara17+new1@gmail.com`, demo DB): 15 screenshots in `docs/ui-review/patient/new-patient/`.
- [x] Fixed a notification and assistant-usage timestamp 8-hour shift (`$dateFormat` with offset), with a regression test; the demo rows were corrected.
- [x] `docs/CREDITS.md` and `docs/ui-review/REFERENCE_NOTES.md`.
- [x] **Final run:** npm test 850/850, smoke ok, build ok, diff check ok, affected backend suites 252/252. Reported; left uncommitted. (`src/patient/`), shell, home, booking wizard plus calendar component, visits, billing, messages, notifications, profile and account security, assistant panel, motion
- [ ] Retire the legacy patient pages and the tests that exercised local mock data
- [ ] Journeys (new patient, demo patient), before and after screenshots, full test run, report

## Findings to report

- `docs/design-references/` is empty, so design A is used.
- Interview Q10: "Weekends usually have more patients", so the clinic opens on weekends. No closed days are set by default; the Owner sets them per branch.
- Prices are hidden from patients: the M13 contract keeps prices out of the services API, and there is no "approved for display" setting.
- Pending for `dental_clinic`: `2026_10_23_000100` (clinic settings), `2026_10_24_000100`, `2026_10_24_000200`, the `ServiceSeeder` descriptions, and the demo coordinates (data, if wanted).

---
# Task 2 (real branches, assistant knowledge mode, migrations, defense documents)
- [x] **Rule:** `App\Support\ClinicDatabaseGuard`; the demo seeders, `demo:check` and `predefense-check.sh` refuse `dental_clinic` unless `ALLOW_CLINIC_DATABASE=yes` (verified). Tests already refuse anything except `dental_clinic_test`. Every command I run uses `DB_DATABASE=dental_clinic_demo`.
- [x] **Real branches:**
  - `RealBranchSeeder` (renames placeholder names only, sets coordinates where empty; guarded on dental_clinic); `BranchSeeder` uses it for fresh installs; `DemoClinicSeeder` calls it, plus the Sunday-closed demo default.
  - Demo DB updated (names, addresses, coordinates, operating_days 1–6, staff person "Cardinal Staff").
  - src/data.js and 20 frontend tests, smoke, mail previews and comments renamed; the EmailDesignTest expectation updated.
  - demo:check: a "Placeholder branch names" check (DB plus source), PASS.
  - Coordinates cited in docs/BRANCH_LOCATIONS.md.
  - TODO: current docs/screenshots (DEMO_RUNBOOK etc.) and the screenshots retake.
- [~] **Assistant knowledge mode:**
  - DONE: migration `2026_10_25_000100_create_assistant_answers_table` (demo DB), `AssistantAnswer` model, `KnowledgeMatcher` (Taglish synonyms, typos), `KnowledgeAssistant` (live topics, FAQ, follow-ups, did-you-mean, hand-off), `AssistantAnswerSeeder` (9 drafts, sources cited), `ASSISTANT_MODE` (auto|knowledge|ai), `ASSISTANT_MODE=knowledge` added to backend/.env (key untouched), IntentGuard Taglish patterns, the AI tool `search_clinic_answers`, branch phones no longer given out, the Owner API `/api/assistant-answers` (index, store, update, test), demo:check assistant lines.
  - DONE: tests: `AssistantKnowledgeTest` (8 tests, 55 questions in English, Filipino and Taglish, plus typos, follow-ups, unknown facts, off-topic, extraction, emergency and medical); AssistantTest updated (19/19 assistant tests); phpunit pins ASSISTANT_MODE/keys.
  - DONE: the Owner screen `src/pages/AssistantAnswers.jsx` (Administration → Assistant answers: list/filter/search, add/edit modal with limits, confirm draft, deactivate, test box, drafts banner); nav/permissions/smoke registered.
  - DONE: the patient chat (suggestion chips, open_visits, "Automated assistant. For anything not covered, talk to the front desk.").
  - DONE: the frontend clinic-data audit: `clinic.branches` removed; public `GET /api/public/branches` (+ PublicBranchesTest); website loads it; docs/ui-review/FRONTEND_CLINIC_DATA_AUDIT.md. npm test 850/850, smoke ok, build ok.
  - TODO: docs (ASSISTANT_PRIVACY, M6 docs approval 1, DEMO_RUNBOOK approval 2), assistant screenshots.
- [x] **Docs:** ASSISTANT_PRIVACY (modes), M6_BOOKING_RULES (approval 1), DEMO_RUNBOOK (approval 2 and the real branches).
- [~] **Small fixes:**
  - DONE: PDF downloads (`GET /api/invoices/{id}/pdf`, `/receipt-pdf`, BillingDocumentDownloadTest; Billing buttons).
  - DONE: demo-start.sh `PHP_CLI_SERVER_WORKERS` (default 4; verified 4 workers on a test port; the full-stack check needs a user restart).
  - DONE: branch editing (migration `2026_10_25_000200_add_email_to_branches` on the demo DB; email, coordinates and days open in the Owner form; tests).
  - DONE: new2 journey (welcome screen etc.) replaces docs/ui-review/patient/new-patient/ (15 shots, real branch names); assistant screenshots in docs/ui-review/patient/assistant/ (demo and new patient on phone and desktop, plus the Owner screen); after/ retaken (28) with the real names. The before/ shots keep the old names on purpose (historical evidence).
- [x] **Step 2:** backend 750/750, frontend 850/850, smoke ok, build ok, diff check ok.
- [x] **Step 3:** 12 commits cb041db..8cbc731 (no .env or keys). Uncommitted on purpose: docs/defense/, scripts/demo-reset.sh.
- [x] **Step 4:** approval 3 done on dental_clinic (backup 20261015_0132 verified row for row; 4 migrations in batch 7; ClinicSettingsSeeder 11 values; ServiceSeeder 11 descriptions only). Pending: branch email migration, RealBranchSeeder, AssistantAnswerSeeder, closed days. Logged in docs/CLINIC_DB_P3_MIGRATION_LOG.md.
- Security review note: in AI mode the stream shows text before OutputGuard runs (not active in knowledge mode); recorded as open item.
- [x] **Step 5:** docs/defense/ (INTERVIEW_EVIDENCE, AUTOMATION_EVIDENCE, OPEN_ITEMS, PANEL_QA, PITCH, DEMO_SCRIPT, REHEARSAL_REPORT; DEMO_SCRIPT.pdf, PANEL_QA.pdf); scripts/demo-reset.sh; rehearsal done (fixes: Review-and-pay styling, demo script branding and PayMongo steps); demo data reset; frontend 850/850, smoke ok, build ok.
- [x] **Step 6:** reported. Final: backend 750/750 (rerun), frontend 850/850, smoke ok, build ok. Left uncommitted: docs/defense, demo-reset.sh, rehearsal fixes, log and post-defense notes.

---
# Task 3 (real branch contacts and hours; landing page; consistency checks)
- [x] **Data model:** migration `2026_10_26_000100_add_weekly_hours_to_branches` (demo DB); `Branch::hoursOnDay/hoursOnDate/weekHours`; `App\Support\BranchHours::summary`.
- [x] **Rules:** scheduling (`branch-day`, `branch-hours`, `slotsOn`), walk-in hours, the booking API and the public branches API use per-day hours.
- [x] **Seeders:** RealBranchSeeder phone, email and HOURS (placeholder phones replaced only); BranchSeeder; DemoClinicSeeder Sunday step removed. Demo DB updated.
- [x] **Assistant:** hours per day, branch phone and email ("no email on file" for b3); the "weekends busier" sentence removed from the hours answer.
- [x] **demo:check:** FAIL on a missing or placeholder phone or hours; WARN for b3's email and ZIP.
- [x] **Emails and PDFs:** the branch email in branch messages (none for b3); the clinic email otherwise (`Brand::forEmail`).
- [x] **Frontend hours:** `hoursSummary`/`openStatus` in patient/format.js; Book shows per-day hours; the Owner per-day hours editor; reference bridge `weeklyHours`; data.js real phones and hours.
- [x] **Tests:** BranchHoursTest (4), PublicBranchesTest updated, an AssistantKnowledgeTest hours and contacts test; 850 frontend.
- [ ] Docs (demo script, Q&A, pitch, OPEN_ITEMS)
- [x] **Landing page:** PublicSite/PublicChrome/PublicLegal/AuthShell/PatientRegister, landing.css, public endpoints services/faq, meta from branding, credits; HMO relabelled ("Less: coverage") in emails, PDFs, PayMongo, Billing, ReviewAndPay; tests public-auth-site (rewritten), landing.test.js, public-locations; smoke updated. 853/853, smoke ok, build ok.
- [x] Before screenshots in docs/ui-review/landing/before (10).
- [ ] Consistency checks; verify; commits; report

---
# Task 4 (module freeze, AS-IS / TO-BE process diagrams, process documentation PDF)
- Landing task (task 3) still open: waiting for the +land2 email code; its work stays uncommitted until that run finishes.
- [x] docs/defense/MODULES_FINAL.md (8 Implemented, 9 Partial, 2 Mock only, 6 Planned; ID OCR planned under M1; data retention checked in code).
- [x] mermaid-cli via npx renders with system Chrome (tested).
- [ ] Diagram generator, 50 module diagrams plus overview, architecture and hosting; SVG and PNG
- [ ] SECOND_INTERVIEW_QUESTIONS.md, PROCESS_DOCUMENTATION.pdf, doc updates, checks, commits, report
