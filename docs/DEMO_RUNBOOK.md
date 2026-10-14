# Demo runbook

Everything runs on the **separate demo database `dental_clinic_demo`**; the clinic database `dental_clinic` is never used. PayMongo is in **test mode** only.

## Start the whole demo (one command)

```
NGROK_DOMAIN=your-name.ngrok-free.dev scripts/demo-start.sh
```

It starts the API (:8000), the patient portal (:5173), the queue worker (emails), the scheduler (email retries), Reverb (live messages) and the ngrok tunnel. Logs from all of them appear in one window, each line prefixed with its name; **Ctrl+C stops everything**. Without `NGROK_DOMAIN` it starts everything except the tunnel (online payment then cannot confirm).

- First run: creates the demo database, then seeds it: demo accounts, branding settings and the demo clinic (`DemoClinicSeeder`).
- Later runs: apply new migrations to the demo database only.
- It refuses to start if ports 8000, 5173 or the Reverb port are already in use. Close the separate terminals from `docs/PAYMENT_LIVE_TEST.md` first.

## Pre-defense check

In a second terminal, while the demo runs:

```
NGROK_DOMAIN=your-name.ngrok-free.dev scripts/predefense-check.sh
```

It prints PASS / WARN / FAIL for:

- each process;
- the SMTP login;
- the PayMongo test keys;
- the tunnel;
- **whether the webhook registered at PayMongo matches the current tunnel address**;
- the demo data, including an unpaid invoice ready to pay;
- the queue.

Every failure comes with what to do by hand, and the command exits with code 1 if anything fails. Add `--send=you@example.com` to also send one real diagnostic email.

If the webhook check fails, fix it by hand:

1. Open dashboard.paymongo.com and switch on **Test mode**.
2. Go to **Developers → Webhooks**, and edit the endpoint (or add one) with URL `https://<your tunnel>/api/webhooks/paymongo` and event `checkout_session.payment.paid`.
3. If PayMongo shows a new signing secret, put it in `backend/.env` as `PAYMONGO_WEBHOOK_SECRET` and restart the demo.

## Demo accounts (password `DemoPass123`, or `DEMO_ACCOUNT_PASSWORD`)

| Role | Sign in |
| --- | --- |
| Patient (Bea Villanueva) | `patient@example.test`, or the address set with `scripts/payment-test.sh patient-email` |
| Staff (front desk, Branch A) | `staff.reception@example.test` |
| Dentist (Dr. Rafael Santiago) | `dentist@example.test` |
| Owner | `owner@example.test` (Clinic Branding is under Administration) |

## What the demo clinic contains (`DemoClinicSeeder`, demo database only)

- Four fictional patients (`@example.test`; nobody is emailed) and the demo Patient.
- Upcoming appointments booked through the real scheduling rules.
- Two paid invoices: an extraction paid in cash, and a cleaning with a filling paid by e-wallet.
- **One unpaid invoice ready to pay online** for the demo Patient.
- One conversation the demo Patient started with the front desk, with the clinic's reply.

**Demo prices** come from interview Q12, at the lower end of each range. They are not the clinic's price list, and no other price is invented:

| Service | Demo price |
| --- | --- |
| Cleaning (Oral Prophylaxis) | ₱1,000 |
| Filling (Composite Restoration) | ₱800 |
| Extraction | ₱10,000 |

The seeder refuses to run in production and runs once per database:

```
cd backend && DB_DATABASE=dental_clinic_demo php artisan db:seed --class=DemoClinicSeeder
```

More unpaid invoices: `scripts/payment-test.sh invoice <demo patient email>`.
