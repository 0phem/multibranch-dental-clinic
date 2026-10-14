# Email and PDF previews

Screenshots of every branded clinic email and both PDFs, rendered from the development preview at `http://localhost:8000/dev/mail` (sample data only; nothing is sent or read). The current set is in **`v2/`**.

| File in `v2/` | What it shows |
| --- | --- |
| `A-<template>-desktop.png`, `-phone.png`, `-desktop-dark.png`, `-phone-dark.png` | Design A (Fresh and airy, the default) for every email: 900 px and 390 px, light and dark |
| `B-payment-receipt-*`, `B-verification-code-*`, `B-invoice-*` | Design B (Confident and premium), kept as an optional setting |
| `A-receipt-pdf.pdf`, `A-invoice-pdf.pdf`, `A-invoice-long-pdf.pdf` (+ `-pageN.png`) | The PDF copies, and a 14-procedure invoice spanning two pages; the same with `B-` |

`review-and-pay-*.png` and `payment-return-phone.png` show the patient portal's Review and Pay page and the return after paying.

Regenerate with the API running locally (`?design=fresh|premium` on any /dev/mail link previews a design without changing the setting):

```
V2=1 BROWSER_CHANNEL=chrome PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/email-previews.mjs
```

## Changing the brand

Every email and PDF reads its branding from `config/clinic.php` → `brand`, so one change restyles all of them. Set any of these in `backend/.env`:

| Setting | Default |
| --- | --- |
| `CLINIC_NAME`, `CLINIC_NAME_LINE`, `CLINIC_NAME_SUBTITLE` | Dr. Dana E. Roxas Dental Clinic / Dr. Dana E. Roxas / Dental Clinic |
| `CLINIC_EMAIL_DESIGN` | `fresh` (design A, default) or `premium` (design B) |
| `CLINIC_BRAND_LOGO` | `backend/resources/brand/logo-email@2x.png` (a 176 px scaled copy of `public/images/logo.png`; the original is never changed) |
| `CLINIC_BRAND_PRIMARY`, `CLINIC_BRAND_PRIMARY_DARK`, `CLINIC_BRAND_ACCENT`, `CLINIC_BRAND_ACCENT_DARK` | `#1865ac`, `#124b80`, `#0c9b8e`, `#0a7f74` (the app's own blue, and teal accents) |
| `CLINIC_ADDRESS`, `CLINIC_PHONE`, `CLINIC_EMAIL` | Bocaue, Bulacan / 0922 878 7341 / danaroxas.dentalclinic@gmail.com |

The logo must be a PNG (Gmail and Outlook ignore SVG), roughly square, about 128 px, under 40 KB. Real emails embed it in the message (CID), so it shows without any public hosting. Branch name, address and phone come from each branch; the optional BIR fields (`bir_registered_name`, `bir_tin`, `bir_registered_address`, `bir_vat_status` = `vat`/`non_vat`, `bir_permit_numbers`) are per branch and are printed only when filled in. Run `php artisan config:clear` after changing `.env` if config is cached.
