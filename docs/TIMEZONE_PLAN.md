# Timezone plan (A4): stored times 8 hours early

Status: **proposal, awaiting approval.** Nothing in `dental_clinic` has been changed. Every query behind this document was read-only (`SELECT`, `SHOW`, `information_schema`), run on October 14, 2026.

## 1. What is wrong

Three settings disagree:

| Layer | Setting | Value |
| --- | --- | --- |
| Laravel | `config/app.php` `timezone` | `UTC`, so `now()` and Eloquent's automatic `created_at`/`updated_at` are UTC Carbon values |
| Laravel → PostgreSQL | how a date is written | `Y-m-d H:i:s`, the wall-clock time **without an offset** |
| PostgreSQL | session `TimeZone` (from the server's `postgresql.conf`, not from the app) | `Asia/Manila` |

PostgreSQL reads an offset-less string in its session time zone. So:

* **Columns with a time zone (`timestamptz`, 102 columns)** written from `now()` or Eloquent timestamps get the UTC wall-clock read as Manila time. The stored instant is **8 hours early**. The same columns written from `App\Support\ClinicClock::now()` (a Manila Carbon) are **correct**, and so are those filled by a database default (`DEFAULT now()`).
* **Columns without a time zone (`timestamp`, 35 columns: `users`, `persons`, `patients`, `branches`, `services`, `staff_profiles`, `dentist_*`, `email_verification_otps`, `personal_access_tokens`, `password_reset_tokens`, `workflow_rules`, `failed_jobs`)** store the wall-clock and Laravel reads it back as UTC. They round-trip consistently inside Laravel as long as they are only written from `now()`. They are wrong only if a `ClinicClock` value is written into them, or when they are read by another tool that assumes Manila.

Reading is fine: PostgreSQL returns `timestamptz` with its offset (`2026-10-14 02:28:17+08`), and Carbon keeps it. Screens and emails therefore show whatever instant was stored, so wrong instants show as wrong times.

## 2. Evidence (read-only)

`dental_clinic_demo`, values written in one command by different writers (the PayMongo test payment, October 14, 2026):

| Comparison | Rows | Average difference |
| --- | --- | --- |
| `receipts.issued_at` (ClinicClock) − `receipts.created_at` (Eloquent) | 1 | **+8.00 h** |
| `payments.recorded_at` (ClinicClock) − `payments.created_at` | 1 | **+8.00 h** |
| `invoices.issued_at` (ClinicClock) − `invoices.created_at` | 2 | **+8.00 h** |
| `invoice_histories.occurred_at` − `invoices.created_at` (same command) | 2 | **+8.00 h** |
| `audit_logs.created_at` (database default) vs the real time of the payment | 7 | correct |

The same payment read straight from PostgreSQL: `payment_checkout_sessions.created_at = 2026-10-13 18:27:35+08`, while `invoices.paid_at = 2026-10-14 02:28:17+08`. The two events were 42 seconds apart.

Columns filled by a database default, and therefore correct: `audit_logs.created_at`, `automated_actions.created_at/executed_at`, `conversation_messages.created_at`, `failed_jobs.failed_at`, `patient_feedback.created_at`, `system_events.created_at/occurred_at`.

`dental_clinic` today holds very little affected data: 1 appointment, 2 appointment history rows, 1 mail dispatch, 3 user branch scopes, 48 audit logs (correct, database default), and no invoices, payments or receipts.

## 3. Where it matters

* **Wrong today:** `created_at`/`updated_at` on every `timestamptz` table written by Eloquent, plus columns set with `now()`. Examples are `payment_provider_events.received_at/processed_at`, `mail_dispatches.locked_at/next_attempt_at/completed_at` (MailOutbox's own claim query passes ISO strings *with* an offset, so its comparisons are consistent), and `payment_checkout_sessions.*`.
* **Correct today:** anything stamped with `ClinicClock::now()`: invoice `issued_at`/`paid_at`, receipts `issued_at`, payments `recorded_at`, appointment `starts_at`/`ends_at` (`ClinicClock::at`), and the history `occurred_at` columns. Also every database default.
* **Business impact:** displayed "created" times, sort order between rows from different writers, any report that subtracts a `created_at` from a ClinicClock time, retention windows, and the M22 audit view joined to records. Appointment slots and billing amounts are not affected.

## 4. Options

| | Change | Pros | Cons / risk |
| --- | --- | --- | --- |
| **A (recommended)** | Pin the PostgreSQL session to UTC (`'timezone' => 'UTC'` on the `pgsql` connection in `config/database.php`) **and** write every instant with an explicit offset (a shared model trait setting `$dateFormat = 'Y-m-d H:i:sO'`), so `now()` and `ClinicClock::now()` both store the correct instant. Naive columns stay UTC wall-clock, the standard convention. | Correct whatever the DB server's own setting. Industry standard (store UTC, show Manila). ClinicClock stays the only place that knows "clinic time". | Touches every model (one trait). Raw `DB::table()` writes that pass Carbon objects need the same offset (sweep with a test). |
| B | Set `app.timezone` to `Asia/Manila` and pin the session to `Asia/Manila`. | Smallest code change. | Naive columns then switch convention (old rows read 8 hours off unless repaired). Mixing app time zone with storage time zone is fragile, and tests that assume UTC break. |
| C | Pin the session to UTC only. | One line. | **Makes the correct ClinicClock values wrong** (they also carry no offset). Not acceptable alone. |

## 5. Data repair proposal (with option A)

1. **Freeze the cutover:** deploy the code fix, then note the cutover instant `T` and, per table, the highest `id` written before it.
2. **Column map:** for each `timestamptz` column, record its writer from the code: Eloquent/`now()`, ClinicClock, or database default. Section 3 has the first pass; a script will confirm each column by comparing it with a sibling column of known writer in the same row (as in section 2). A column is repaired only when every probe shows the +8 h skew.
3. **Repair:** in one transaction, for each "Eloquent/now()" column and only for rows with `id <= max id before T`: `col = col + interval '8 hours'`. Each changed value goes first into a `tz_repair_log(table_name, row_id, column_name, old_value, new_value, repaired_at)` table. Database-default and ClinicClock columns are never touched. Naive columns are not changed under option A.
4. **Verify:** rerun the section 2 probes. Every difference must be about 0 h, and the M22 audit chain and the deferred visit/treatment triggers must still pass (no row's order between `started_at` and `completed_at` may flip).
5. **Sequence for `dental_clinic`:** the same as for every migration: a backup (`pg_dump -Fc`), a test restore into a scratch database, a dry run of the repair there with the probe results, then your approval, then apply.

Size today: on the order of 10 rows in `dental_clinic`. The demo and test databases can simply be rebuilt.

## 6. Rollback

* **Code:** revert the commit (the config line and the trait). Behaviour returns to today's.
* **Data:** `UPDATE ... SET col = log.old_value FROM tz_repair_log log WHERE ...` restores every repaired value exactly, in one transaction. As a last resort, restore the backup taken in step 5.
* Rows written *after* the fix are correct in both directions. If the code is rolled back but not the data, new rows are written with the old 8-hour error again, so code and data are rolled back together.

## 7. Decisions needed

1. Approve option A (or choose B).
2. Approve the repair approach (log table plus +8 h on confirmed columns, before the cutover only), and when to run it.
3. Confirm the convention for naive columns: they stay UTC wall-clock; no change.
