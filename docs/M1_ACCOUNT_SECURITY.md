# M1 account security: one-time codes, password reset, email change

Priority 1 of the Phase 2 plan (decisions 6 and 7). Engineering security defaults; none of these values is clinic policy.

## Flows

| Flow | Endpoint(s) | Who | Notes |
| --- | --- | --- | --- |
| Patient registration | `POST /api/register`, `/api/register/verify`, `/api/register/resend` | public | Same 201 "check your email" answer for a new or an already-registered address. |
| Password reset | `POST /api/password/forgot`, `POST /api/password/reset` | any Active account (Patient, Staff, Dentist, Owner) | Same answer whether or not the email has an account. Invited employees use their invitation link; suspended/deleted accounts get no code. |
| Sign-in email change | `POST /api/account/email`, `POST /api/account/email/confirm` | signed in | Current password, then a code sent to the **new** address. An address already in use gets the same answer but no code. |

No new-device or sign-in OTP (decision 6).

## Code rules (`App\Services\Auth\OneTimeCodes`)

- 6 digits from `random_int`; only a bcrypt digest is stored (`email_verification_otps.digest`); checked with `Hash::check`.
- Valid 10 minutes; 5 wrong entries consume it; single use; a new code consumes every earlier unused code of the same purpose.
- 60-second wait between codes per account and purpose.
- Codes are scoped by `purpose`: a password-reset code cannot verify a registration or change an email, and the reverse.
- A completed reset also cancels a pending email-change code, signs out every session (`auth_version`) and verifies the email (the code proves the inbox).
- A completed email change updates `users.email` and `persons.email`, signs out every session, and notifies the **old** address showing only a masked form of the new one.

## Send caps (`App\Services\Auth\OtpThrottle`)

Counted **before** any account lookup, so the limit itself reveals nothing:

- 5 per email + IP per hour (`OTP_HOURLY_PER_EMAIL_IP`);
- 10 per email per 24 hours, any IP and any purpose, including the "someone tried to register" notice (`OTP_DAILY_PER_EMAIL`).

The route throttle `m1-otp` (30/min per IP) still applies to every endpoint above.

## Sending: once, after commit (`MailDispatcher::queueOnce` → `App\Jobs\SendOnceMail`)

- The `mail_dispatches` intent row is written in the same transaction as the code; the job is dispatched only after commit, so a rolled-back request sends nothing.
- The queued payload (address and code) is encrypted with `APP_KEY` (`ShouldBeEncrypted`) and deleted when handled.
- One try. The job never throws, so the payload is never copied to `failed_jobs`, and the M18 sweeper ignores non-retryable rows. The person asks for a new code instead.
- If a newer code replaced it before the worker ran, it is not sent (`superseded`); an expired code is not sent (`failed`, `code_expired`).
- Outcomes are truthful (`transport_accepted` / `logged_only` / `failed`). The API never says an email was delivered.
- In production, account email to a log-only mailer is refused with 503 before anything is written.
- **A queue worker must be running** for codes to arrive: `php artisan queue:work --queue=mail,default`.

## Anti-enumeration

- Registration: an existing address gets the same status, body shape and similar timing (the same bcrypt work runs). Nothing is created and the submitted password is discarded. The owner receives either "someone tried to register with your email: sign in or reset your password" (usable account) or "this email is already on file: contact the clinic" (a walk-in record, or an inactive/deleted account).
- Password reset request: one message for every address.
- Email change: one message whether or not the new address is free.
- **Known remaining signal:** registration still refuses a matching phone number (or name plus date of birth) with a 422 ("an existing patient record may already match"). This is the pre-existing duplicate-patient safeguard. Removing it is a clinic-policy decision about duplicate records (open item).

## Audit (M22, no address or code in any payload)

`account.registration_attempt_existing`, `auth.password_reset_requested`, `auth.password_reset_completed`, `account.email_change_requested`, `account.email_change_unavailable`, `account.email_change_password_failed`, `account.email_changed`, plus `mail.dispatched` for every send outcome.

## Emails

One base layout (`resources/views/emails/layout.blade.php`, 600px tables, inline styles, a plain-text twin `layout-text.blade.php`), shared partials (`heading`, `code`, `button`, `callout`), and templates `one-time-code`, `security-notice`, `employee-invitation`. The clinic name comes from `MAIL_FROM_NAME`. A support address is shown only if `CLINIC_SUPPORT_EMAIL` is set. The old footer's branch list was not clinic data and was removed. Appointment and receipt emails still use the older classes, kept working by the layout. They are redesigned in Priority 3.

Dev-only preview: `http://localhost:8000/dev/mail` (registered only when `APP_ENV=local`; sample data, nothing sent).
