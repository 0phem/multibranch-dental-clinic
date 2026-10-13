# M18 email dispatch — how it works and how to run the worker

Added 2026-10-13. Code: `backend/app/Services/Mail/MailOutbox.php`, `MailDispatcher.php`, `app/Jobs/SendMailDispatch.php`, migration `2026_10_18_000100_create_mail_dispatch_tables` (not applied to the clinic database — see `docs/CLINIC_DB_PENDING_MIGRATIONS.md`).

## Two kinds of email

| Kind | Purposes | How it is sent |
| --- | --- | --- |
| **Queued, retryable** | `appointment_confirmation`, `appointment_rescheduled`, `appointment_cancelled`, `payment_receipt` | An intent row is written **inside the same database transaction** as the booking/change/payment (rolled back together; unique per appointment revision or receipt). After commit a `SendMailDispatch` job is queued on the `mail` queue. The worker claims the row atomically, re-renders the email from the current record, resolves the current address from it, sends once, and records the attempt. |
| **Immediate, single attempt** | `patient_email_verification`, `employee_invitation`, `mail_diagnostic` | They carry a one-time secret (code or link) that must not be stored, so they are sent during the request and never retried. The intent and attempt are still recorded (without the address, link or code). The person asks again (resend) instead. |

## Outcomes (never mixed)

- `logged_only` — the mailer is `log`/`array`: recorded locally, **nothing was sent**.
- `transport_accepted` — a real transport (SMTP, SES, Postmark, Resend…) accepted it. **Inbox delivery is not confirmed.**
- `failed` — the transport raised an error (only the exception class is stored), or retries were exhausted (`failure_reason = retries_exhausted`), or no address exists (`no_recipient`), or a single-attempt message failed (`not_retryable`).
- `retry_scheduled` — a retryable message failed and will be tried again at `next_attempt_at`.
- `superseded` — a newer change to the same appointment has its own message, so this older one is not sent.
- `delivery_confirmed_at` is reserved for provider delivery evidence and is **never set** today; the database refuses it unless the message was transport-accepted.

## Retry policy (engineering defaults, `backend/config/clinic.php`)

- At most `MAIL_MAX_ATTEMPTS` (default 4) attempts, waiting 60 s, 5 min, then 15 min.
- A claim older than `MAIL_PROCESSING_TIMEOUT_SECONDS` (default 600) is treated as a crashed worker and retaken. Delivery is therefore **at-least-once**: a crash after the transport accepted a message but before the outcome was saved can send it twice.
- Duplicate jobs, two workers or a replayed request cannot send twice: every send needs an atomic claim, and the intent key is unique.
- A mail failure never fails or undoes the appointment change or payment.

## Running it

```bash
cd backend
php artisan queue:work --queue=mail,default      # processes queued emails as they are committed
php artisan schedule:work                         # runs `mail:process-due` every minute (or cron: * * * * * php artisan schedule:run)
php artisan mail:process-due                      # one manual pass: due first tries, due retries, stale claims
```

`QUEUE_CONNECTION=database` (the `.env` default) stores jobs in the `jobs` table. With no worker running, intents stay `pending` (safe: nothing is lost; `mail:process-due` or a worker sends them later). Tests run with `QUEUE_CONNECTION=sync`, so a job runs right after the commit.

**Isolated environment warning.** `php artisan serve` does not pass `DB_DATABASE` (or other `.env` overrides) to its server process. To run the API against another database use PHP's built-in server with the variables set, as in `scripts/m1-m18-isolated-integration.mjs`.

## Verified so far

- Automated (`dental_clinic_test`): `tests/Feature/Mail/MailOutboxTest.php` — intent minimality, a real `queue:work` run on the database queue, post-commit only, rolled-back/refused changes leave no intent, transient failure then success after the backoff, retries exhausted at the limit, duplicate intents and jobs, stale-claim recovery, superseded messages, append-only attempts and the delivery constraint, single-attempt secret mail never retried.
- Isolated integration (`dental_clinic_isolated`, freshly migrated and seeded, real API and browser): a real booking left a `pending` intent and a queued job; `queue:work` sent it (`logged_only`, one attempt); `mail:process-due` did not resend it.
- **Not verified**: real inbox delivery (no real transport is configured), provider delivery receipts, and anything on the clinic database.
