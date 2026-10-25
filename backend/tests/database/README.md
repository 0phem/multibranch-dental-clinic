# Database Integrity & Concurrency Test Suites

This directory contains executable PostgreSQL test scripts validating schema constraints, triggers, append-only policies, shortfall tracking, and concurrency protection implemented across migrations `2026_11_15_000100` to `2026_11_16_000100`.

> **MIGRATION 4 SPLIT NOTE**:
> Migration `2026_11_15_000400_backfill_tooth_chart_branch.php` only backfills historical `branch_id` values and verifies the append-only trigger.
> The constraint tightening (`CHECK (branch_id IS NOT NULL) NOT VALID` and `VALIDATE CONSTRAINT`) is drafted in `docs/pending/draft_tighten_tooth_chart_branch.php` and must ship together with the `DentalChartController` fix, not before.

> **IMPORTANT**:
> - Never run these test scripts against the real production database (`dental_clinic`) or `dental_clinic_test`.
> - Always run them against a scratch database (e.g., `dental_clinic_scratch`) and drop it afterward.

---

## 1. Running the Full Integrity Test Suite

Validates all 10 schema rules and triggers (referrals, append-only guards, webhook idempotency, balance view calculations, shortfall records, and over-reversal prevention):

```bash
psql -U postgres -d <scratch_database> -f backend/tests/database/loyalty_integrity_test.sql
```

Expected output ends with:
```
NOTICE:  >>> ALL 10 INTEGRITY TESTS PASSED SUCCESSFULLY!
```

---

## 2. Running the Concurrency Proof

Validates that concurrent redemptions against the same earn lot serialize cleanly using PostgreSQL row locks (`PERFORM 1 FROM loyalty_ledger WHERE id = NEW.earn_entry_id FOR UPDATE;`), preventing double-spending and overconsumption.

### Step 1: Initialize the test fixture
```bash
psql -U postgres -d <scratch_database> -f backend/tests/database/concurrency_setup.sql
```

### Step 2: Run both sessions simultaneously
Open two terminals or run them as concurrent background processes:

**Terminal 1:**
```bash
psql -U postgres -d <scratch_database> -f backend/tests/database/concurrency_session1.sql
```

**Terminal 2 (start immediately after Terminal 1):**
```bash
psql -U postgres -d <scratch_database> -f backend/tests/database/concurrency_session2.sql
```

### Step 3: Verify the outcome
```bash
psql -U postgres -d <scratch_database> -f backend/tests/database/concurrency_verify.sql
```

**Expected Result:**
- Session 1 successfully commits 60 points.
- Session 2 waits for Session 1's row lock, resumes, detects only 40 points remain, and aborts with:
  `ERROR: Cannot consume 60 points: only 40 points remain unconsumed/unreversed on earn lot 999100`
- `concurrency_verify.sql` shows:
  - `original_points`: 100
  - `consumed_points`: 60
  - `reversed_points`: 0
  - `remaining_points`: 40
  - Total consumed points across all rows = 60 (zero overspending).
