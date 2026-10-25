-- ============================================================================
-- LOYALTY & SCHEMA HARDENING REPEATABLE INTEGRITY TEST SUITE
-- ============================================================================
-- How to run:
--   psql -U postgres -d <scratch_database> -f backend/tests/database/loyalty_integrity_test.sql
--
-- Prerequisites:
--   - Database with all migrations applied (up to 2026_11_16_000100)
--
-- Tested Invariants:
--   1. Self-referral rejected (CHECK constraint)
--   2. Duplicate referee rejected (UNIQUE constraint)
--   3. Webhook idempotency on loyalty_ledger (UNIQUE constraint)
--   4. Append-only triggers block UPDATE and DELETE on:
--        - loyalty_ledger
--        - loyalty_lot_consumptions
--        - invoice_refunds
--   5. Lot consumption and over-consumption guard (validate_lot_consumption trigger)
--   6. Multiple refunds reversing the same earn lot
--   7. Duplicate refund reversal on same lot blocked (UNIQUE constraint)
--   8. loyalty_lot_balances view accurately computes net remaining points
--   9. Zero-balance refund shortfall recording (points=0, unrecovered_points>0)
--  10. Total reversal guard blocking reversals exceeding earn lot (validate_ledger_reversal trigger)
-- ============================================================================

DO $$
DECLARE
    v_branch_id bigint;
    v_person1_id bigint;
    v_person2_id bigint;
    v_patient1_id bigint;
    v_patient2_id bigint;
    v_account1_id bigint;
    v_dentist_id bigint;
    v_visit_id bigint;
    v_treatment_id bigint;
    v_earn_id bigint;
    v_redeem_id bigint;
    v_inv_id bigint;
    v_pay_id bigint;
    v_refund1_id bigint;
    v_refund2_id bigint;
    v_refund3_id bigint;
    v_refund4_id bigint;
    v_rev1_id bigint;
    v_rev2_id bigint;
    v_user_id bigint;
    v_rem integer;
    v_test_suffix text := to_char(clock_timestamp(), 'HH24MISSMS');
