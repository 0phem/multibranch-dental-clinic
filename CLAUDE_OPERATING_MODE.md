# CLAUDE_OPERATING_MODE.md
## Evidence and product rules for the Dr. Dana E. Roxas Dental Clinic system

This file supplements `AGENTS.md` and `CLAUDE.md`. It does not repeat their working method, Git safety,
testing, backend-boundary, P1–P9, report or stop-condition rules. If this file conflicts with `AGENTS.md`
or `CLAUDE.md`, STOP and report the conflict.

Keep this file durable: no current-phase status, commit IDs or next-step plans. Those belong in task
prompts and handoff notes.

---

## 1. Three kinds of truth

- **What the system currently does** → the repository code wins over any document or handoff.
- **What the system should do** → `AGENTS.md`, `CLAUDE.md` and the canonical docs win
  (`MODULE_COVERAGE.md`, `FRONTEND_SCOPE.md`, `DOCUMENTATION_RECONCILIATION.md`, `ERD_ALIGNMENT.md`,
  phase docs, `PROFESSOR_DEMO_GUIDE.md`).
- **What the clinic actually said** → `docs/process/CLINIC_INTERVIEW_QA.md` (Q1–Q32) wins.

The academic process document (`docs/process/Dr_Dana_Roxas_Final_25_Module_Combined_Documentation_v1.1.docx`)
is a team deliverable. It records each module's purpose and an "Implementation Status" line. Treat it as
canonical documentation for module names, owners and scope.

Handoff/history files are context only. Never assume GitHub is newer than the local repository.

## 2. Evidence labels

Every business statement is one of:

- **Interview fact**: stated in Q1–Q32.
- **Project design decision**: chosen by the team to address an interview-supported problem.
- **Technical choice**: an engineering decision.

Never present a design decision or technical choice as something the clinic said. In reports, prefer
"Interview supports…", "Project decision…", "Current implementation…", "Future candidate…",
"POLICY DECISION REQUIRED". Write "the clinic said" only for an actual interview statement.

## 3. Interview boundaries

The interview supports:

- 3 branches (2 Bocaue, 1 Guiguinto); 12 Dentists; 7 staff who are assistants and receptionists;
  at least 2 Dentists per clinic per day.
- Services: general dentistry, orthodontics, oral surgery, radiographic imaging.
- Prices: Cleaning ₱1,000–₱1,500; Extraction ₱10,000–₱15,000; Filling ₱800–₱2,000.
- Booking, billing and records are already digital; prescription is the paper exception.
- Pain points: long queues, long waits, scheduling conflicts, slow HMO responses, social-media messaging.
- Receptionist handles booking, check-in, billing and follow-up; Dentist with an assistant handles treatment.
- Booking needs patient information, chief complaint, available time and Dentist schedule.
- A Patient is assigned to a Dentist at the patient lounge.

The interview does NOT provide: X-ray fee or duration, other service fees or durations, reminder or
HMO follow-up timings, loyalty or referral economics, refund rules, online-payment policy or OTP policy.
Never present these as clinic facts.

Known unresolved interview questions: Q7 vs Q8 patient volumes conflict; the Q12 extraction range is
unexplained; whether the Dentist can be reassigned at arrival (Q15).

## 4. Modules, names and the process document

Use the process document's module names. The M-numbers and owners are:

| No. | Module | Owner |
|---|---|---|
| M1 | User, Role & Access Management | Licanda |
| M2 | Multi-Branch Clinic Management | Licanda |
| M3 | Dentist & Staff Management | Licanda |
| M4 | Patient Records Management | Ecal |
| M5 | Treatment & Clinical Workflow Management | Ecal |
| M6 | Core Appointment Booking & Schedule Management | Alejo |
| M7 | Smart Scheduling & Conflict Prevention | Alejo |
| M8 | Patient Check-In Management | Alejo |
| M9 | Smart Patient Queue Management | Alejo |
| M10 | Waiting-Time & Patient Flow Capacity Management | Alejo |
| M11 | Billing & Payment Management | Ecal |
| M12 | HMO Verification & Documentation Management | Delos Santos |
| M13 | HMO Request & Approval Management | Delos Santos |
| M14 | HMO Follow-Up & Escalation Automation | Delos Santos |
| M15 | Staff Workload & Cross-Branch Capacity Automation | Licanda |
| M16 | Social Media Inquiry Management | Millar |
| M17 | Unified Patient Messaging Management | Millar |
| M18 | Real-Time Patient Notification Management | Millar |
| M19 | Digital Prescription Management | Ecal |
| M20 | Treatment Follow-Up Scheduling Management | Ecal |
| M21 | Operational Reporting & Analytics Management | Delos Santos |
| M22 | Owner Executive Dashboard & Business Intelligence | Licanda |
| M23 | Integrated Workflow & Automation Control | Delos Santos |
| M24 | Referral & Loyalty Management | Millar |
| M25 | Marketing, Reactivation & Patient Engagement Management | Millar |

