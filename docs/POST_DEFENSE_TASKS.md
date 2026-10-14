# After the defense

Items deliberately left until after the defense, each with its owner decision or plan.

| # | Item | Plan / status |
| --- | --- | --- |
| 1 | **Timezone (A4)**: times written by the app's generic clock are stored 8 hours early | `docs/TIMEZONE_PLAN.md` (option A recommended). Approve, then fix the code, repair `dental_clinic` with backup, log and rollback, and rebuild the demo database. |
| 2 | Patient home shows the dentist name from the frontend's local demo data (`src/data.js`, for example "Dr. Miguel Reyes") instead of the server's dentist | Read the dentist name from the server appointment record. |
| 3 | Demo prices are only marked as demo in the seeder output, audit key and `docs/DEMO_RUNBOOK.md` | An on-screen "demo price" marker needs a schema change (`service_prices.source` only allows `owner_confirmed`). |
| 4 | Pending `dental_clinic` migration: `2026_10_23_000100_create_clinic_settings_table`, plus `php artisan db:seed --class=ClinicSettingsSeeder` | Approve, then backup → test restore → pretend → apply. Until then `dental_clinic` uses the config defaults, and the Owner's Clinic Branding screen cannot save. |
| 5 | Live (production) PayMongo | Each clinic connects its own verified PayMongo account (`docs/WHITE_LABEL_CHECKLIST.md`); live keys only after go-live approval. |
