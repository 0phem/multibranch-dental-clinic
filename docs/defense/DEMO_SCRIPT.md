# Demo script: a day at the clinic (12–15 minutes)

Story: a new patient registers, books, asks the assistant, chats with the front desk; then Bea (a returning patient) pays her
invoice online and gets her receipt; the Owner changes the brand colour and an assistant answer live.
Every step has a **FALLBACK**. Times are targets; the total is about 18 minutes with the round-2 steps 3c–3e (cut 3e first if short of time).

## Accounts (demo database only; password `DemoPass123` unless noted)

| Who | Sign in | Window |
| --- | --- | --- |
| New patient (registered live) | a new Gmail alias, e.g. `jaztinalcantara17+panel1@gmail.com`, password `NewPatient#2026` | Window A, phone size (390 px) |
| Bea Villanueva (returning patient, unpaid invoice) | `jaztinalcantara17+demo@gmail.com` | Window A after step 6 |
| Front desk (Staff) | `staff.reception@example.test` | Window B, desktop |
| Owner | `owner@example.test` | Window B after step 7 |

Gmail (the `jaztinalcantara17` inbox) is open in Window C.

## Start, check, reset

```bash
NGROK_DOMAIN=unclear-jase-enviously.ngrok-free.dev scripts/demo-start.sh          # API (4 workers), worker, scheduler, Reverb, tunnel, web
NGROK_DOMAIN=unclear-jase-enviously.ngrok-free.dev scripts/predefense-check.sh    # every line PASS (WARN for drafts is fine)
DEMO_PATIENT_EMAIL=jaztinalcantara17+demo@gmail.com scripts/demo-reset.sh          # fresh demo clinic (asks you to type RESET)
scripts/payment-test.sh demo-db jaztinalcantara17+demo@gmail.com                   # one more unpaid invoice for Bea (invoice email)
```

## Pre-demo checklist (one page, 30 minutes before)

- [ ] Laptop on power; Do Not Disturb on; notifications off; browser zoom 100%.
- [ ] Internet works; phone hotspot ready as backup.
- [ ] Postgres.app running; `demo-start.sh` running with the tunnel; `predefense-check.sh` all PASS (assistant drafts WARN is fine).
- [ ] Demo reset done today; then one unpaid invoice issued for Bea (invoice email arrived in Gmail).
- [ ] Gmail open in Window C, logged in, inbox sorted newest first; the aliases arrive in the same inbox.
- [ ] Window A at 390 px on the landing page (`http://localhost:5173/`); Window B signed in as `staff.reception@example.test` on Messages.
- [ ] PayMongo dashboard in **test mode**; the webhook points to `https://unclear-jase-enviously.ngrok-free.dev/api/webhooks/paymongo`.
- [ ] Backup tab: `http://localhost:8000/dev/mail` (email previews and PDFs).
- [ ] Backup: the screen recording of the full demo on the desktop (made the day before).
- [ ] Backup: `docs/ui-review/patient/` screenshots open in a folder.
- [ ] A paid invoice exists for Bea (the reset seeds two paid ones), for the receipt fallback.

## The script

