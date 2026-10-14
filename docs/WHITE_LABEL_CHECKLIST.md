# White-label checklist (per clinic)

What to set when the system is installed for a clinic (decision 12). Items marked **manual** are done outside this system, by hand, once per clinic. A settings screen for the in-app items is planned (Step 4); until then they are set in `backend/.env` (run `php artisan config:clear` afterwards).

## In this system

| Item | Where | Notes |
| --- | --- | --- |
| Clinic name (full, name line, subtitle) | `CLINIC_NAME`, `CLINIC_NAME_LINE`, `CLINIC_NAME_SUBTITLE` | Used by every email and PDF. |
| Logo | `CLINIC_BRAND_LOGO` (a file path) | Square PNG, about 128 px, under 40 KB; embedded in each email. Default: a scaled copy of `public/images/logo.png`. |
| Colours | `CLINIC_BRAND_PRIMARY`, `CLINIC_BRAND_PRIMARY_DARK`, `CLINIC_BRAND_ACCENT` | `#rrggbb`; an invalid value falls back to the default. |
| Clinic contact | `CLINIC_ADDRESS`, `CLINIC_PHONE`, `CLINIC_EMAIL` | Shown in email and PDF footers. |
| Branch name, address, phone | `branches` table | Shown on receipts, invoices and branch emails. |
| BIR registration (optional, per branch) | `branches.bir_registered_name`, `bir_tin`, `bir_registered_address`, `bir_vat_status` (`vat` / `non_vat`), `bir_permit_numbers` | Printed only when filled in. Documents stay titled "Payment Receipt" / "Invoice". |
| Sender name and address | `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS` and the SMTP settings | |
| Patient portal address | `FRONTEND_URL` | Used by email buttons and PayMongo return links. |

## Manual, in the PayMongo dashboard (per clinic)

| Item | Where | Why |
| --- | --- | --- |
| **Business / merchant name** | The clinic's own **verified, business-registered** PayMongo account | Each buying clinic connects its own verified PayMongo account (its keys and webhook below); PayMongo's checkout page then shows that clinic's registered business name. The name cannot be changed on an unregistered account (the demo test account shows the account holder's name, which is accepted for the demo and is not a blocker). |
| API keys and mode | `PAYMONGO_PUBLIC_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_MODE` | Test keys for demos; live keys only after go-live approval. |
| Webhook | Developers → Webhooks: `https://<api host>/api/webhooks/paymongo`, event `checkout_session.payment.paid`; secret in `PAYMONGO_WEBHOOK_SECRET` | One per environment. |
| Payment methods | `PAYMONGO_PAYMENT_METHOD_TYPES` | Only methods the clinic's PayMongo account has activated, using PayMongo's names (`card`, `gcash`, `paymaya`, `qrph`, ...). |
