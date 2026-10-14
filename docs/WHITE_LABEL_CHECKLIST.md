# White-label checklist (per clinic)

What to set when the system is installed for a clinic (decision 12). Items marked **manual** are done outside this system, by hand, once per clinic.

The in-app items are edited by the Owner in **Administration → Clinic Branding**. They are stored as settings, and every email, PDF and the patient portal use them at once, with no code change and no restart. `backend/.env` holds only the defaults that apply until the Owner changes something; `ClinicSettingsSeeder` copies those defaults into the settings once.

## In this system

| Item | Where | Notes |
| --- | --- | --- |
| Clinic name (full, name line, tagline) and email sender name | Clinic Branding → Identity (defaults: `CLINIC_NAME`, `CLINIC_NAME_LINE`, `CLINIC_NAME_SUBTITLE`) | Used by every email, PDF and the portal; the sender name is the From name. |
| Logo | Clinic Branding → Logo (upload; default `CLINIC_BRAND_LOGO`) | PNG or JPEG, roughly square, at least 128 px, up to 512 KB; stored at 176 px and embedded in each email. The supplied `public/images/logo.png` is never changed. |
| Email/PDF design and colours | Clinic Branding → Email and PDF design (A Fresh and airy, the default, or B Confident and premium; four colours) | `#rrggbb`. |
| Clinic contact | Clinic Branding → Contact (defaults: `CLINIC_ADDRESS`, `CLINIC_PHONE`, `CLINIC_EMAIL`) | Shown in email and PDF footers and on the public site. |
| Branch name, address, phone | `branches` table | Shown on receipts, invoices and branch emails. |
| BIR registration (optional, per branch) | Clinic Branding → BIR registration | Printed only when filled in. Documents stay titled "Payment Receipt" / "Invoice". |
| Sender name and address | `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS` and the SMTP settings | |
| Patient portal address | `FRONTEND_URL` | Used by email buttons and PayMongo return links. |

## Manual, in the PayMongo dashboard (per clinic)

| Item | Where | Why |
| --- | --- | --- |
| **Business / merchant name** | The clinic's own **verified, business-registered** PayMongo account | Each buying clinic connects its own verified PayMongo account (its keys and webhook below); PayMongo's checkout page then shows that clinic's registered business name. The name cannot be changed on an unregistered account (the demo test account shows the account holder's name, which is accepted for the demo and is not a blocker). |
| API keys and mode | `PAYMONGO_PUBLIC_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_MODE` | Test keys for demos; live keys only after go-live approval. |
| Webhook | Developers → Webhooks: `https://<api host>/api/webhooks/paymongo`, event `checkout_session.payment.paid`; secret in `PAYMONGO_WEBHOOK_SECRET` | One per environment. |
| Payment methods | `PAYMONGO_PAYMENT_METHOD_TYPES` | Only methods the clinic's PayMongo account has activated, using PayMongo's names (`card`, `gcash`, `paymaya`, `qrph`, ...). |
