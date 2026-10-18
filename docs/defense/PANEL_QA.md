# Panel Q&A: likely questions and honest answers

Short answers to say out loud, each with where the evidence is. "Q" and "PI" numbers are the clinic interview
(`docs/defense/INTERVIEW_EVIDENCE.md`). Test files are under `backend/tests/Feature/` unless they start with `tests/`.

## A. Business process automation

**1. What business process does the system automate?**
The patient's path from booking to receipt: online booking without conflicts, confirmation emails, front-desk messaging,
invoices generated from the treatment, online payment settled automatically from PayMongo, and the Payment Receipt emailed with
a PDF. Evidence: `docs/defense/AUTOMATION_EVIDENCE.md`.

**2. Which manual steps disappear for the receptionist?**
Typing bookings and checking conflicts (Q20 says scheduling conflicts are the most frequent error), recording online payments
and preparing receipts (Q27: booking, billing and follow-up are done by the receptionist), and answering routine questions
(PI-43: the Owner answers Messenger herself).

**3. How do you prevent double booking?**
Every booking passes the same server checks (branch open that day, Dentist eligible and free, patient not double-booked), with a
database-level guard against two people taking the same time at once. `Appointments/ConcurrentBookingTest`, `AppointmentBookingTest`.

**4. Does it shorten the queue and waiting time (Q19, Q21, Q32)?**
Indirectly: patients arrive with a fixed booked time, and the queue module numbers arrivals. We have not measured waiting
times at the clinic, so we do not claim a percentage.

**5. What happens when the patient pays online?**
PayMongo sends a signed webhook; the server verifies it, marks the invoice paid, creates the receipt and emails the PDF. The
return page alone never marks anything paid. `Payment/PayMongoPaymentTest`.

**6. Is the chatbot AI?**
It is an automated assistant that answers from the clinic's own approved information and records (knowledge mode). Nothing a
patient types leaves the clinic's system. An optional AI mode exists for a clinic that supplies its own Anthropic key and
approves the data processing. `Assistant/AssistantKnowledgeTest`, `docs/ASSISTANT_PRIVACY.md`.

**7. What if the assistant doesn't know the answer?**
It says so and offers the front desk; it never makes up facts, prices or policies. Tested with unknown questions
(parking, walk-ins).

**8. Can the assistant book or pay for the patient?**
No. It only shows buttons (open booking, open billing, message the front desk). It refuses medical advice and sends emergencies
to the clinic phone.

## B. Security and privacy (RA 10173)