M24 and M25 are not client-requested ("Proposed Enhancement" in the process document) and are approved as
frontend enhancements in the repository. Both labels are true; never describe either as a client requirement.

The 31-module list in the original planning notes is historical. No M26+ without explicit approval.

**Sync rule.** When a change alters what a module does, its limitations or its future boundary, the final
report must list each affected module number and state what its process-document "Implementation Status"
line should now say. Do not edit the `.docx` unless the task says so.

## 5. Roles and staff titles

- Patient: own records only; schedules only a Dentist-requested follow-up; never creates treatment,
  authorizes a prescription, marks an invoice Paid or decides an HMO outcome.
- Staff: receptionists and dental assistants. Operational workflows follow each account's permissions.
  Do not give an assistant receptionist authority unless the permission model already does.
- Dentist: treatment, actual procedures, clinical notes, prescription authorization, follow-up decision.
- Owner: oversight, configuration, analytics and administrative controls.

A displayed title is not a permission. Changing a title must leave every account's effective permissions
identical. "HMO processing", "billing" and "patient engagement" are project-defined duty focuses, not
interview job titles.

## 6. Patient booking rules

- **No Patient Dentist choice.** A project design decision informed by Q15 and Q28. New bookings get the
  Dentist from `src/scheduling.js` (`assignDentist`, `findOpenTimes`). Reschedule keeps the appointment's
  existing Dentist. Follow-up keeps the follow-up's Dentist. Staff booking is separate.
- **Never duplicate scheduling logic in the UI.** Ranking is fewest booked minutes that day, then
  ascending Dentist ID. No `dentists[0]`, randomness, array order, queue position or capacity coefficients.
- **Smart Find is deterministic, not AI.** Never say AI, "smart AI" or "best Dentist". Never show workload
  scores to Patients.
- **BOOKING DRAFT != APPOINTMENT.** A draft reserves nothing, creates nothing operational, belongs to the
  session Patient, never stores a committed Dentist, revalidates on resume and has no invented expiry.
  An upstream change clears everything after it: mode → branch, service, date, time; branch → service,
  date, time; service → date, time; date → time.
- **Dates.** Never offer a past time. A draft date before clinic today is stale. After the Patient picks a
  date, show only that date's times.
- **Geolocation.** Show "Use my location" and call `navigator.geolocation` only when an Open branch has
  finite latitude and longitude. Never invent coordinates outside test fixtures.
- **Chief complaint** (Q28). Use the existing appointment notes field, labelled "Reason for visit / chief
  complaint (optional)". No new ERD field, not required.

## 7. Honest UI

Every visible statement must match real state. Never show fake availability, a fake nearest branch, fake
email delivery, fake OTP, fake payment success, fake HMO responses, fake reward value, fake loading or fake
due dates. A smaller honest interface beats a richer fake one.

- Home: active visit/queue → next appointment → booking CTA → compact quick actions → only blocking items.
  Ordinary notifications stay in Notifications. No "overdue", "past due", "late" or "deadline" without
  canonical due-date data.
- Visits is history and management, not booking. Show payment method only from real Payment evidence,
  never from a preference.
- Analytics: a period selector must filter what it claims to filter, using existing timestamps. If a
  metric cannot be period-filtered from real data, say so in the UI.
- The Patient assistant button may be hidden during a booking step rather than overlap bottom navigation,
  sticky booking controls or focused fields.

## 8. Seed data

Seed data must be defensible. Before changing a seed value, check whether the interview supports it.
Values the interview does not provide are demo values and must be documented as such, never presented as
clinic facts. If a schema needs a number no source provides, STOP and report the missing business decision.

Current decisions:

- Oral Prophylaxis corresponds to the interview's cleaning; Composite Restoration corresponds to filling.
  Their fees should stay inside the Q12 ranges.
- Tooth Extraction's fee is not reconciled with Q12 and must not change until the client clarifies.
- Do not add a Radiographic Imaging service until the clinic provides its fee and duration at the follow-up
  interview.

## 9. Referral and loyalty

- Approved direction: a first-time referred Patient receives 10% off their first eligible completed visit;
  the referrer is rewarded only after that visit is completed and paid; no self-referral.
- A typed code alone never applies a discount. Keep capture, eligibility, completed visit, eligible invoice,
  discount and referrer reward as separate steps.
- Do not invent stacking with HMO coverage or other discounts, eligible-service rules or code-reuse policy.
- M24's 50-point threshold is a prototype rule, not clinic policy. No cash withdrawal.

## 10. Extra stop conditions

In addition to `CLAUDE.md`'s stop conditions, STOP and report when:

- a business fact is needed that the interview does not provide,
- a title, label or seed change would alter permissions,
- a seed value would have to be invented as a clinic fact,
- a design decision would have to be described as an interview statement.