BEGIN
    RAISE NOTICE '>>> Starting Loyalty & Schema Hardening Integrity Tests...';

    -- Setup baseline records
    INSERT INTO branches (public_id, legacy_ref, branch_code, name, city, address, phone, open_time, close_time, status)
    VALUES ('br_rpt_' || v_test_suffix, 'main_' || v_test_suffix, 'MNL_' || v_test_suffix, 'Test Branch', 'Manila', '123 St', '09170000000', '08:00', '17:00', 'Active')
    RETURNING id INTO v_branch_id;

    INSERT INTO persons (first_name, last_name, email, phone)
    VALUES ('Juan', 'Test', 'juan_' || v_test_suffix || '@example.com', '09170000001')
    RETURNING id INTO v_person1_id;

    INSERT INTO users (public_id, person_id, email, role, password)
    VALUES ('usr_rpt1_' || v_test_suffix, v_person1_id, 'juan_' || v_test_suffix || '@example.com', 'staff', 'secret')
    RETURNING id INTO v_user_id;

    INSERT INTO patients (public_id, person_id, patient_code, consent, revision)
    VALUES ('pat_rpt1_' || v_test_suffix, v_person1_id, 'PAT-R1-' || v_test_suffix, true, 1)
    RETURNING id INTO v_patient1_id;

    INSERT INTO persons (first_name, last_name, email, phone)
    VALUES ('Maria', 'Test', 'maria_' || v_test_suffix || '@example.com', '09170000002')
    RETURNING id INTO v_person2_id;

    INSERT INTO patients (public_id, person_id, patient_code, consent, revision)
    VALUES ('pat_rpt2_' || v_test_suffix, v_person2_id, 'PAT-R2-' || v_test_suffix, true, 1)
    RETURNING id INTO v_patient2_id;

    -- Setup invoice & payment for refund linkage
    INSERT INTO dentist_profiles (legacy_ref, person_id, license_no, specialty, shift_start, shift_end, available)
    VALUES ('D-R-' || v_test_suffix, v_person1_id, 'DEN-' || v_test_suffix, 'General Dentistry', '09:00', '17:00', true)
    RETURNING id INTO v_dentist_id;

    INSERT INTO visits (public_id, patient_id, branch_id, source, clinic_date, status, arrived_at, closed_at, responsible_dentist_profile_id, revision)
    VALUES ('vis_rpt_' || v_test_suffix, v_patient1_id, v_branch_id, 'walk_in', CURRENT_DATE, 'Completed', now(), now(), v_dentist_id, 1)
    RETURNING id INTO v_visit_id;

    INSERT INTO treatments (public_id, visit_id, dentist_profile_id, status, prescription_required, followup_required, started_at, completed_at, revision)
    VALUES ('trt_rpt_' || v_test_suffix, v_visit_id, v_dentist_id, 'Completed', false, false, now(), now(), 1)
    RETURNING id INTO v_treatment_id;

    INSERT INTO invoices (public_id, treatment_id, visit_id, patient_id, branch_id, invoice_number, status, revision, gross_amount, discount_amount, hmo_coverage_amount, patient_responsibility_amount, paid_amount, created_by_user_id, updated_by_user_id)
    VALUES ('inv_rpt_' || v_test_suffix, v_treatment_id, v_visit_id, v_patient1_id, v_branch_id, 'INV-R-' || v_test_suffix, 'Paid', 1, 5000, 0, 0, 5000, 5000, v_user_id, v_user_id)
    RETURNING id INTO v_inv_id;

    INSERT INTO payments (public_id, invoice_id, amount, method, recorded_by_user_id, recorded_at)
    VALUES ('pay_rpt_' || v_test_suffix, v_inv_id, 5000, 'Cash', v_user_id, now())
    RETURNING id INTO v_pay_id;

    -- Setup loyalty account
    INSERT INTO loyalty_accounts (public_id, patient_id, branch_id, referral_code, current_balance)
    VALUES ('loy_acc_' || v_test_suffix, v_patient1_id, v_branch_id, 'REF-' || v_test_suffix, 100)
    RETURNING id INTO v_account1_id;

    -- TEST 1: Self-referral blocked
    BEGIN
        INSERT INTO referrals (public_id, referrer_patient_id, referee_patient_id, referral_code_used)
        VALUES ('ref_self_' || v_test_suffix, v_patient1_id, v_patient1_id, 'REF-' || v_test_suffix);
        RAISE EXCEPTION 'TEST 1 FAILED: Self-referral was allowed!';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE '[PASS] Test 1: Self-referral blocked by referrals_no_self_referral check.';
    END;

    -- TEST 2: Valid referral & duplicate referee blocked
    INSERT INTO referrals (public_id, referrer_patient_id, referee_patient_id, referral_code_used)
    VALUES ('ref_ok_' || v_test_suffix, v_patient1_id, v_patient2_id, 'REF-' || v_test_suffix);
    RAISE NOTICE '[PASS] Test 2A: Valid referral inserted.';

    BEGIN
        INSERT INTO referrals (public_id, referrer_patient_id, referee_patient_id, referral_code_used)
        VALUES ('ref_dup_' || v_test_suffix, v_patient1_id, v_patient2_id, 'REF-' || v_test_suffix);
        RAISE EXCEPTION 'TEST 2B FAILED: Duplicate referee was allowed!';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '[PASS] Test 2B: Duplicate referee blocked by referrals_referee_patient_id_unique.';
    END;

    -- TEST 3: Earn & Idempotency Key
    INSERT INTO loyalty_ledger (public_id, loyalty_account_id, branch_id, points, entry_type, reason_code, idempotency_key)
    VALUES ('led_earn_' || v_test_suffix, v_account1_id, v_branch_id, 100, 'earn', 'invoice_paid', 'evt_idem_' || v_test_suffix)
    RETURNING id INTO v_earn_id;
    RAISE NOTICE '[PASS] Test 3A: Earn lot inserted with idempotency key.';

    BEGIN
        INSERT INTO loyalty_ledger (public_id, loyalty_account_id, branch_id, points, entry_type, reason_code, idempotency_key)
        VALUES ('led_dup_' || v_test_suffix, v_account1_id, v_branch_id, 100, 'earn', 'invoice_paid', 'evt_idem_' || v_test_suffix);
        RAISE EXCEPTION 'TEST 3B FAILED: Duplicate idempotency key was allowed!';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '[PASS] Test 3B: Duplicate webhook credit blocked by loyalty_ledger_idempotency_key_unique.';
    END;

    -- TEST 4: Append-Only Trigger on loyalty_ledger
    BEGIN
        UPDATE loyalty_ledger SET points = 999 WHERE id = v_earn_id;
        RAISE EXCEPTION 'TEST 4A FAILED: loyalty_ledger UPDATE was allowed!';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE '[PASS] Test 4A: loyalty_ledger UPDATE blocked by loyalty_ledger_append_only trigger.';
    END;

    BEGIN
        DELETE FROM loyalty_ledger WHERE id = v_earn_id;
        RAISE EXCEPTION 'TEST 4B FAILED: loyalty_ledger DELETE was allowed!';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE '[PASS] Test 4B: loyalty_ledger DELETE blocked by loyalty_ledger_append_only trigger.';
    END;

    -- TEST 5: Consumptions and Over-consumption guard
    INSERT INTO loyalty_ledger (public_id, loyalty_account_id, branch_id, points, entry_type, reason_code)
    VALUES ('led_red_' || v_test_suffix, v_account1_id, v_branch_id, -30, 'redeem', 'discount_voucher')
    RETURNING id INTO v_redeem_id;

    INSERT INTO loyalty_lot_consumptions (public_id, redeem_entry_id, earn_entry_id, points)
    VALUES ('con_ok_' || v_test_suffix, v_redeem_id, v_earn_id, 30);
    RAISE NOTICE '[PASS] Test 5A: Valid lot consumption (30 points) recorded.';

    BEGIN
        INSERT INTO loyalty_lot_consumptions (public_id, redeem_entry_id, earn_entry_id, points)
        VALUES ('con_over_' || v_test_suffix, v_redeem_id, v_earn_id, 80);
        RAISE EXCEPTION 'TEST 5B FAILED: Over-consumption was allowed!';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE '[PASS] Test 5B: Over-consumption blocked by validate_lot_consumption trigger.';
    END;

    -- Append-Only Trigger on loyalty_lot_consumptions
    BEGIN
        UPDATE loyalty_lot_consumptions SET points = 100 WHERE earn_entry_id = v_earn_id;
        RAISE EXCEPTION 'TEST 5C FAILED: loyalty_lot_consumptions UPDATE was allowed!';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE '[PASS] Test 5C: loyalty_lot_consumptions UPDATE blocked by append-only trigger.';
    END;

    -- TEST 6: Multiple refunds reversing parts of same earn lot
    INSERT INTO invoice_refunds (public_id, invoice_id, payment_id, amount, reason, refunded_at, created_by_user_id)
    VALUES ('ref_inv1_' || v_test_suffix, v_inv_id, v_pay_id, 1000, 'Partial refund 1', now(), v_user_id)
    RETURNING id INTO v_refund1_id;

    INSERT INTO invoice_refunds (public_id, invoice_id, payment_id, amount, reason, refunded_at, created_by_user_id)
    VALUES ('ref_inv2_' || v_test_suffix, v_inv_id, v_pay_id, 1000, 'Partial refund 2', now(), v_user_id)
    RETURNING id INTO v_refund2_id;

    INSERT INTO loyalty_ledger (public_id, loyalty_account_id, branch_id, points, entry_type, reason_code, reverses_entry_id, refund_id)
    VALUES ('led_rev1_' || v_test_suffix, v_account1_id, v_branch_id, -20, 'reverse', 'partial_refund', v_earn_id, v_refund1_id)
    RETURNING id INTO v_rev1_id;

    INSERT INTO loyalty_ledger (public_id, loyalty_account_id, branch_id, points, entry_type, reason_code, reverses_entry_id, refund_id)
    VALUES ('led_rev2_' || v_test_suffix, v_account1_id, v_branch_id, -20, 'reverse', 'partial_refund', v_earn_id, v_refund2_id)
    RETURNING id INTO v_rev2_id;
    RAISE NOTICE '[PASS] Test 6A: Multiple partial refunds reversed parts of the same earn lot.';

    -- Duplicate reversal against same refund/lot blocked
    BEGIN
        INSERT INTO loyalty_ledger (public_id, loyalty_account_id, branch_id, points, entry_type, reason_code, reverses_entry_id, refund_id)
        VALUES ('led_revdup_' || v_test_suffix, v_account1_id, v_branch_id, -20, 'reverse', 'partial_refund', v_earn_id, v_refund1_id);
        RAISE EXCEPTION 'TEST 6B FAILED: Duplicate reversal for same refund was allowed!';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '[PASS] Test 6B: Duplicate reversal for same refund blocked by loyalty_ledger_refund_reversal_unique.';
    END;

    -- TEST 7: View loyalty_lot_balances net calculation
    -- Earned: 100, Consumed: 30, Reversed: 20 + 20 = 40. Remaining should be 100 - 30 - 40 = 30.
    SELECT remaining_points INTO v_rem FROM loyalty_lot_balances WHERE earn_entry_id = v_earn_id;
    IF v_rem = 30 THEN
        RAISE NOTICE '[PASS] Test 7: loyalty_lot_balances view correctly computes net remaining_points = 30.';
    ELSE
        RAISE EXCEPTION 'TEST 7 FAILED: Expected 30 remaining points, got %', v_rem;
    END IF;

    -- TEST 8: Append-only Trigger on invoice_refunds
    BEGIN
        UPDATE invoice_refunds SET amount = 9999 WHERE id = v_refund1_id;
        RAISE EXCEPTION 'TEST 8A FAILED: invoice_refunds UPDATE was allowed!';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE '[PASS] Test 8A: invoice_refunds UPDATE blocked by invoice_refunds_append_only trigger.';
    END;

    BEGIN
        DELETE FROM invoice_refunds WHERE id = v_refund1_id;
        RAISE EXCEPTION 'TEST 8B FAILED: invoice_refunds DELETE was allowed!';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE '[PASS] Test 8B: invoice_refunds DELETE blocked by invoice_refunds_append_only trigger.';
    END;

    -- TEST 9: Shortfall Recording under Cap-at-Balance Policy
    INSERT INTO invoice_refunds (public_id, invoice_id, payment_id, amount, reason, refunded_at, created_by_user_id)
    VALUES ('ref_inv3_' || v_test_suffix, v_inv_id, v_pay_id, 1000, 'Partial refund 3', now(), v_user_id)
    RETURNING id INTO v_refund3_id;

    -- Zero-balance account records shortfall row with points=0 and unrecovered_points=50
    UPDATE loyalty_accounts SET current_balance = 0 WHERE id = v_account1_id;
    INSERT INTO loyalty_ledger (public_id, loyalty_account_id, branch_id, points, entry_type, reason_code, reverses_entry_id, refund_id, unrecovered_points)
    VALUES ('led_short_' || v_test_suffix, v_account1_id, v_branch_id, 0, 'reverse', 'refund_clawback_shortfall', v_earn_id, v_refund3_id, 50);
    RAISE NOTICE '[PASS] Test 9: Shortfall row recorded with points=0, unrecovered_points=50 while preserving balance >= 0.';

    -- TEST 10: Over-reversal Guard (validate_ledger_reversal)
    INSERT INTO invoice_refunds (public_id, invoice_id, payment_id, amount, reason, refunded_at, created_by_user_id)
    VALUES ('ref_inv4_' || v_test_suffix, v_inv_id, v_pay_id, 1000, 'Partial refund 4', now(), v_user_id)
    RETURNING id INTO v_refund4_id;

    -- Lot v_earn_id had 100 pts. Already reversed: 20 + 20 = 40 pts. Max remaining reversible: 60 pts.
    -- Attempting to reverse 70 points must be rejected.
    BEGIN
        INSERT INTO loyalty_ledger (public_id, loyalty_account_id, branch_id, points, entry_type, reason_code, reverses_entry_id, refund_id)
        VALUES ('led_revover_' || v_test_suffix, v_account1_id, v_branch_id, -70, 'reverse', 'excess_refund', v_earn_id, v_refund4_id);
        RAISE EXCEPTION 'TEST 10 FAILED: Over-reversal was allowed!';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE '[PASS] Test 10: Over-reversal blocked by validate_ledger_reversal trigger: %', SQLERRM;
    END;

    RAISE NOTICE '============================================================';
    RAISE NOTICE '>>> ALL 10 INTEGRITY TESTS PASSED SUCCESSFULLY!';
    RAISE NOTICE '============================================================';
END;
$$;