**9. How are patients' records protected?**
Role-based access (Patient, Staff, Dentist, Owner) checked on the server for every request; Staff see only their branches; a
patient sees only their own data (tested: another patient's invoice answers "not found"). `RbacTest`,
`Billing/BillingDocumentDownloadTest`, `Reference/ReferenceDataAuthorizationTest`.

**10. How do you verify identity?**
Email verification with a 6-digit code (10 minutes, limited attempts), password reset by code, current password required to
change the email, and a security notice to the old address. `Auth/*`, `docs/M1_ACCOUNT_SECURITY.md`.

**11. Are messages protected?**
Only the conversation's participants can read them (the Owner cannot read patient conversations). Email alerts contain no message
text. Real-time channels are authorized per conversation. `Messaging/*`, `docs/M17_PRODUCTION_HARDENING.md`.

**12. Is there an audit trail?**
Yes, append-only: sign-ins, record changes (field names only, not values), money events and assistant-answer edits. The Owner
can search and export it. `Audit/*`.

**13. What about RA 10173 compliance?**
We followed its principles (least data, access control, audit, no message text in emails, location never stored). Formal
compliance needs the clinic's privacy notice, DPO review and retention decisions: listed in `docs/defense/OPEN_ITEMS.md` (item 8).

**14. Do you store card numbers?**
No. Card and e-wallet details are entered on PayMongo's hosted page; the clinic server never sees them.

## C. Payments

**15. Which payment methods work?**
Whatever the clinic's PayMongo account enables (in our test account: GCash, card and others). The list comes from PayMongo at
run time. Test mode only in this project.

**16. What if PayMongo is down?**
The patient pays at the clinic as today; the invoice stays "Payment due" and Staff record the payment. A late webhook is still
accepted and settles once.

**17. Partial payments and refunds?**
Not online. Online payment is for the full balance; partial payments and refunds stay at the front desk (OPEN_ITEMS 11).

## D. Technology and scalability

**18. Why Laravel and React?**
Laravel gives server-side validation, database transactions, queues, mail and authentication out of the box; React with Vite
gives a fast, phone-friendly portal. Both are widely taught and hosted cheaply. PostgreSQL enforces the money rules (receipts
cannot be edited) at the database level.

**19. Can it handle three branches and more?**
Branches are data, not code: the Owner adds or renames a branch and it appears in booking, the website, emails and the
assistant. The clinic sees 10–20 patients a day (Q7); the design is not near any limit at that volume. We have not run a
formal load test.

**20. What if Gmail is down or hits its daily limit?**
Emails wait in the outbox and are retried automatically (up to 4 attempts over about 20 minutes); in-app notifications still
work. Gmail limits daily sending for personal accounts; for production we would move to a transactional email provider using
the clinic's own domain. `docs/M18_EMAIL_DISPATCH.md`.

**21. How is it deployed?**
One installation per clinic (white-label: name, colours, logo and contact set by the Owner), on a small cloud server with
PostgreSQL, a queue worker and the scheduler, with the clinic's own PayMongo account and email domain.
`docs/WHITE_LABEL_CHECKLIST.md`.

**22. How does it compare with the clinic's current software (about ₱1,400 a month, Q14)?**
The clinic likes its current software because it is centralized (Q18). Ours adds what the interview asked for: online booking
without conflicts, online payment with automatic receipts, front-desk messaging and an assistant for routine questions (Q23).
We do not claim it replaces their records software today.

**23. What would it cost the clinic?**
See `docs/defense/PITCH.md`: a pricing **proposal**, not a quote. Running costs are hosting, email and PayMongo's per-transaction
fees, which the clinic pays to PayMongo directly.

**24. Who supports it?**
Q31: the clinic has reliable internet; the person for day-to-day troubleshooting was not named. We propose a support contract
with a named contact and the pre-defense style health check (`scripts/predefense-check.sh`).

## E. Hard questions

**25. Which modules are not finished?**
Not started: M3 Work Schedules, M10 Dental Charts, M12 Treatment Plans, M15 Leave Management, M24 Lab Cases, M25 Patient
Handovers. Mock only (browser-local): M19 Prescriptions, M20 Patient Follow-Up. Partly built: M1, M2, M4, M8, M9, M13, M14,
M16, M21. Full table: `AUTOMATION_EVIDENCE.md`.

**26. Why did you remove modules from the patient portal?**
HMO, Prescriptions, Referral & Loyalty, Follow-Up Care and Live Queue were removed from the patient portal because they had no
real server data behind them; we show only what is real. HMO is out of the new scope (`MODULE_COVERAGE.md`).

**27. Is there a known bug?**
Yes: some timestamps written by the framework are stored 8 hours early because the app and the database disagree on the time
zone. Screens that use the clinic clock are correct; we fixed the new tables. The plan to fix the rest safely is in
`docs/TIMEZONE_PLAN.md` (after the defense, with a backup and rollback).

**28. Are the invoices BIR-compliant?**
Not confirmed. Optional BIR fields per branch exist and print on the PDFs, but the clinic's accountant must confirm the
requirements (OPEN_ITEMS 10).

**29. There's only one Owner account. Isn't that a risk?**
Yes; additional administrator accounts are an open decision (OPEN_ITEMS 12). Employee accounts are created by invitation.

**30. Are the branch details real?**
Yes: names, addresses, phones, emails and hours were given by the clinic (Monday to Friday 8:00 AM to 8:00 PM, Saturday
8:00 AM to 5:00 PM, Sunday closed). Two things are still open: branches 1 and 2 have the same phone number (to be confirmed),
and branch 3 has no email and an incomplete address (OPEN_ITEMS 1–2). Online times also depend on the dentists' schedules,
which are still project values (OPEN_ITEMS 3).

**31. Are the prices real?**
The demo prices are the lower end of the ranges in Q12 and are labelled as demo prices. Patients never see prices online; the
clinic confirms them.

**32. Does the clinic actually send reminders through the system?**
Not yet. PI-31 says they remind patients for every appointment; the system sends confirmation and change emails but no
scheduled reminder (OPEN_ITEMS 14).

**33. Are the hours hard-coded anywhere?**
No. Each branch stores its hours per weekday; booking, the calendar, the website, emails and the assistant all read them, so
the Owner's change in Administration → Branches applies everywhere at once (`backend/tests/Feature/Appointments/BranchHoursTest.php`).

**34. What did you test?**
The full backend suite (PHPUnit, PostgreSQL), the frontend unit tests, a render smoke test of every screen, a production
build, and browser walk-throughs on phone and desktop with screenshots (`docs/ui-review/`).

## F. The process change (see PROCESS_DOCUMENTATION.pdf)

**35. Why this flow?**
It follows what the clinic told us: the receptionist books, checks in, bills and follows up (Q27), conflicts are the most
frequent error (Q20) and the Owner answers Messenger herself (PI-43). So the system moves booking to the patient with only real
open times, routes messages to the branch front desk, and makes billing follow the treatment. Each AS-IS step in the document
cites the interview; steps we could not confirm are marked "to confirm" (SECOND_INTERVIEW_QUESTIONS.md).

**36. What was removed from the old process?**
Typing bookings and checking for conflicts by hand (the server and the database refuse overlaps), typing online payments
(PayMongo's verified webhook settles them), preparing receipts (emailed PDF), and the Owner answering routine questions (the
Clinic Assistant answers from the clinic's own answers). Reminders are not automated yet (PI-31).

**37. What if the internet is down?**
The portal needs the internet. The front desk keeps working the same way as before (phone, counter payment) and records it
later in the system; emails wait in the outbox and are retried automatically (up to 4 attempts) when the connection returns.
Q31: the clinic says its internet is reliable.

**38. Who can see what?**
Patients see only their own records; Staff see their branches; the Dentist sees the patients they treat; the Owner oversees
the clinic but cannot read patient conversations. Every change is in the append-only audit trail (MODULES_FINAL.md, M1, M17, M22).

**39. How is the data protected?**
Server-side role checks on every request, email codes for sign-in, passwords stored as hashes, card details only on PayMongo,
append-only financial and audit records, soft delete or retraction instead of hard delete, and knowledge mode for the assistant
(nothing typed leaves the system). Retention periods and the DPO review are still open (OPEN_ITEMS 8, 16).

## G. Automations (Administration → Automations)

**40. What if a reminder email fails?**
Every email is written to the outbox first and sent by the worker; a failure is retried automatically (up to 4 attempts, with
a growing wait) and recorded. The Owner sees sent, skipped and failed counts for the last 7 days on each automation card, and
the pre-defense check fails if an email is stuck. A patient without a verified email is skipped, not guessed.

**41. What if it sends twice?**
It cannot by design: each action has one key per appointment, invoice or visit and type (for example "reminder for appointment
X at revision 2"). The key is unique in the database for both the automation log and the email outbox, so a retry, a second
scheduler or a crash-restart finds the key already used. Just before sending, the outbox re-checks the record: a cancelled,
moved or paid record is not emailed. Tested in `Automations/AutomationsTest`.

**42. Who can turn it off?**
Only the Owner, per automation, in Administration → Automations; every switch and setting change is in the audit trail with
who, the old and the new value. Recall ships off. The values are defaults the clinic has not confirmed yet.

**43. Is any message sent without human approval?**
Reminders, overdue-invoice reminders, waitlist openings and the Owner summary are sent automatically once the Owner leaves them
on: they only repeat facts already in the records (a time, a balance, a count), never clinical content or prices in reminders.
Nothing that decides about a patient is automatic: a possible no-show is only flagged, and the front desk confirms or undoes it;
the "We missed you" email is off by default and goes only after that human confirmation.

