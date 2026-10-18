# After the defense

Items deliberately left until after the defense, each with its owner decision or plan.

| # | Item | Plan / status |
| --- | --- | --- |
| 1 | **Timezone (A4)**: times written by the app's generic clock are stored 8 hours early | `docs/TIMEZONE_PLAN.md` (option A recommended). Approve, then fix the code, repair `dental_clinic` with backup, log and rollback, and rebuild the demo database. |
| 2 | Patient home shows the dentist name from the frontend's local demo data (`src/data.js`, for example "Dr. Miguel Reyes") instead of the server's dentist | Read the dentist name from the server appointment record. |
| 3 | Demo prices are only marked as demo in the seeder output, audit key and `docs/DEMO_RUNBOOK.md` | An on-screen "demo price" marker needs a schema change (`service_prices.source` only allows `owner_confirmed`). |
| 4 | Pending `dental_clinic` migration: `2026_10_23_000100_create_clinic_settings_table`, plus `php artisan db:seed --class=ClinicSettingsSeeder` | Approve, then backup → test restore → pretend → apply. Until then `dental_clinic` uses the config defaults, and the Owner's Clinic Branding screen cannot save. |
| 5 | Live (production) PayMongo | Each clinic connects its own verified PayMongo account (`docs/WHITE_LABEL_CHECKLIST.md`); live keys only after go-live approval. |
| 6 | **Assistant AI mode streams before the output check** (security review, 2026-10-15) | In AI mode, text is streamed to the browser while it is generated and checked by OutputGuard at the end; a blocked answer is replaced, but it was visible briefly. Not active in knowledge mode (the current setting). Fix before enabling AI: buffer the AI text on the server and stream only after it passes the check. |
| 7 | **Pending for `dental_clinic`** (need approval) | Migrations `2026_10_25_000200_add_email_to_branches` and `2026_10_26_000100_add_weekly_hours_to_branches`; data: `RealBranchSeeder` (real branch names, phones, emails and per-day hours), `AssistantAnswerSeeder` (9 drafts). Details in `docs/CLINIC_DB_P3_MIGRATION_LOG.md`. |
| 8 | **Terms acceptance record** | Store the accepted Privacy/Terms version and time at sign-up once the clinic approves the text (OPEN_ITEMS 16–17). |
| 9 | **Dentist schedules** | Replace the seeded dentist shifts with the clinic's real schedules (PI-06), so online times cover the full branch hours. |
