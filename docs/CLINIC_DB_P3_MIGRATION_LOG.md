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


---

# Patient portal and assistant migrations (approval 3, October 15, 2026)

Approved by the project owner on October 14, 2026 (approval 3: after the full backend suite passed, which it did: 750/750).
Sequence: backup → test restore → dry run → apply → seeders. No secrets are recorded here.

| Step | Result |
| --- | --- |
| Target check | `DB_DATABASE=dental_clinic` given explicitly for every command; `migrate:status` showed 5 pending migrations. |
| Backup | `~/Downloads/clinic-db-backups/dental_clinic_20261015_0132_pre_portal_migrations.dump` (`pg_dump -Fc`, 330,832 bytes, 61 table-data entries). |
| Test restore | Restored into the scratch database `dental_clinic_restore_check` (`pg_restore --no-owner`): **all 61 tables matched row for row**; `migrations` held 49 rows. The scratch database was dropped. |
| Scope | Only the 4 approved migrations, each named with `--path`. **`2026_10_25_000200_add_email_to_branches` was NOT run** (not in the approval; pending). |
| Dry run | `php artisan migrate --pretend --path=…` (4 paths): the SQL below. Additive only: 3 new tables, 4 nullable columns, constraints and indexes; nothing altered or removed. |

## Dry-run SQL (approval 3)

```sql
-- 2026_10_23_000100_create_clinic_settings_table
create table "clinic_settings" ("key" varchar(60) not null, "value" jsonb null, "updated_by_user_id" bigint null, "updated_at" timestamp(0) with time zone null);
alter table "clinic_settings" add constraint "clinic_settings_updated_by_user_id_foreign" foreign key ("updated_by_user_id") references "users" ("id") on delete set null;
alter table "clinic_settings" add primary key ("key");

-- 2026_10_24_000100_patient_portal_foundations
alter table "branches" add column "operating_days" jsonb null;
ALTER TABLE branches ADD CONSTRAINT branches_operating_days_check CHECK (operating_days IS NULL OR jsonb_typeof(operating_days) = 'array');
alter table "services" add column "description" varchar(300) null;
alter table "invoices" add column "billed_to_name" varchar(255) null;
alter table "receipts" add column "received_from_name" varchar(255) null;
create table "user_notifications" ("id" bigserial not null primary key, "public_id" char(26) not null, "user_id" bigint not null, "kind" varchar(40) not null, "title" varchar(160) not null, "body" varchar(300) null, "target_page" varchar(30) null, "target_id" varchar(40) null, "dedupe_key" varchar(191) not null, "created_at" timestamp(0) with time zone not null, "read_at" timestamp(0) with time zone null);
alter table "user_notifications" add constraint "user_notifications_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;
create index "user_notifications_user_id_read_at_id_index" on "user_notifications" ("user_id", "read_at", "id");
alter table "user_notifications" add constraint "user_notifications_public_id_unique" unique ("public_id");
alter table "user_notifications" add constraint "user_notifications_dedupe_key_unique" unique ("dedupe_key");
ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('appointment_booked','appointment_rescheduled','appointment_cancelled','invoice_issued','payment_received','message_received'));

-- 2026_10_24_000200_create_assistant_usage_table
create table "assistant_usage" ("id" bigserial not null primary key, "user_id" bigint not null, "clinic_date" date not null, "mode" varchar(20) not null, "outcome" varchar(30) not null, "tools" jsonb null, "input_tokens" integer null, "output_tokens" integer null, "latency_ms" integer null, "created_at" timestamp(0) with time zone not null);
alter table "assistant_usage" add constraint "assistant_usage_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;
create index "assistant_usage_user_id_clinic_date_index" on "assistant_usage" ("user_id", "clinic_date");

-- 2026_10_25_000100_create_assistant_answers_table
create table "assistant_answers" ("id" bigserial not null primary key, "public_id" char(26) not null, "seed_key" varchar(60) null, "question" varchar(200) not null, "answer" varchar(1000) not null, "keywords" jsonb not null default '[]'::jsonb, "category" varchar(40) not null, "branch_id" bigint null, "active" boolean not null default '1', "draft" boolean not null default '1', "source" varchar(200) null, "revision" integer not null default '1', "updated_by" bigint null, "created_at" timestamp(0) with time zone null, "updated_at" timestamp(0) with time zone null);
alter table "assistant_answers" add constraint "assistant_answers_branch_id_foreign" foreign key ("branch_id") references "branches" ("id") on delete restrict;
alter table "assistant_answers" add constraint "assistant_answers_updated_by_foreign" foreign key ("updated_by") references "users" ("id") on delete set null;
create index "assistant_answers_active_category_index" on "assistant_answers" ("active", "category");
alter table "assistant_answers" add constraint "assistant_answers_public_id_unique" unique ("public_id");
alter table "assistant_answers" add constraint "assistant_answers_seed_key_unique" unique ("seed_key");
ALTER TABLE assistant_answers ADD CONSTRAINT assistant_answers_keywords_array CHECK (jsonb_typeof(keywords) = 'array' AND jsonb_array_length(keywords) <= 40);
ALTER TABLE assistant_answers ADD CONSTRAINT assistant_answers_category_check CHECK (category IN ('about','services','branches','hours','booking','changes','payment','account','contact','care','hmo','other'));
```

## Apply and verify (approval 3)

| Step | Result |
| --- | --- |
| Apply | `php artisan migrate --force` with the 4 `--path` options, October 15, 2026 at about 01:35 (Philippine time), **batch 7**: `2026_10_23_000100_create_clinic_settings_table` (145 ms), `2026_10_24_000100_patient_portal_foundations` (51 ms), `2026_10_24_000200_create_assistant_usage_table` (14 ms), `2026_10_25_000100_create_assistant_answers_table` (27 ms). |
| Seeders | `ClinicSettingsSeeder`: 11 default values stored (none existed). `ServiceSeeder`: all 11 services already existed, so it only filled the 11 empty descriptions (no service created or changed otherwise). |
| Verify | `migrate:status`: the 4 show "Ran" in batch 7; `2026_10_25_000200_add_email_to_branches` is **Pending** (not approved). Branches unchanged: 3 rows, still named "Branch A/B/C" (renaming them is a separate data change awaiting approval). No assistant answers seeded (`AssistantAnswerSeeder` is a pending data change). |

## Rollback (approval 3)

`DB_DATABASE=dental_clinic php artisan migrate:rollback` rolls back batch 7 only (these 4 migrations): it drops `assistant_answers`, `assistant_usage`, `user_notifications`, `clinic_settings` and the 4 new columns. Note: rolling back also removes any notifications, assistant usage rows and Owner settings written since. Last resort: restore `dental_clinic_20261015_0132_pre_portal_migrations.dump`.

## Still pending for dental_clinic (need approval)

1. Migration `2026_10_25_000200_add_email_to_branches` (one nullable column).
2. Data: rename the branches to the real names and addresses and set their map coordinates: `ALLOW_CLINIC_DATABASE=yes DB_DATABASE=dental_clinic php artisan db:seed --class=RealBranchSeeder --force` (renames only branches still named "Branch A/B/C").
3. Data: the assistant's 9 draft answers: `ALLOW_CLINIC_DATABASE=yes DB_DATABASE=dental_clinic php artisan db:seed --class=AssistantAnswerSeeder --force`.
4. Data: closed days per branch, once the clinic confirms them (the demo default "Sunday closed" is not applied to dental_clinic).
