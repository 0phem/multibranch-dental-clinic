# PayMongo test-mode live check (TD-07)

The first real checkout runs in **test mode** against a **separate demo database**, `dental_clinic_demo`. Demo prices, visits and invoices never enter `dental_clinic`. No key or secret is ever printed by the helper `scripts/payment-test.sh`.

## One-time setup (by hand)

1. **PayMongo, test mode.** Log in at dashboard.paymongo.com and switch the Test mode toggle on. Under Settings → Developers → API keys, copy the test keys. Paste them yourself into `backend/.env`:
   ```
   PAYMONGO_PUBLIC_KEY=pk_test_…
   PAYMONGO_SECRET_KEY=sk_test_…
   PAYMONGO_MODE=test
   PAYMONGO_BASE_URL=https://api.paymongo.com
   PAYMONGO_PAYMENT_METHOD_TYPES=card,gcash,paymaya,qrph
   ```
   Keep only the methods your test account allows. `card` is the minimum for the demo.
2. **ngrok, with a free static domain** (the webhook URL stays the same between restarts):
   1. Create an account at https://dashboard.ngrok.com/signup.
   2. In the dashboard, open **Domains** and claim or copy your free static domain (it looks like `something.ngrok-free.app`).
   3. Install ngrok: `brew install ngrok`.
   4. Copy the token from **Your Authtoken** and run `ngrok config add-authtoken <token>`.

   Fallback: `brew install cloudflared`. The script uses it automatically when ngrok is missing, but its URL changes on every start, so the webhook would need updating each time.
3. **Demo database and inbox:**
   ```
   scripts/payment-test.sh demo-db                                   # creates dental_clinic_demo + one unpaid PHP 1,800 invoice
   scripts/payment-test.sh patient-email jaztinalcantara17+demo@gmail.com   # demo Patient gets your real inbox (demo DB only)
   ```

## Each test session

| Terminal | Command |
| --- | --- |
| 1 | Stop the normal `php artisan serve` (Ctrl+C), then `scripts/payment-test.sh api` (API on :8000 using `dental_clinic_demo`) |
| 2 | `scripts/payment-test.sh worker` (sends the receipt email) |
| 3 | `NGROK_DOMAIN=<your-domain>.ngrok-free.app scripts/payment-test.sh tunnel` |
| 4 | `npm run dev` (frontend on :5173, unchanged) |

4. **Webhook (first time only).** In PayMongo, go to Developer Tools → Webhooks → Add Endpoint:
   - URL: `https://<your-domain>.ngrok-free.app/api/webhooks/paymongo`
   - Event: `checkout_session.payment.paid` only.

   Save, then copy the endpoint secret into `backend/.env` as `PAYMONGO_WEBHOOK_SECRET=…`.
5. **Check from outside:**
   ```
   NGROK_DOMAIN=<your-domain>.ngrok-free.app scripts/payment-test.sh check
   ```
   Expect every key `present`, mode `test`, prefixes `sk_test_` and `pk_test_`, `/up -> 200`, and the webhook to answer **HTTP 400 "Invalid or missing webhook signature."** (it reaches our code and refuses unsigned calls). HTTP 503 means a `PAYMONGO_*` value is missing or the mode and key disagree.

   Optionally use **Send test event** in the dashboard: a real signed request that our endpoint accepts and records.
6. Tell Claude the setup is ready. The first checkout is then run with no code changes, as follows:
   1. Sign in as the demo Patient with the demo password (`DemoPass123` unless `DEMO_ACCOUNT_PASSWORD` is set).
   2. Go to Menu → Receipts & Payments, choose **Pay Online** on the demo invoice, and pay with test card `4343 4343 4343 4345` (any future expiry, any 3-digit CVC, no 3-D Secure).
   3. Compare each stage with what the code expects: session creation, webhook delivery, signature check, session read-back, settlement and receipt email.

More unpaid invoices for repeat tests: `scripts/payment-test.sh invoice jaztinalcantara17+demo@gmail.com` (the demo Patient's current address; omit it if you never ran `patient-email`). When finished, stop terminals 1–3 and restart the normal `php artisan serve` (back to `dental_clinic`).

## Results (test mode, `dental_clinic_demo`)

| Date | Invoice | Method | Path | Outcome |
| --- | --- | --- | --- | --- |
| Oct 14, 2026 02:28 | INV-2026-000001 | Card 4343… | one combined line (before itemization) | Settled; receipt RCT-2026-000001 emailed |
| Oct 14, 2026 13:27 | INV-2026-000003 | GCash (test) | **itemized** (2 lines), billing address sent from Review and Pay | Settled on PayMongo's retry; receipt RCT-2026-000002 emailed; `send_email_receipt` false |

Observed provider behaviour:

* `GET /v1/checkout_sessions/{id}` reads a session created with `POST /v2/checkout_sessions`.
* The session `status` stays `active` after payment. `payment_method_used` was `null` in the card webhook body but filled on read-back. For GCash it was `gcash` in both. The payment's `source.type` was always present (`card`, `gcash`).
* **Webhook retries are re-signed.** With the API in maintenance mode, the first delivery of `evt_ScCCpFrVyb3yYTba3Ftbr578` got 503. PayMongo retried 31 seconds later with a fresh `t` (`1791955641`, then `1791955672`), and the retry settled the invoice.

**Decision (mismatch 3):** because retries carry a fresh timestamp, the webhook now refuses a signed delivery whose `t` is more than 5 minutes from the server clock (`PAYMONGO_WEBHOOK_TOLERANCE_SECONDS`, default 300). Event-id de-duplication and idempotent settlement stay in place. The server clock must be NTP-synchronised.
