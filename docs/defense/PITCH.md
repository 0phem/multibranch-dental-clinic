# Pitch: Multi-Branch Dental Clinic Operation System

Every fact below cites its source: Q = first interview, PI = follow-up interview, R2 = interview round 2 of 2026-10-19 with
clinic staff (all in `docs/defense/INTERVIEW_EVIDENCE.md`), or a repository document. No statistic, customer or result is claimed that the system
or the interview cannot show.

## The problem (what the clinic told us)

**What the staff told us on 2026-10-19 (R2), and our answer:**

| Their pain | Our answer (built and tested) |
| --- | --- |
| Each branch has its **own separate database**; a patient who moves branch registers again or staff retype everything (R2-08) | One clinic database for all three branches: one patient record, one booking calendar |
| New patients fill in a **paper form**, then staff **retype it** "which is tough for us" (about 15 minutes, R2-03, R2-05) | Patients create their own account and record online before the visit (email code); the front desk only checks it |
| **No-shows and cancellations are "the biggest gap of our system"**: no automatic email (R2-07); a cancellation can leave the clinic idle for an hour (R2-10) | Reminder 60 minutes before (R2-09) with "I'll be there" / "I can't make it"; "Are you on your way?"; release at 15 minutes (R2-10); the freed time is offered to later patients first, then the waitlist, then walk-ins |
| **Billing is still on paper** (R2-01) | Invoice from the treatment, emailed PDF, online payment, receipt emailed |

Also from the first interviews:

- **Long queues and waiting.** The step that causes the most delays is "Long patient queues" (Q19); the most frequent patient
  complaint is "Long waiting time" (Q21); "better" means "Shorter wait times and more real-time updates in booking and to
  patients prior to treatments" (Q32).
- **Scheduling conflicts** are the most frequent mistake (Q20).
- **Messages land on the Owner.** Patients send questions through Facebook / Messenger (PI-42), and the clinic Owner usually
  answers them (PI-43). Online messaging is one of the two things she would automate first (Q23).
- **Reminders for every appointment** are given today (PI-31), by phone, SMS, Messenger or email (PI-30).
- **Three branches, one team.** 2 in Bocaue and 1 in Guiguinto (Q2); 12 dentists and 7 staff (Q4); 10–20 patients a day (Q7);
  weekends are busier, especially October to February (Q10).
- **Software already costs money.** The clinic pays around ₱1,400 per month for software (Q14) and values that it is centralized
  across branches (Q18). Forms are already digitized, except prescriptions (Q16).

## The solution (what is built today)

One web system for patients, front desk, dentists and the owner, across all branches:

| For | What it does | Status / evidence |
| --- | --- | --- |
| Patients | Book online in one flow (service → branch near you → dentist or "any available" → day → time); real open times; pay booking deposit via PayMongo (credited to visit invoice) | Built: `M6`, `Appointments/*`, `Payment/AppointmentBookingPaymentTest` |
| Patients | Email confirmations, notifications, reschedule and cancel themselves | Built: `M6`, `M19`, `PatientPortalApiTest`, `AppointmentEmailTest` |
| Patients | Message the front desk in real time; branch routing handled automatically | Built: `M18`, `Messaging/*` |
| Patients | Pay online (GCash, card…) with PayMongo; 20% Senior Citizen / PWD statutory discount (RA 9994 / RA 10754) with verified ID; receipt emailed with PDF | Built: `M21`, `Billing/*`, `PayMongoPaymentTest` |
| Patients | Share visit feedback with 1–5 star ratings; low ratings auto-spawn follow-up care | Built: `M26`, `Feedback/*`, `tests/m26-feedback.test.js` |
| Patients | A clinic assistant answering in English, Filipino and Taglish from approved information | Built (knowledge mode): `M17`, `AssistantKnowledgeTest` |
| Front desk | Conflict-free calendar, check-in, queue, billing from treatment, Senior/PWD discounts | Built: `M8`, `M9`, `M10`, `M21` |
| Dentists | Visit-linked treatment records, locked when completed, append-only history | Built: `M13`, `Treatments/*` |
| Dentists | Interactive SVG dental chart (32 adult and 20 primary teeth) with condition history | Built: `M13`, `Charts/DentalChartTest` |
| Dentists & Patients | Prescriptions issued by dentist (locked once issued, numbered RX-YYYY-000001, voidable with reason), A4 PDF | Built: `M14`, `Prescriptions/*` |
| Front desk | Server follow-up tasks from treatment notes, rebooking integration, recall reminders | Built: `M15`, `Followups/FollowupTest` |
| Front desk & Dentists | Patient handovers between branches or dentists, acknowledged, time-limited access | Built: `M11`, `Staffing/HandoverTest` |
| Owner | Branches, staff schedules, leave approvals, branding, wording approval, audit trail | Built: `M2`, `M3`, `M5`, `M23`, `M25` |

