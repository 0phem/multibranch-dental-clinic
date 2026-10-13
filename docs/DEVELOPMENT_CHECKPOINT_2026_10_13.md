# Development checkpoint — 2026-10-13

Written before new changes. Branch `docs/reconcile-follow-up-policy-map`, HEAD `da86ef9` (nothing committed since).

## Uncommitted work already in the tree (preserved)

- 2026-10-12 documentation reconciliation: 25-module planning catalog, IPO blueprint, identity transition map, readiness file, policy-map recheck (`docs/`, guidance banners).
- M9 live-queue truthfulness: `src/queue-counts.js`, `src/pages/QueueCounts.jsx`, store request gate, PatientFlow/Dashboards changes, "Live Queue by Branch" label.
- M6 read-only Staff Appointment Calendar (Day/Week/Month): `src/day-calendar.js`, `src/pages/StaffDayCalendar.jsx`, nav/route wiring, styles.
- Tests/QA: `tests/m9-live-queue-truthfulness.test.js`, `tests/m6-staff-day-calendar.test.js`, fixture and live QA scripts under `scripts/`.

Last recorded results (historical evidence, re-run only where a batch touches them): `npm test` 803/803, smoke pass, build pass; M6 fixture QA 411 checks; live-backend QA 54 checks; backend Queue/Visits/Analytics 71 tests on `dental_clinic_test`.

## Environment facts found today

- Local API `localhost:8000`, Vite dev `localhost:5173`, PostgreSQL local. `dental_clinic` is migrated only through `2026_10_08_000100_create_automation_tables`; nine later migrations (auth_version, branch public identity, patient record fields, document integrity, audit append-only, M11 payment integrity, inquiries, messaging, feedback) are **not applied** to the clinic database. Standing rule: no migrations, seeding or resets on `dental_clinic`; automated backend tests use `dental_clinic_test`.
- Mail default driver is `log`; mail is sent synchronously; the queue connection has no running worker (TD-24).
- The frontend maps employee logins through a literal demo table (`src/identity-bridge.js`); any other Staff/Dentist login fails closed.

## Next batch (this session)

1. Implementation tracker for the 25 planning modules (`docs/IMPLEMENTATION_TRACKER.md`).
2. M18 foundation: one mail dispatcher that reports transport acceptance truthfully (logged locally / accepted by transport / failed / not configured), with audit evidence and no content copied.
3. M1 employee provisioning: Owner-only email invitation for Staff and Dentist (PI-01 Owner approval; PI-02 email invitation), set-password acceptance, resend, cancel. No migration required. Additional Owner accounts excluded (PI-01 unanswered part).
