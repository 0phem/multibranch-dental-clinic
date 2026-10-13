# Email and PDF previews

Screenshots of every branded clinic email, rendered from the development preview at `http://localhost:8000/dev/mail` (sample data only; nothing is sent or read).

| File | What it shows |
| --- | --- |
| `*-desktop.png` | 900 px wide, light |
| `*-phone.png` | 390 px wide (phone), light |
| `*-desktop-dark.png` | 900 px wide, dark mode (clients that support `prefers-color-scheme`) |
| `receipt-pdf.pdf/.png`, `invoice-pdf.pdf/.png` | The PDF copies attached to the Payment Receipt and Invoice emails |

Regenerate them with the API running locally:

```
BROWSER_CHANNEL=chrome PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/email-previews.mjs
```

## Changing the brand

Every email and PDF reads its branding from `config/clinic.php` → `brand`, so one change restyles all of them. Set any of these in `backend/.env`:

| Setting | Default |
| --- | --- |
| `CLINIC_NAME`, `CLINIC_NAME_LINE`, `CLINIC_NAME_SUBTITLE` | Dr. Dana E. Roxas Dental Clinic / Dr. Dana E. Roxas / Dental Clinic |
| `CLINIC_BRAND_LOGO` | `backend/resources/brand/logo-email@2x.png` (a 128 px scaled copy of `public/images/logo.png`; the original is never changed) |
| `CLINIC_BRAND_PRIMARY`, `CLINIC_BRAND_PRIMARY_DARK`, `CLINIC_BRAND_ACCENT` | `#1865ac`, `#124b80`, `#0c9b8e` (the app's own blue, and a teal accent) |
| `CLINIC_ADDRESS`, `CLINIC_PHONE`, `CLINIC_EMAIL` | Bocaue, Bulacan / 0922 878 7341 / danaroxas.dentalclinic@gmail.com |

The logo must be a PNG (Gmail and Outlook ignore SVG), roughly square, about 128 px, under 40 KB. Real emails embed it in the message (CID), so it shows without any public hosting. Branch name, address and phone come from each branch; the optional BIR fields (`bir_registered_name`, `bir_tin`, `bir_registered_address`, `bir_vat_status` = `vat`/`non_vat`, `bir_permit_numbers`) are per branch and are printed only when filled in. Run `php artisan config:clear` after changing `.env` if config is cached.