Not finished, and we say so: multi-phase treatment plans, external lab cases, and live Meta Messenger integration are post-defense roadmap items. Full traceability in `docs/defense/MODULES_FINAL.md`.

## Deployment model

- **One installation per clinic** (white-label): the Owner sets the clinic name, colours, logo and contact; branches (address,
  phone, email, hours per day), services and prices are data, shown on the clinic's own public website and in every email
  (`docs/WHITE_LABEL_CHECKLIST.md`).
- **The clinic's own accounts:** its own PayMongo account (payments go straight to the clinic; the patient sees the clinic's
  name) and its own email domain.
- **Privacy first:** the assistant runs without AI by default, so nothing a patient types leaves the system
  (`docs/ASSISTANT_PRIVACY.md`).

## Pricing — PROPOSAL (not a quote, not market-tested)

| Item | Proposal | Basis |
| --- | --- | --- |
| Monthly subscription per clinic (up to 3 branches) | ₱1,400 | Same as what the clinic pays for software today (Q14) |
| One-time setup | ₱5,000 | Branding, data entry of branches/services/prices, PayMongo connection, staff training (Q30: there was a learning curve before) |
| Payment fees | Paid by the clinic to PayMongo directly | PayMongo's published fees per transaction |
| Optional AI mode | At cost (the clinic's own Anthropic key) | `docs/ASSISTANT_PRIVACY.md` |

Hosting and email-provider costs are not yet measured; the subscription must be checked against them before any offer.

## 60-second pitch

"Dr. Roxas told us her biggest problems are long queues and waiting times, scheduling conflicts, and answering patients on
Messenger herself. We built one system for her three branches. Patients book online and see only real open times, so conflicts
can't happen. They get confirmations, can reschedule themselves, and message the right branch's front desk in real time. After
the visit the invoice arrives by email, they pay with GCash or card through PayMongo, and the receipt comes back automatically.
A clinic assistant answers routine questions in English and Filipino from the clinic's own approved answers, and hands anything
else to the front desk. It runs as the clinic's own branded installation, with its own PayMongo account."

## 3-minute pitch (outline to speak)

1. **Who and what hurts (40 s):** since 1981, three branches, 10–20 patients a day (Q1, Q2, Q7). Queues and waiting (Q19, Q21),
   conflicts (Q20), the Owner answering Messenger (PI-42, PI-43).
2. **Live proof (90 s):** book with the calendar → confirmation email → ask the assistant "Bukas ba kayo sa Linggo?" → chat with
   the front desk → invoice email → pay with GCash (test) → receipt with PDF.
3. **What is automated (30 s):** the six automations in `AUTOMATION_EVIDENCE.md` (scheduling rules, email outbox with retries,
   codes, webhook settlement, documents, assistant).
4. **Honesty and next steps (20 s):** what is not finished, the open decisions for the clinic, and the proposal.

## Slide outline (12 slides)

1. **Title** — system name; team; Dr. Dana E. Roxas Dental Clinic as our partner clinic; date.
2. **The clinic** — since 1981, 3 branches (Q1, Q2); 12 dentists, 7 staff (Q4); 10–20 patients/day, busier weekends (Q7, Q10).
3. **The problem** — long queues and waiting (Q19, Q21); scheduling conflicts (Q20); Messenger answered by the Owner (PI-42, PI-43).
4. **What "better" means** — shorter waits and real-time updates (Q32); automate online messaging (Q23); reminders today (PI-31).
5. **Our solution** — one web system for 4 roles; patient portal; front desk; owner; branded per clinic.
6. **Booking without conflicts** — real open times only; nearest branch; database-level double-booking guard.
7. **Paying without paperwork** — invoice from the treatment; PayMongo; automatic receipt PDF.
8. **Messages and the assistant** — real-time front desk; assistant in English/Filipino/Taglish; never invents, hands off.
9. **Security and privacy** — roles, branch scope, audit trail; codes for sign-in; nothing leaves the system in knowledge mode.
10. **Status, honestly** — 19 Implemented, 7 Partial, 0 Mock only (all 26 modules from the official paper BPA_MODULES_UPDATED_OCT_20_2026.docx mapped in `MODULES_FINAL.md`); before/after process per module (`PROCESS_DOCUMENTATION.pdf`); known issues (timezone, BIR, reminders).
11. **Deployment and proposal** — one install per clinic; clinic's own PayMongo and email; pricing proposal; open decisions.
12. **Post-defense roadmap (not built)** — Multi-phase treatment plans, external lab case tracking, and live Meta Messenger integration; each documented in `MODULES_FINAL.md`.
