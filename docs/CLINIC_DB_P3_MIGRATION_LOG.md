# dental_clinic: Priority 3 migrations log

Approved by the project owner on October 14, 2026 (approval 2). Applied by Claude Code with the agreed sequence: backup → test restore → dry run → apply. No secrets are recorded here.

| Step | Result |
| --- | --- |
| Target check | The default connection pointed at `dental_clinic` (confirmed before starting). |
| Backup | `~/Downloads/clinic-db-backups/dental_clinic_20261014_1400_pre_p3_migrations.dump` (`pg_dump -Fc`, 330,030 bytes, 61 table-data entries). |
| Test restore | Restored into a scratch database `dental_clinic_restore_check` with `pg_restore --no-owner`. **All 61 tables matched the live database row for row**, and the `migrations` table held 47 rows. The scratch database was then dropped. |
| Dry run | `php artisan migrate --pretend`: the SQL below. Additive only: 7 nullable columns and 2 check constraints that NULL satisfies; nothing altered or removed. |
| Apply | `php artisan migrate --force` on October 14, 2026 at about 14:00 (Philippine time), batch 6: `2026_10_21_000100_add_bir_fields_to_branches` (126 ms), `2026_10_22_000100_billing_address_and_checkout_fingerprint` (8 ms). |
| Verify | `migrate:status`: both "Ran", nothing pending. The 5 `branches.bir_*` columns, `patients.billing_address` (jsonb) and `payment_checkout_sessions.request_fingerprint` exist. Row counts unchanged (3 branches, 4 patients); the new columns are empty. |

## Dry-run SQL

```sql
-- 2026_10_21_000100_add_bir_fields_to_branches
alter table "branches" add column "bir_registered_name" varchar(255) null;
alter table "branches" add column "bir_tin" varchar(30) null;
alter table "branches" add column "bir_registered_address" varchar(255) null;
alter table "branches" add column "bir_vat_status" varchar(10) null;
alter table "branches" add column "bir_permit_numbers" varchar(255) null;
ALTER TABLE branches ADD CONSTRAINT branches_bir_vat_status_check CHECK (bir_vat_status IS NULL OR bir_vat_status IN ('vat','non_vat'));

-- 2026_10_22_000100_billing_address_and_checkout_fingerprint
alter table "patients" add column "billing_address" jsonb null;
ALTER TABLE patients ADD CONSTRAINT patients_billing_address_object_check CHECK (billing_address IS NULL OR jsonb_typeof(billing_address) = 'object');
alter table "payment_checkout_sessions" add column "request_fingerprint" char(64) null;
```

## Rollback

`php artisan migrate:rollback` (the last batch, 6, holds exactly these two) runs both migrations' `down()`, which drops the constraints and columns. They held no data before this change. As a last resort, restore the backup above.
