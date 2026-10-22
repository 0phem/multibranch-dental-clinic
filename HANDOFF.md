# HANDOFF: Multi-Branch Dental Clinic System (continue on Codex)

## 0. READ THIS FIRST (no prompt needed)

You are a coding agent taking over this project from another AI assistant. The user will not paste a long prompt. **Do this automatically when a session starts:**

1. If this file is not already at the repository root as `HANDOFF.md`, copy it there. **If `AGENTS.md` does not exist at the repository root, create it** with exactly the content in section 16, so every future session (yours or another agent's) loads the rules automatically. The user should not have to move or create any file. Commit both (no push).
2. Read this whole file, then `docs/POST_DEFENSE_TASKS.md`, `docs/defense/MODULES_FINAL.md` and `docs/defense/OPEN_ITEMS.md`.
3. Respect section 2 (hard rules) at all times. When in doubt, do the safe thing and tell the user.
4. Run `git log --oneline -30` and `git status`. Compare the repo with section 8 (in-progress work) and report what is done, partial or missing.
5. If `docs/handoff/SYSTEM_STATE.md` does not exist, create the handoff bundle (section 15), so the project can also be explained to an assistant that cannot see the repo. If it exists but is older than the latest commit, update it.
6. Then follow the timetable in section 0.1 (**hosting first**, then finish, improve, clean up; section 12 describes each phase). Finish only what is missing; never redo finished work. Ask the user only when a decision is truly theirs (spending money, touching the real clinic database, pushing code, deleting anything, choosing paid hosting plans).
7. Reports to the user must be short, honest and ordered: what changed, test and build results, what to open first, what must be done by hand, what will not fit before the defense. The user is often tired and wants simple, copy-pasteable steps.

Written 2026-10-20 (Asia/Manila). **Defense: Saturday 2026-10-24. The system must be HOSTED and working on Vercel + Railway + Supabase before Thursday 2026-10-22** (the defense is run on the hosted version). Feature freeze: Thursday 2026-10-22 evening. Where any later section of this file says Oct 25 or "host after the defense", section 0.1 overrides it.

## 0.1 DEADLINE OVERRIDE: hosting comes first (overrides sections 12 and 16 where they differ)

| When (Asia/Manila) | What |
| --- | --- |
| Tue Oct 20 evening | Read this file, audit the repo, write `docs/DEPLOYMENT_PLAN.md`, list the accounts and values the user must create (below). **Deploy the CURRENT committed state first, before any new development** (it is stable: 813 backend and 875 frontend tests passed). Every later push to `feat/auth-messaging-paymongo` redeploys, so development continues on a live system and hosting problems are found early. Do NOT start new features before the first deploy works. |
| Wed Oct 21 | Deploy staging to Vercel + Railway + Supabase, seed demo data, run the hosted checklist, fix what breaks. In the gaps, finish the in-progress work of section 8 (smallest first: Automations page cleanup, then M19, then M20; M10 only if everything else is done). |
| Thu Oct 22 | **Hosted version must work end to end by morning.** Full dress rehearsal on the hosted URL. Bugs only. Freeze in the evening. |
| Fri Oct 23 | Rehearsal, cleanup only if 100% safe, backup screen recording, keep Supabase active. |
| Sat Oct 24 | Defense on the hosted version; the local Mac demo stays ready as a fallback. |

**Accounts the user must create or approve (ask once, early, in one list):** Vercel, Railway (a paid or trial plan; tell the user the expected cost before deploying), Supabase (free tier is fine for this week if the project stays active; it pauses after a period without activity), GitHub access for the hosting services, optionally a custom domain (cheapest reliable option) and an email provider account (see below). Never ask for secrets in chat; the user pastes them into the dashboards.

**Architecture to deploy**
- **Supabase:** a NEW PostgreSQL project in Singapore = the hosted demo database (migrate + demo seed; never the real `dental_clinic` data). Laravel connects through the **session pooler (port 5432, IPv4)**, not the transaction pooler (6543), because of prepared statements. Supabase Storage (S3-compatible) for uploaded documents and generated files.
- **Railway** (Singapore if available), four services from the same repo/branch: `api` (Laravel web, PHP 8.3), `worker` (`php artisan queue:work`), `scheduler` (`php artisan schedule:work`), `reverb` (`php artisan reverb:start`, its own public domain, WSS). Same env vars on all four (APP_KEY identical everywhere). Migrations run once from `api` on deploy.
- **Vercel:** the React/Vite frontend, env var pointing at the API.
- **Cookies/CORS (the usual break point):** Sanctum cookie auth does not work across unrelated domains (vercel.app vs railway.app). Choose ONE:
  (a) a custom domain: `app.<domain>` on Vercel and `api.<domain>` on Railway, `SESSION_DOMAIN=.<domain>`, `SANCTUM_STATEFUL_DOMAINS=app.<domain>`, secure cookies, CORS with credentials; or
  (b) no domain: a Vercel rewrite so the browser calls `/api/*` and `/sanctum/*` and `/broadcasting/*` on the Vercel domain and Vercel proxies them to Railway (same-origin cookies). WebSockets do not go through Vercel rewrites, so the frontend connects to Reverb's Railway domain directly; the polling fallback must work if WSS fails.
  Test sign-in, sign-out and a page reload on a phone (Safari) before anything else.
- **Email:** verify whether Railway allows outbound SMTP on the chosen plan. If SMTP is blocked or unreliable, switch the mailer to an HTTP email API (for example Resend or Brevo, configured through Laravel's mail drivers) with the user's account; keep the M18 outbox. Gmail SMTP stays only if it works from Railway.
- **PayMongo (test mode):** register the webhook to `https://<api domain>/api/webhooks/paymongo`; no ngrok needed in hosting.
- **Demo tools:** the demo clock and demo-only buttons must work on the hosted demo database (it is a demo database, flag it as such), so the defense can show a reminder arriving.
- **Secrets** only in the Vercel/Railway/Supabase dashboards, never in the repo or chat. `.env.example` lists names only.

**Hosted checklist (all must pass before Thursday morning; write results in `docs/HOSTED_CHECKLIST.md`)**
1. Landing page loads on phone and desktop over HTTPS, real branches and hours show.
2. Sign-up email code arrives in a real inbox; verify → sign-in with the email prefilled; reload keeps the session.
3. Booking end to end; confirmation email arrives.
4. Real-time messaging patient ↔ front desk (and the polling fallback).
5. Reminder via the demo clock arrives (scheduler + worker running).
6. Invoice → PayMongo test checkout (GCash/card test) → webhook → receipt email + PDF download.
7. Staff, dentist and owner sign-ins; Automations, schedules, leave, handovers, intake (counter QR, kiosk) open without errors.
8. No secrets in the frontend bundle; HTTPS only; errors logged but not shown to users.
9. Cold-start and response times acceptable (note any slow screen).
10. A one-command (or one-click) way to reset the hosted demo data before the defense, documented.

Hosting must not delay Thursday: if a piece cannot be made to work in time (for example WebSockets), use the documented fallback (polling) and tell the user plainly.
This file tells a new AI coding agent (Codex) everything needed to continue without the previous conversation.
Read it fully, then read `docs/POST_DEFENSE_TASKS.md`, `docs/defense/MODULES_FINAL.md` and `docs/defense/OPEN_ITEMS.md` (they are the source of truth when this file and the repo disagree).

---

## 1. What this project is

- Web-Based Multi-Branch Dental Clinic System for **Dr. Dana E. Roxas Dental Clinic** (3 branches).
- School project (3rd-year BSIT, Group 3, BSIT 3B, subject: Business Process Automation) with a **production-level quality bar**. The professor wants the defense run **like a sales pitch**; the team plans to sell the product to real clinics later.
- 25 modules (M1 to M25, catalog v5.0). Honest status per module is in `docs/defense/MODULES_FINAL.md`.
- The user (student) is often tired and working late. They want **simple, ordered, copy-pasteable steps**, and they prefer prompts written in **XML format**. Keep reports short and honest.

## 2. Hard rules (do not break)

1. **Never touch the `dental_clinic` database** (the real clinic DB). Work only on `dental_clinic_demo` and `dental_clinic_test` (`dental_clinic_isolated` exists too). `dental_clinic` is guarded by `ALLOW_CLINIC_DATABASE=yes`; do not set it. Any migration or data change the clinic DB needs goes in `docs/POST_DEFENSE_TASKS.md` as **pending, needing the user's approval**.
2. **Never print, log, commit or paste secrets.** `backend/.env` (gitignored) holds Gmail SMTP, PayMongo test keys and APP_KEY. Secrets are never shared in chat. Scan every diff for secrets before committing.
3. **No `git push` and no merge** until the user explicitly asks. All work is local commits on `feat/auth-messaging-paymongo`.
4. **Do not invent clinic facts** (prices, hours, policies, staff, statistics, testimonials, awards, photos). Anything the clinic has not confirmed is an Owner-editable setting labelled "default, not confirmed by the clinic".
5. **Honest status claims.** Never mark a module higher than code and tests prove (Implemented / Partial / Mock only / Planned). No invented time savings: the interview gave no TO-BE measurements ("not measured / to be measured in pilot").
6. **Privacy first (RA 10173):** collect the minimum, consent before collecting, no ID images stored by default, no full ID numbers, no clinical text in audit logs/emails/logs, the Owner cannot read patient messages or clinical content.
7. **No hard deletes.** Records are archived/soft-deleted/voided; many tables are append-only (DB triggers refuse updates/deletes). Do not weaken this.
8. Wording rules: say "Payment Receipt" / "Invoice", never "Official". HMO: show only the clinic-confirmed accepted HMO list (section 22); no coverage calculation or claims processing is built.
9. Do not clone or scrape other clinics' UIs; use licensed images only (list in `docs/CREDITS.md`).
10. Use Asia/Manila explicitly for every time calculation (see known issue on timezones).

## 3. Stack and environment

- **Frontend:** React 19.1 + Vite 7.1 (JSX, not TSX). Main areas: `src/App.jsx`, `src/patient/`, `src/pages/`, `src/polish.css`, `src/clinic-config.js` (only allowed hard-coded fallback: clinic name and contact). Legacy `src/data.js` is still partly used and is to be retired after the defense.
- **Backend:** Laravel 13, PostgreSQL, Sanctum cookie auth, `database` queue, a **durable email outbox (M18)** with retries, scheduler, Laravel Reverb 1.12 for real-time messaging (laravel-echo + pusher-js on the client), PayMongo (test mode), dompdf for PDFs, Laravel Mail via Gmail SMTP (smtp.gmail.com:587; a clinic-owned domain and a transactional provider are post-defense).
- **Databases:** `dental_clinic` (real, do not touch), `dental_clinic_test`, `dental_clinic_isolated`, `dental_clinic_demo` (used for the demo).
- **Repo:** `~/Downloads/multibranch-dental-clinic` on the user's Mac (macOS 12.7.4 Intel). Branch `feat/auth-messaging-paymongo`. Local commits only.
- **Ports:** API 8000, portal 5173, Reverb 8080; verification runs may use 8001/5175.
- **Tunnel:** ngrok free static domain `unclear-jase-enviously.ngrok-free.dev`, used so PayMongo webhooks reach the laptop.

### Run the demo
```
cd ~/Downloads/multibranch-dental-clinic
lsof -ti:8000 -ti:5173 -ti:8080 | xargs kill; pkill -f "queue:work"; pkill -f "reverb:start"; pkill -f ngrok; sleep 2
NGROK_DOMAIN=unclear-jase-enviously.ngrok-free.dev ./scripts/demo-start.sh
```
Then in another terminal: `./scripts/predefense-check.sh`. Expected: all required checks PASS and known warnings (branch 3 email missing, 9 assistant answers still drafts). The branch 3 ZIP/address warning must be removed: the clinic confirmed the address as given is correct (section 22).
Other scripts: `scripts/demo-reset.sh` (rebuilds `dental_clinic_demo`; must leave exactly one queue worker, one scheduler and one Reverb running), `scripts/payment-test.sh`.
Before running tests, make sure no leftover test run is active (`pgrep -fl "artisan test|phpunit|vitest"`): two suites sharing the test database cause flaky failures.

### Test results at last full runs
Backend 813/813 (a later security fix was only partly re-run; run the full suite first), frontend 875/875, smoke 16/16, build OK. Known flake: `ConcurrentQueueNumberTest` can fail if it runs during the 23:59 minute (test sets the branch open 00:00 to 23:59); it passes on re-run.

## 4. Design language
- "Design A" (default): mint and light blue, rounded cards, primary `#1865ac`, accent `#0c9b8e`, wave divider, clinic logo from branding settings. Mobile first (390 px) and desktop (1440 px), AA contrast, keyboard use, `prefers-reduced-motion` respected.
- Emails: table-based, inline CSS, CID-embedded logo, plain-text alternative, dark-mode variants. PDFs (dompdf) on A4 with page numbers.
- White-label: `config/clinic.php`, ClinicSettingsSeeder, Owner "Administration → Clinic Branding"; no hard-coded clinic info in components.

## 5. Real clinic data received
- **Branches** (all: Mon to Fri 8:00 AM to 8:00 PM, Sat 8:00 AM to 5:00 PM, Sun closed, Asia/Manila):
  1. Dr. Dana Roxas Dental Clinic, 0922 878 7341, danaroxas.dentalclinic@gmail.com
  2. Roxas - Cardinal Dental Center, 0922 878 7341 (confirmed same number as 1), danaroxasdental@gmail.com
  3. Roxas Dental Clinic Guiguinto, 0933 867 8725, **no email**, address **confirmed correct as given** by the clinic (no longer an open item; remove the pre-defense ZIP warning)
- Branch coordinates are from public Google Maps records (`docs/BRANCH_LOCATIONS.md`).
- Clinic operating since 1981. Usually less busy on Wednesday and Thursday.
- Demo accounts use placeholder Filipino names (mostly women), Dr. Dana Roxas is the Owner; team +demo inboxes receive demo emails.

## 6. Interview evidence (summarised; full text in `docs/defense/INTERVIEW_EVIDENCE.md`)
Round 1: Q1 to Q32 and 20 follow-up answers (PI-xx) are recorded verbatim. Round 2 (2026-10-19, answered by **clinic staff, not the Owner**) key facts, recorded as R2-xx:
- Current software handles appointments and records only; **billing is on paper**. Each branch uses the same software with **its own separate database** (a patient moving branch must re-register).
- New patients fill a **paper form**, staff retype it (about 15 min to sign in; procedures 20 to 60 min).
- No-shows and cancellations are "the biggest gap" (no automatic email). Late rule: more than 10 min late goes to the end of the queue; after 15 min the appointment is cancelled.
- Reminder 60 min before; the Owner approves wording. Health-related messages need a dentist's approval.
- Liked feature of their current system: a visual staff calendar showing crowded days.
- Cancellation: 24 hours before (recommendation accepted as base). Braces/sensitive services should not be bookable directly; patients book the consultation that leads to it.
- ID scan: all valid IDs accepted, image may be deleted after staff verify; open question about minors without ID (answered by guardian/dependent profiles).
- HMO list **confirmed by the clinic as its actual accepted HMOs** (the user confirmed on 2026-10-20): Avega, InLife iCare, Intellicare, eTiQa, Dental Network partnerships, AXA Health Plans (for qualifying premium dental packages).
- Patients **pay the appointment fee via PayMongo when booking** (confirmed 2026-10-20; section 22).
- Owner-only questions still open (section 10).

## 7. What is built (status as of the last reports)

Module counts at the last confirmed report (`MODULES_FINAL.md`): **12 Implemented, 8 Partial, 2 Mock only, 3 Planned (M10, M12, M24)**. About 71% weighted, 20 of 25 with a working core. Full per-module table in section 17, next steps in section 18, recommendations in section 19.

Built and committed (all on the demo/test DBs):
- **Auth (M1):** patient sign-up with 6-digit email OTP (hashed, 10 min, 5 tries, single use, 60 s resend cooldown, per-email/IP limits, enumeration-safe). After verification the patient is **not** auto-signed-in: goes to sign-in with the email prefilled and "Your account is verified. Please sign in.". Password reset by code. Email change needs current password + code to the new address + notice to the old. Owner invites employees. Four roles. Account **claiming** hardened: code goes only to the stored email; password is chosen only together with the emailed code (`POST /api/account/claim/verify`); records without an email can be claimed only via a staff-issued one-time link (24 h, hash stored, minors refused server-side); rate limits per IP/email/record; audit without secrets.
- **Registration intake:** counter QR page per branch, daily branch code, tablet kiosk mode (60 s idle reset), self-registration with consent, "Self-registered: verify ID" for staff, confirm dialog with service and dentist (walk-in lands in that dentist's queue), duplicate guard across branches ("Record found from Branch X", never auto-merge), **ID scan prefill on-device** (PhilID QR first, OCR fallback, fields marked "From your ID, please check", no image uploaded, no full ID number stored; optional remote upload shipped OFF), guardians and dependents (person switcher, consent per dependent, claim at 18).
- **Messaging (M17):** real-time patient to branch front desk, encrypted at rest, Reverb private channels with polling fallback, offline email alert without content, Owner cannot read patient conversations, auto-routing to the right branch.
- **Payments (M23):** PayMongo test mode Checkout Sessions (centavos), itemized lines, webhook `checkout_session.payment.paid` with signature verification (5-minute tolerance), idempotency keys, GCash and card verified (test card 4343 4343 4343 4345, 12/30, CVC 123), only our branded Payment Receipt is emailed (`send_email_receipt=false`). Billing (M11): draft invoice from performed procedures, staff review, issue, PDF invoice/receipt emails.
- **Booking (M6):** one flow (service, branch ranked by geolocation asked at the branch step and never stored, optional dentist or "any available", date, time, review, confirm), month calendar with closed/full/leave days, time chips, `.ics`, (OLD rule "no payment at booking" is replaced: see section 22, patients now pay via PayMongo when booking), no double booking (database guard), reschedule/cancel, closed dates per branch (grayed out with reason, affected visits listed, one-click reschedule email, never auto-cancelled), consultation-first services (braces, tooth extraction book a consultation), cancellation policy (late cancellation tracking; 3 late/no-show in 6 months means front-desk confirmation).
- **Automations (M18, settings per automation, all OFF until the Owner approves wording):** A1 reminders (default 60 min before; 24 h and morning-of optional; "I'll be there"/"I can't make it" signed single-use links), A2 late arrival flow (5 min "on your way?", 10 min Late, end of queue on check-in, 15 min release plus rebook email, staff can undo same day), A3 overdue invoices (days 3/7/14), A4 recall (OFF, no rules until the dentist approves), A5 waitlist plus move-up offers for freed slots, A6 Owner daily summary (counts only, 8:30 PM). Owner-editable email templates with approval before activation. Demo clock for showing a reminder arrive in seconds (demo database only).
- **M3 Work Schedules, M15 Leave, M25 Handovers:** weekly schedules per dentist/branch/weekday inside branch hours with exceptions; slot generation uses branch hours ∩ schedule ∩ leave ∩ appointments ∩ duration; leave requests with Owner approval, private encrypted note, conflicts shown, nothing auto-cancelled; handovers (receiving branch gets access only via the existing branch rule, bounded by an Owner-set number of days, forwarding prevented, "Request handover" only from a pending duplicate screen, Owner sees metadata only).
- **Assistant (M7):** knowledge mode (`ASSISTANT_MODE=knowledge`): editable FAQ table, intent matcher incl. Filipino/Taglish, safeguards for emergencies/medical advice/other patients' data, unknowns go to the front desk, Owner editor at "Administration → Assistant answers". AI mode exists but is OFF (no `ANTHROPIC_API_KEY`; the user chose not to use the Anthropic API). If ever enabled: fix first the known issue that the stream shows before the safety check.
- **Landing page and public site:** redesigned in design A with real data (branches from `GET /api/public/branches`, hours, phones, services), Create Account card with inline validation and strength meter, no HMO text, no fake stats/testimonials, Privacy/Terms placeholder pages marked "to be confirmed by the clinic", emergency note.
- **Patient portal:** real data only; removed HMO, Prescriptions (mock), Referral/Loyalty, Follow-Up (mock), Live Queue; kept Messages, Feedback, Documents and consents, Family. Page reload keeps the current page.
- **White-label settings, demo seeder, real branches, defense documents** (see section 11).

## 8. IN-PROGRESS work (verify first; the last session may have been cut off)

The following prompt was pasted into Claude Code and its result was **not yet seen** when this handoff was written. First run `git log --oneline -30` and `git status`, then compare with this list:
- **Job A:** simplify Administration → Automations page (plain language, one row per automation with switch and status chip, grouped Appointments/Payments/Reports, wording-approval link, demo tools only on the demo DB). The user then asked to **remove the "automation monitor"** parts of that page: last-run times, 7-day sent/skipped/failed counts and "Recent activity". **Keep** on/off switches, timings, wording approval (the clinic requires Owner approval of wording), failed-email visibility in the outbox, and the backend logging that `predefense-check.sh` relies on. This is not a module; the page belongs to M18.
- **Job B1 (M19 Prescriptions, real server module):** dentist-only, locked after issue, void with reason, sequential numbers RX-YYYY-000001, PDF with "Valid only with the dentist's signature" footer (no e-signature claims), optional license number entered by the dentist (never invented), patient read-only view and PDF, email with no medicine details, Owner sees metadata only, audit without medicine text, allergies warning, no drug database, no interaction checks. Remove the old browser-only mock.
- **Job B2 (M20 Follow-Up, real server module):** tasks (Open/Contacted/Booked/Closed), created by dentist/front desk or from completed treatment, "Book follow-up" preselects the booking flow and marks Booked automatically, optional reminder email automation (OFF, wording approval), Owner daily summary gets counts only. Remove the old browser-only mock.
- **Job B3 (M10 Dental Charts, stretch):** SVG tooth chart, adult 32 and primary 20, FDI numbering default, Owner-editable statuses, append-only history, role visibility (Owner sees none, patient simplified read-only).
- Plus docs updates, new migrations (demo/test only, listed as pending for the clinic DB), tests, screenshots in `docs/ui-review/`.
If these are partly done, continue only what is missing. If not started, the full XML prompt is in section 12.

## 9. Pending for the real clinic DB (needs the user's approval; do NOT run now)
See `docs/POST_DEFENSE_TASKS.md` for the authoritative, numbered list. Summary: add_email_to_branches plus real branch names and weekly_hours, 9 assistant answers (drafts) and closed days, the automation migrations (`2026_10_27_000100` to `000400`), the interview-round-2 migrations (`2026_10_28_000100` to `000500`, the first switches every automation OFF until wording approval), the intake and claim migrations (`2026_10_29_000100` to `000300`), M3/M15/M25 (`2026_10_30_000100` to `000300`), plus anything added by jobs B1 to B3. Procedure when approved: backup, test-restore, migrate, verify table counts (a past run matched 61 tables).

## 10. Open items (need the Owner, Dr. Dana, or the clinic)
- Payments: registered business? own PayMongo account? BIR receipts/invoices? (PayMongo currently shows the account owner's name, accepted for the defense.)
- Data privacy officer (DPO) and retention periods (proposal in `docs/defense/DATA_RETENTION_PROPOSAL.md`, needs Owner/DPO and legal review).
- Approval of every automated email wording (and dentist approval for clinical wording).
- Opening/closing routine and cash reporting per branch.
- (Resolved) HMO list confirmed; mark the six HMOs as verified (section 22).
- Each dentist's real weekly hours at each branch (demo schedules are labelled "demo schedule, not confirmed by the clinic").
- Leave policy (who approves, balances not tracked), handover retention days, whether dentists may open full patient records.
- Branch 3 email (address confirmed). ID handling for minors without ID (design: guardian profiles).
- Assistant answers 5 to 7 (home care, sensitivity, bad breath) are set to "no advice, book a check-up" pending dentist-approved wording; answer 3 should name Wednesday/Thursday (less busy) and Saturday (busy); the questionnaire PDF `docs/defense/ASSISTANT_ANSWERS_FOR_CLINIC.pdf` is the "final answers for Owner signature" sheet.
- 21+ AS-IS process steps still marked "to confirm with the clinic" (`docs/defense/SECOND_INTERVIEW_QUESTIONS.md`, about 28 questions).
- Services vs answer 2: the clinic lists orthodontics and oral surgery and X-rays; there is no bookable X-ray service.

## 11. Documents already produced (in `docs/defense/` unless noted)
`INTERVIEW_EVIDENCE.md`, `AUTOMATION_EVIDENCE.md`, `MODULES_FINAL.md`, `PROCESS_DOCUMENTATION.pdf` (As-Is vs To-Be diagram per module, 31+ pages; sources and renderer in `diagrams/`), `SECOND_INTERVIEW_QUESTIONS.md`, `DEMO_SCRIPT.md/.pdf`, `PANEL_QA.md/.pdf` (50+ questions), `PITCH.md`, `OPEN_ITEMS.md`, `REHEARSAL_REPORT.md`, `DATA_RETENTION_PROPOSAL.md`, `ASSISTANT_ANSWERS_FOR_CLINIC.pdf`. Others: `docs/DEMO_RUNBOOK.md`, `docs/WHITE_LABEL_CHECKLIST.md`, `docs/BRANCH_LOCATIONS.md`, `docs/INTAKE_PRIVACY.md`, `docs/ASSISTANT_PRIVACY.md`, `docs/CREDITS.md`, `docs/POST_DEFENSE_TASKS.md`, screenshots in `docs/ui-review/**`.
Diagrams are rendered with Playwright and the Mermaid library via a `render.mjs` script in `docs/defense/diagrams/` (not a project dependency; mermaid-cli via npx was too slow).

## 12. The plan: finish, improve, clean up, host

### Phase 1: Finish (now to Oct 21)
Complete everything in section 8 that is missing (Automations page simplified and the "automation monitor" removed, M19 Prescriptions, M20 Follow-Up, then M10 Dental Charts if time). Full backend suite, frontend tests, smoke, build, `predefense-check.sh`, browser run at 390 px and 1440 px, screenshots, commit.

### Phase 2: Improve (Oct 21 to 22)
Polish what exists; no big new features. Priorities: bugs found in a full walk-through of every role (patient, front desk, dentist, owner, public site); UI consistency in design A at 390 px and 1440 px; loading, empty and error states; speed of slow screens; wording; making the demo path in `DEMO_SCRIPT.md` flawless; one real-inbox test (sign-up code, reminder, claim email). Update `MODULES_FINAL.md`, PDFs and panel Q&A only where facts changed.

### Phase 3: Clean up (Oct 22 to 23, before the freeze)
Remove what is unnecessary, safely:
- First produce `docs/CLEANUP_PLAN.md` listing each candidate with the reason and the proof it is unused (no imports, no routes, no tests, no references): dead mock code (browser-only prototypes already replaced), unused components and CSS, the legacy `src/data.js` parts no longer read, unused scripts, duplicate or outdated docs and screenshots, temporary files, debug logs, leftover test accounts in the demo data.
- Delete only through git (so everything stays recoverable), in small commits, running the full suites after each. Never delete data from any database, never drop tables, never remove migrations that already ran, never remove audit, outbox or append-only structures, never remove the defense documents.
- Ask the user once to approve the list before deleting anything not obviously dead.
- **Oct 23 is the feature freeze**: after it, only fixes for things that break.

### Phase 4: Host (after the defense unless the user decides otherwise)
Target: **Vercel** (frontend), **Railway** (Laravel API, queue worker, scheduler and Reverb as separate services), **Supabase** (PostgreSQL and object storage). The local demo stays the main one for the defense. Before deploying, write `docs/DEPLOYMENT_PLAN.md` and get the user's approval for anything that costs money. Conditions:
- One custom domain with `app.` (frontend) and `api.` (backend) so Sanctum cookie sign-in works; correct CORS, `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN`, secure cookies.
- Region Singapore for Railway and Supabase. Supabase free tier pauses inactive projects (use a paid tier or keep it active); Vercel Hobby is non-commercial (Pro for a product that is sold).
- Supabase: pooler connection for the app, direct connection for migrations; check prepared statements with the pooler mode.
- Files (PDFs, documents, optional ID uploads) go to object storage, because Railway's disk is temporary.
- Email: a transactional provider with a verified clinic-owned domain instead of Gmail SMTP.
- PayMongo: webhook URL on the API domain; live keys only with the clinic's registered business.
- Secrets only in the hosting dashboards, never in the repo. Migrations run on the new hosted database only; the local `dental_clinic` stays untouched unless the user approves.
- Deploy a staging copy first, run the full checklist (sign-up email, booking, reminder, messaging in real time, payment webhook, PDF download), then production.

### Day-by-day (deadline-driven)

| Date | Plan |
| --- | --- |
| Oct 20 to 21 | Finish jobs A (then remove automation monitor), B1, B2, and B3 only if time. Commit. Full backend suite. |
| Oct 22 | Full dress rehearsal of `DEMO_SCRIPT.md` with a timer (target about 14 min), fix **bugs only**, one real-inbox test (sign-up code, reminder, claim email) with a real Gmail alias. |
| Oct 23 | **Feature freeze.** Only fixes for things that break. Regenerate PDFs, rerun `predefense-check.sh`. |
| Oct 24 | Rest, one more rehearsal, record a backup screen capture of the demo, charge the laptop, test the ngrok tunnel. |
| Oct 25 | Defense. Start the demo 30 min early with the commands in section 3. |

Deployment (Vercel frontend, Railway API + worker + scheduler + Reverb, Supabase database/storage) is **post-defense**; keep the local demo as the main one. Conditions: one custom domain (app. and api.) for Sanctum cookies, Singapore region, Supabase paid tier (free tier pauses), Vercel Pro for commercial use, files to object storage (Railway disk is temporary), a transactional email provider with a clinic-owned domain (Gmail SMTP is only for the defense), PayMongo live needs the clinic's registered business. Post-defense also: M12 Treatment Plans, M24 Lab Cases, inventory and low-stock alerts (clinic said "we could integrate that"), timezone fix, retire `src/data.js`, AI-stream buffering fix.

### Starting a session
No special prompt is needed: follow section 0. (If the user pastes a task prompt, follow it, but still obey section 2.)
Prompts the user gives you are usually in XML format with an **audit-first** step, a **verify** step (full suites, smoke, build, `predefense-check.sh`, browser run at 390 px and 1440 px, screenshots in `docs/ui-review/`), and a **stop** step (commit in logical commits after tests pass, no `.env`, no push, then a short report with the 6 screenshots to open first and what will not fit).

## 13. Known issues
- **Timezone (deferred):** the server runs UTC while some stored timestamps assume Philippine time (about 10 affected rows in `dental_clinic`). Plan in `docs/TIMEZONE_PLAN.md`; do not add new instances.
- Claim requests take about 2.5 to 3.5 s on this Mac (equal bcrypt work for enumeration safety); expired claim links stay in the table until a cleanup job exists.
- Dev server (4 PHP workers) can be slow while tests or browser runs are active; do not demo while running tests.
- PayMongo shows the account owner's name as merchant (accepted for the defense).
- Claude Code credentials, `.env` and secrets: never commit; the classmate must create their own `backend/.env` from `.env.example` (ask the user for values in person, never through chat or the repo).

## 15. Handoff bundle for the other assistant (ChatGPT / Cowork), created by the coding agent
The user will give a **self-contained bundle** to an assistant that cannot see the repo. Create it in `docs/handoff/` (never include secrets, `.env` values, tokens, real patient data or dumps; environment variables are listed by NAME only):
- `SYSTEM_STATE.md`: executive summary, verified module status M1 to M25 (status, what works, evidence file/test, gaps), git log summary, test results (counts), demo health, what is in progress, what is pending, risks, the next 10 actions.
- `API_ROUTES.md`: every route (method, path, controller@action, auth/role/middleware, purpose, rate limits), grouped by module.
- `DATABASE_SCHEMA.md`: every table with columns, types, key constraints, indexes, triggers (append-only), soft-delete flags, which module owns it, and the migration that created it; a list of migrations applied on each database and the ones pending for `dental_clinic`.
- `FRONTEND_MAP.md`: pages and routes by role (patient, front desk, dentist, owner, public), main components, API calls each page makes, state and storage used, and known layout limits.
- `BUSINESS_RULES.md`: every rule enforced by code (booking, hours, schedules, leave, late arrival, cancellation, billing, payments, OTP, claim, messaging, handovers, privacy, retention), with the setting name, default and who may change it.
- `SETTINGS_AND_AUTOMATIONS.md`: every Owner setting, default, whether the default came from the clinic or was recommended; each automation, its trigger, timing, idempotency key, template, approval state.
- `RUN_AND_TEST.md`: install, environment variable names (no values), run, reset, test commands, scripts and what each does, ports, known flaky tests, troubleshooting for the problems seen so far.
- `OPEN_ITEMS_AND_DECISIONS.md`: all open items, who must answer, pending approvals and the proposals made.
Also produce `docs/handoff/handoff-bundle.zip` containing these files plus `HANDOFF.md`, `docs/defense/PANEL_QA.pdf`, `docs/defense/DEMO_SCRIPT.pdf`, `docs/defense/PROCESS_DOCUMENTATION.pdf` and `docs/POST_DEFENSE_TASKS.md`. Scan the zip for secrets before reporting.
The facts must be **verified against the code and the databases** (read-only on `dental_clinic_demo` and `dental_clinic_test`), not copied from this file; where the code disagrees with this file, trust the code and list the difference in a "Corrections to HANDOFF.md" section.

## 17. Module status and progress (as of 2026-10-20; verify against `docs/defense/MODULES_FINAL.md`)

Counting method: Implemented = 100%, Partial = about 68% (core works, named parts missing), Mock only = about 20%, Planned = 0%.
**Overall: about 71% weighted. 12 of 25 fully implemented (48%). 20 of 25 have a working core (80%).** If the in-progress M19 and M20 are finished, this rises to about 14 of 25 fully implemented and about 77% weighted.

| Module | Status | What works / what is missing |
| --- | --- | --- |
| M1 User Management | Partial (verify) | OTP sign-up, password reset, email change, invites, 4 roles, account claim, guardians, ID prefill. Missing: more than one Owner account. |
| M2 Branch Management | Partial (verify) | Real branches, per-day hours, closed/holiday dates. Missing: branch 3 email (clinic). |
| M3 Work Schedules | Implemented | Weekly schedules, exceptions, used by all booking paths. Demo hours not confirmed by the clinic. |
| M4 Patient Records | Partial | Profile, audited edits, duplicate guard, guardians. Missing: archive (soft delete with audit), merge. |
| M5 Treatment Management | Implemented | Visit-linked treatment, locked when complete. |
| M6 Appointment Management | Implemented | One-flow booking, reminders, late flow, freed slots, waitlist, cancellation policy, consultation-first. |
| M7 AI Chatbot (Clinic Assistant) | Implemented (knowledge mode) | FAQ answers, safeguards, Owner editor. AI mode off. 9 answers still drafts. |
| M8 Patient Visits | Partial | Check-in, walk-ins, self-registration confirm. Missing: complete assignment workflow. |
| M9 Patient Queue | Partial | Queue numbers, live dentist queue, late to the end. Missing: full live screens. |
| M10 Dental Charts | Planned (in progress as stretch) | Not built unless job B3 finished. |
| M11 Billing Management | Implemented | Draft from treatment, review, issue, invoice PDF/email. |
| M12 Treatment Plans | Planned | Post-defense roadmap. |
| M13 Services and Pricing | Partial | Versioned prices, consultation-first. Missing: clinic-approved prices. |
| M14 Document Management | Partial | Private upload/download, retraction. Missing: extraction drafts in production use. |
| M15 Leave Management | Implemented | Requests, approval, conflicts, blocks booking. Balances out of scope. |
| M16 Patient Inquiries | Partial | Staff record outside inquiries. Missing: Facebook/Messenger link. |
| M17 Patient Messaging | Implemented | Real-time, encrypted, offline email alert. |
| M18 Notifications | Implemented | Outbox with retries, automations with Owner-approved wording. |
| M19 Prescriptions | Mock only (in progress) | Becomes Implemented if job B1 is finished. |
| M20 Patient Follow-Up | Mock only (in progress) | Becomes Implemented if job B2 is finished. |
| M21 Reports and Analytics | Partial | Owner metrics, daily summary email, staff calendar load. Missing: full filters, exports. |
| M22 Audit Logs | Implemented | Append-only, search, CSV export. |
| M23 Payment Management | Implemented (test mode) | PayMongo checkout, verified webhook, receipt. Live needs the clinic's business account. |
| M24 Lab Cases | Planned | Post-defense roadmap (clinic tracks manually). |
| M25 Patient Handovers | Implemented | Handover with bounded, non-forwardable access, Owner sees metadata only. |

(The 12th Implemented module was promoted in an earlier task; confirm which one in `MODULES_FINAL.md`, then correct this table.)

## 18. Next things to do (in order)
1. Deploy the current state (section 0.1) and pass the hosted checklist.
1b. Apply the clinic decisions in section 22 (verified HMO list, branch 3 address, then **payment at booking via PayMongo**).
2. Finish section 8 in the gaps: Automations page cleanup and "automation monitor" removal, M19, M20; M10 only if all else is done.
3. Real-inbox test on the hosted version (sign-up code, reminder, claim, receipt).
4. Update `MODULES_FINAL.md`, the process PDF, `PANEL_QA`, `DEMO_SCRIPT` (now on the hosted URL) and the pitch "next phase" slide.
5. Full rehearsal Thursday; freeze Thursday evening.
6. Ask the clinic/Owner the open items in section 10 (they do not block the defense).

## 19. Recommendations for a better system (after the defense unless marked)
**Before the defense (cheap, high value):**
- A GitHub Actions workflow that runs the backend and frontend tests on every push, so two people working on the repo cannot break it silently.
- Error monitoring on the hosted API and frontend (a free tier of an error tracker) and an uptime check on the landing page and API.
- One Playwright end-to-end test of the exact demo path (sign-up, book, message, pay), run against the hosted URL before the defense.
- Automated daily database backup of the hosted Supabase project and a tested restore.

**After the defense (product quality, needed to sell to clinics):**
- Fix the timezone issue (`docs/TIMEZONE_PLAN.md`) and retire `src/data.js`.
- SMS reminders through a Philippine SMS provider (many patients miss emails), and Facebook/Messenger inquiry intake (R2-04: the clinic answers bookings there).
- Inventory and low-stock alerts (the clinic asked), M12 Treatment Plans, M24 Lab Cases, M10 if not built.
- Report exports (CSV/PDF), period and branch filters, more than one Owner account, patient record archive.
- Data retention jobs and a privacy dashboard (consent records, access requests) once the Owner and DPO approve the retention proposal; NPC registration guidance for the clinic.
- An onboarding wizard for a new clinic (branding, branches, services, prices, staff) so the white-label product can be sold and set up without a developer; a pricing/subscription model; a decision on one deployment per clinic versus multi-tenant.
- A clinic-owned email domain with a transactional email provider, PayMongo live keys under the clinic's registered business, BIR-compliant receipts if required.
- Accessibility audit (WCAG 2.1 AA) of every role, and a performance pass on the slowest staff screens.

## 20. IMPORTANT: the paper's module list is the official one (align the defense docs to it)

## 20. IMPORTANT: the paper's module list is the official one (align the defense docs to it)

The group's official paper is `BPA_MODULES_UPDATED_OCT_20_2026.docx` and `BPA_MODULES_UPDATED_OCT_22_2026.docx` (25 modules, renumbered so each member owns an exact block of 5 consecutive, connected modules, with short names such as "User Management" and no "&"). Defense documents (`docs/defense/MODULES_FINAL.md`, `PITCH.md`, `PANEL_QA.md`, `DEMO_SCRIPT.md`, and `AUTOMATION_EVIDENCE.md`) are 100% aligned to the paper's 25 modules and numbers, keeping every status honest, with the traceability table in `MODULES_FINAL.md`. Every module has plain-language Purpose, Process Description, Inputs, Activities, Outputs, Stakeholders, Flow, Metrics, Issues, Improvements, Automation, Lifecycle and an "Implementation status (October 20, 2026)" line; M7 Attendance Management is a full module; HMO appears only as an optional billing input; M23 is Archives & Historical Records Management; M26 is removed.

Paper modules (25 modules total, 5 per member) and owners:
| No. | Paper module | Owner | Built feature(s) that belong here (internal catalog → verify) |
| --- | --- | --- | --- |
| 1 | User Management | Licanda | M1 accounts, OTP, roles, claim |
| 2 | Branch Management | Licanda | M2 branches, hours, closed dates |
| 3 | Staff Management | Licanda | M3 work schedules, M15 leave |
| 4 | Service Management | Licanda | M13 services/prices, consultation-first |
| 5 | Clinic Policy Management | Licanda | Owner settings: late/cancellation policy, reminder timings, branding, templates approval |
| 6 | Appointment Management | Alejo | M6 booking flow, calendar, PayMongo pay-at-booking |
| 7 | Attendance Management | Alejo | reminder "I'll be there / I can't make it", late-arrival flow, no-show flags, late-cancellation tracking |
| 8 | Check-In Management | Alejo | M8 check-in, walk-ins, counter QR self-registration, kiosk |
| 9 | Queue Management | Alejo | M9 queue, late to end of queue |
| 10 | Patient Flow Management | Alejo | staff calendar load, freed-slot move-up offers, waitlist |
| 11 | Patient Records Management | Ecal | M4 records, duplicate guard, M25 handovers |
| 12 | Document Management | Ecal | M14 documents, intake consent, ID scan prefill |
| 13 | Treatment Management | Ecal | M5 treatments; interactive SVG dental chart, consultation-first flow |
| 14 | Prescription Management | Ecal | M19 prescriptions (server-authoritative, sequential RX-YYYY-000001, A4 PDF) |
| 15 | Follow-Up Management | Ecal | M20 follow-up tasks, recall reminders |
| 16 | Social Media Management | Millar | M16 inquiries, campaign tracking links |
| 17 | AI Chatbot Management | Millar | M7 assistant (Google Gemini AI gemini-1.5-flash with knowledge fallback) |
| 18 | Messaging Management | Millar | M17 messaging (encrypted, branch routing) |
| 19 | Notification Management | Millar | M18 outbox, reminders, emails, in-app notifications |
| 20 | Marketing Management | Millar | campaign link attribution (?promo= / ?ref=), conversion tracking |
| 21 | Billing Management | Delos Santos | M11 billing, PayMongo checkout, 20% Senior/PWD discount, receipts |
| 22 | Loyalty Management | Delos Santos | Double-entry loyalty points ledger prototype |
| 23 | Archives & Historical Records Management | Delos Santos | Cross-branch visit/prescription/receipt archives, patient portal (#p/archives), restore/export |
| 24 | Analytics Management | Delos Santos | Executive Owner metrics, campaign performance, daily summary email counts |
| 25 | Audit Management | Delos Santos | M22 append-only database audit trail, policy and archive actions, CSV export |

The right-hand column is a best-effort mapping verified against the code and the paper's own text.

### Social Media and Marketing monitoring (requested by the group for M16 and M20)
Goal: when the clinic posts on its Facebook Page, Dr. Dana sees in the system how the post performed and whether patients increased compared with the previous week. Build it in two layers; do layer 1 only if hosting and the section 8 work are done, layer 2 after the defense unless it fits easily:
1. **Campaign tracking (built for the defense):** the Owner records a campaign (title, Facebook post link, start date, branch or all). The system creates a tracked booking link and a short code (for example `?ref=fb-oct-promo` or `?promo=...`) to put in the post. Bookings and new accounts that arrive through that link are attributed to the campaign. Optional "How did you hear about us?" field at sign-up/booking (Facebook, friend, walk-in, other). An Owner screen shows, per campaign: link visits, new accounts, bookings, completed visits and paid amount from those bookings, plus **this week vs last week** for new patients and bookings clinic-wide and per branch, as a chart. Label it honestly: it shows what happened after the post, not proof that the post caused it.
2. **Facebook Page insights (needs Meta setup):** connect the clinic's Facebook Page through a Meta app with the Pages permissions for reading engagement and insights; Dr. Dana must be an admin of the Page and approve the connection. A scheduled job pulls each post's reach/impressions, reactions, comments, shares and link clicks, and Page follower changes, into the system daily; the campaign screen shows them beside the booking numbers. While the app is in development mode it works for Page admins and testers without Meta's App Review; using it for other clinics later needs App Review and business verification. Meta renames and retires insight metrics from time to time, so read the current Graph API docs and fail gracefully. Store only aggregate numbers, never personal data of Facebook users. Token stored encrypted, refresh handled, Owner can disconnect.
Messenger inquiries flowing into the system (M16) are a separate, later step (Messenger Platform webhook, also needs App Review for business use).


## 21. Gaps between the paper and the code (post-defense roadmap)
The rewritten paper describes an industry-level process. Features verified as Built today (20 modules) include M21 Senior/PWD discount, M13 SVG dental chart, M14 sequential server prescriptions, M15 follow-up tasks, M20 campaign tracking, and M23 archives. Items scheduled on the post-defense roadmap:
1. **Billing (M21):** Formal BIR CAS accreditation, installment payment schedules.
2. **Patient Flow (M10):** Predictive machine-learning queue wait-time estimation.
3. **Treatment (M13):** Multi-phase treatment plans, dental lab case tracking.
4. **Social Media and Marketing (M16, M20):** Meta / Facebook Page Graph API insights and live Messenger webhook integration.
5. **Messaging (M18):** File and media attachments.
6. **Notifications (M19):** Direct telco SMS gateway integration.
7. **Users (M1):** 2FA / TOTP sign-in; multi-owner administration.
8. **Records (M11):** Record merge approval workflow.


## 22. CLINIC DECISIONS CONFIRMED ON 2026-10-20 (override anything older in this file and in the repo docs)

1. **HMO list is real and verified.** Mark these six as verified accepted HMOs (all branches unless the Owner says otherwise): Avega, InLife iCare, Intellicare, eTiQa, Dental Network partnerships, AXA Health Plans (for qualifying premium dental packages). Show them on the landing page, the FAQ and the assistant (answer 4: "Yes, we accept Avega, InLife iCare, Intellicare, eTiQa, Dental Network partners and AXA Health Plans (qualifying dental packages). Please bring your HMO card; coverage is checked at the front desk."). Billing records the HMO used and the approval/LOA reference at the counter; no automatic coverage calculation or claims.
2. **Branch 3 address is correct as given.** Remove the open item and the pre-defense ZIP/address warning; only the missing email remains.
3. **Patients pay when booking online, through PayMongo.** This replaces the old rule "no payment at booking". Build it after the first hosted deploy works (it is the clinic's requirement, so it comes before the section 21 gaps):
   - Amount: the price of the booked service (for consultation-first services such as braces, the consultation price, not the treatment). Owner setting: full service price or a fixed reservation fee. Default: full price of the booked service, labelled "not confirmed by the clinic" until Dr. Dana confirms.
   - Flow: Review → Pay with GCash or card (PayMongo Checkout, existing integration and webhook) → slot held as "Pending payment" for 15 minutes (setting) → verified webhook confirms the appointment and sends the confirmation, the Payment Receipt and the calendar file. Unpaid after the hold time → slot released automatically, patient told. Never confirm from the browser redirect alone; only from the verified webhook.
   - Credit: the booking payment is credited on the visit's invoice; the patient pays only the remaining balance after treatment (online or at the clinic).
   - Refunds (Owner settings, defaults "not confirmed by the clinic"): cancelled 24 hours or more before → automatic full refund through PayMongo's refund API; less than 24 hours before or a no-show → no automatic refund, front desk decides (refund, credit or keep), with a reason, audited. Released-at-15-minutes late arrivals count as no-shows.
   - Rescheduling keeps the payment attached to the appointment. Staff and walk-in bookings may be marked "pay at clinic".
   - Concurrency: two patients cannot pay for the same slot; the hold is enforced by the same no-double-booking guard. Idempotent webhook handling (already present).
   - Update: booking UI, emails, the assistant answer 8 ("Yes, you pay the appointment fee when you book online through GCash or card. If you cancel at least 24 hours before, it is refunded."), FAQ, landing page "How it works", DEMO_SCRIPT (book and pay in one flow), PANEL_QA, MODULES_FINAL and the paper's M6/M21 status lines.
   - Tests: hold expiry, webhook-only confirmation, refund ≥24h, no automatic refund <24h, credit on invoice, double-pay race, PayMongo test card and GCash on the hosted URL.
4. Still open with the Owner: exact fee amounts and refund policy confirmation, BIR receipts, live PayMongo business account, data privacy officer and retention, wording approval, dentists' real hours, branch 3 email.

## 16. Content of AGENTS.md (create it at the repository root if it is missing)
```
# AGENTS.md

This repository is a multi-branch dental clinic system with a defense on Saturday 2026-10-24; it must be hosted (Vercel + Railway + Supabase) and working before Thursday 2026-10-22 (HANDOFF.md section 0.1).

Before doing anything, read HANDOFF.md in the repository root, fully, and follow its section 0 ("READ THIS FIRST").

Non-negotiable rules (full list in HANDOFF.md section 2):
- Never touch the dental_clinic database; work on dental_clinic_demo and dental_clinic_test only. Changes the real clinic database needs are listed as pending in docs/POST_DEFENSE_TASKS.md.
- Never print, log or commit secrets (backend/.env). Scan every diff for secrets.
- No git push and no merge unless the user asks.
- Do not invent clinic facts; use Owner-editable settings with defaults labelled "not confirmed by the clinic".
- Keep module statuses honest (Implemented / Partial / Mock only / Planned).
- No hard deletes of data; respect append-only tables. Delete code or files only through git after the user approves the cleanup list.
- Use Asia/Manila for time.
- Work in this order: host first (HANDOFF.md section 0.1, deadline before Thursday 2026-10-22), finishing the in-progress work in the gaps; then improve; clean up only if 100% safe.
- Reports to the user are short, ordered and honest. Always finish a task with: full test suites, smoke, build, scripts/predefense-check.sh, then commit in logical commits.
```

## 14. Handing the repo over (user action)
Before the handover: make sure everything is committed (`git status` clean), scan for secrets, then either (a) copy the folder to the classmate **without** `backend/.env`, `node_modules`, `backend/vendor` and any dump files, or (b) push to a **private** GitHub repository (the user must decide; nothing has been pushed so far). The classmate must then run `composer install`, `npm install`, copy `.env.example` to `backend/.env`, add the secrets locally, create the databases (`dental_clinic_demo`, `dental_clinic_test`), run the migrations on those two only and start the demo as in section 3.