| # | Time | Do (exact clicks) | Say | FALLBACK |
| --- | --- | --- | --- | --- |
| 1 | 0:00–1:30 | Window A (phone size) on the **landing page**: scroll the hero, **How it works**, **Services** (real services, no prices), **Branches** (real addresses and phones, today's hours and "Open now / Closed" in Philippine time, Get directions), the FAQ and the emergency note. | "Dr. Roxas told us: long queues and waiting (Q19, Q21), scheduling conflicts (Q20), and she answers Messenger herself (PI-43). This is the clinic's own website: every branch, hour and service comes from the clinic's records." | API slow: the sections show loading cards, then a friendly message with the clinic phone; continue with **Create account**. |
| 2 | 1:30–3:00 | Window A: hero **Book a visit** → the Create account card: fill name, birth date, the new alias, phone (e.g. 917 123 4567), password (watch the strength meter), tick the Privacy/Terms box → **Create account**. Window C: open the code email. Window A: type the code → **Verify email**. The sign-in page opens with the email filled in and the message "Your account is verified. Please sign in." → type the password → **Sign in**. | "Sign-up is verified with a one-time code by email. After verifying, the patient signs in themselves." Point at the welcome card: "No appointments yet. Book your first visit." | Gmail slow: open `localhost:8000/dev/mail` → *One-time code* to show the email design, and use an alias registered earlier (already verified). |
| 3 | 2:30–4:30 | **Book your first visit** → service **Oral Prophylaxis** → browser asks for location → **Allow** → the recommended branch "Closest to you, earliest slot…" → tap it → **Any available dentist** → calendar: point at Sunday greyed out → tap the first available day → tap a time chip → Review → **Confirm appointment** → **Add to calendar**. Window C: the confirmation email. | "Only real open times are shown, so double booking is impossible — the database itself refuses overlaps. Nothing is paid at booking." | Location blocked: say "without location it ranks by the earliest slot" and continue. Email slow: `/dev/mail` → *Appointment confirmation*. |
| 3b | +60 s | **Reminder arrives.** Note the new appointment code (APT-…) on the confirmation. Window B (or a prepared terminal in `backend/`): Owner → **Administration → Automations** → **Demo clock** → type the code → **Run now** (terminal: `DB_DATABASE=dental_clinic_demo php artisan automations:demo --appointment=APT-…`). The card shows "simulated … · sent 1". Window C: the **Reminder** email arrives within seconds: date and time in Philippine time, branch, address, phone, that day's hours, **Reschedule or cancel**, calendar file. Tap the button: it opens **My visits** on that appointment. | "PI-31: the front desk reminds every patient today. The system now sends the reminder by itself, 24 hours before by default; the Owner can change that. If the visit is moved, the reminder is recalculated; if it is cancelled, none is sent; it is never sent twice." | Gmail slow: open `localhost:8000/dev/mail/appointment-reminder`. Demo clock refused: you are not on the demo database. |
| 3c | +90 s | **Approve the wording first.** Window B as Owner → **Administration → Automations → Message wording** → open **Appointment reminder** (the preview shows the email) → **Approve this wording**; do the same for "Are you on your way?", "Released: rebook invitation" and "An earlier time is available"; switch on **Appointment reminders**, **Late arrivals and no-shows** and **Fill freed times**. | "The clinic told us the Owner approves the wording (R2-09). Nothing is sent until she does, and each default says whether the clinic gave it or we recommend it." | If a switch stays disabled, the card says which wording still needs approval. |
| 3d | +120 s | **15-minute release, then a move-up offer.** Before the demo the front desk booked two of today's appointments with the same dentist: Patient X (earlier) and Bea (later, her real inbox). Owner → **Demo clock** → "Today's appointment code" = X → **Run now**. Window B as Staff → **Check-In**: "Released today" shows X with **Undo**, "Free times today" shows the time as offered. Window C: Bea's email "An earlier time is available" → **Take the earlier time** → confirm. Bea's **My visits** shows the earlier time. | "After 15 minutes without check-in the time is released (R2-10) and offered first to a patient booked later that day. The first to accept gets it; nobody is moved without saying yes." | Show `InterviewRoundTwoTest` (the race test) and `docs/ui-review/r2/` screenshots. |
| 3e | +45 s | **Staff calendar.** Staff → **Appointment Calendar** → **Week** then **Month**: each day shows "% booked" with a colour band and a legend, crowded days are marked, closed days are grey with the reason; chips show the patient's initials, service and dentist. | "The clinic liked seeing crowded days in advance (R2-02). Load is booked minutes against the dentists' hours, shown as a number, never colour alone." | Screenshot `docs/ui-review/r2/staff-calendar-month-desktop.png`. |
| 4 | 4:30–5:30 | Tap **Ask us** → type "Bukas ba kayo sa Linggo?" → then "When is my next appointment?" | "The assistant answers in English and Filipino from the clinic's own approved answers and records. It never invents: unknown questions go to the front desk." | Assistant error: show `docs/ui-review/patient/assistant/new-02-answers-phone.png`. |
| 5 | 5:30–7:00 | Window A: **Messages** → **New message** → shows "To: Dr. Dana Roxas Dental Clinic front desk · Change" → type "Good day, may I bring my child too?" → **Send**. Window B (Staff): the conversation appears → reply "Yes, please book a Pediatric Consultation for your child." Window A: the reply appears live; the bell shows 1. | "The message goes to the right branch automatically. If the patient is away, they get a short email alert — never the message text." | Realtime down (Reverb): reload Window A; the reply is there. |
| 6 | 7:00–10:30 | Window A: profile menu (**More** → Sign out) → sign in as Bea. Window C: open her **invoice email** (from the checklist). Window A: **Billing** → **Review and pay** → **Pay ₱1,800 securely with PayMongo** → on PayMongo: **E-Wallets** → **GCash** → **Continue** → (name and email are filled in) **Pay ₱ 1,800.00** → test page: **Authorize Test Payment** → back in the portal after about 25 s: "Confirming your payment" → "Payment received" (about 30 s). Note: in test mode the PayMongo page shows the developers' account name (OPEN_ITEMS 13). Window C: the **Payment Receipt** email with the PDF. Window A: **Receipt PDF**. | "The invoice is made from the treatment. PayMongo calls our server; only that verified call marks it paid and issues the receipt. Nobody types the payment." | Tunnel/webhook down: Bea's **paid** invoice → **Receipt PDF**, and `/dev/mail` → *Payment receipt*. PayMongo down: Window B (Staff) → Billing → record a **Cash** payment → the receipt appears. |
| 7 | 10:30–12:30 | Window B: sign out → sign in as **Owner** → **Clinic Branding** → change the **Primary** colour → **Save branding**. Window A (Bea): **Billing** → **Invoice PDF**: the PDF uses the new colour (the brand colours style the emails and PDFs; the portal keeps its accessible design A colours). Owner → **Assistant Answers** → open "Do you accept HMO?" → **Edit** → adjust the wording → **Save** → **Confirm**. Test box: type "Tumatanggap ba kayo ng HMO?" → shows the new answer and its confidence. | "The Owner controls the brand on every email and PDF, and every answer the assistant gives; each change is in the audit trail." | Save fails: show `docs/ui-review/patient/assistant/owner-assistant-answers-desktop.png`. |
| 8 | 12:30–14:00 | Owner → **Audit Trail** (latest entries) → Status slide. | "This is what is built, what is partly built and what is not started; and the decisions we need from the clinic." | — |

## After the demo

- `scripts/demo-reset.sh` to start fresh (the panel's test accounts are removed).
- Do not show `backend/.env` or the PayMongo dashboard keys.

## If everything fails

Play the screen recording made the day before (Window D), and narrate the same steps. Then open `docs/defense/AUTOMATION_EVIDENCE.md`.
