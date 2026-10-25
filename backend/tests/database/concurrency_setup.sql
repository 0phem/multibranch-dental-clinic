-- ============================================================================
-- LOYALTY CONCURRENCY TEST: STEP 1 - SETUP
-- ============================================================================
-- How to run:
--   psql -U postgres -d <scratch_database> -f backend/tests/database/concurrency_setup.sql
-- ============================================================================

DO $$
DECLARE
    v_branch_id bigint;
    v_patient_id bigint;
    v_person_id bigint;
    v_account_id bigint;
BEGIN
    -- Check if branch exists or create
    SELECT id INTO v_branch_id FROM branches LIMIT 1;
    IF v_branch_id IS NULL THEN
        INSERT INTO branches (public_id, legacy_ref, branch_code, name, city, address, phone, open_time, close_time, status)
        VALUES ('br_concur_setup_0000001', 'main_concur', 'CC01', 'Concur Branch', 'Manila', '123 St', '09170000000', '08:00', '17:00', 'Active')
        RETURNING id INTO v_branch_id;
    END IF;

    -- Check if patient exists or create
    SELECT id INTO v_patient_id FROM patients LIMIT 1;
    IF v_patient_id IS NULL THEN
        INSERT INTO persons (first_name, last_name, email, phone)
        VALUES ('Concur', 'Tester', 'concur@example.com', '09170000099')
        RETURNING id INTO v_person_id;

        INSERT INTO patients (public_id, person_id, patient_code, consent, revision)
        VALUES ('pat_concur_setup_0000001', v_person_id, 'PAT-CC01', true, 1)
        RETURNING id INTO v_patient_id;
    END IF;

    -- Create or reset loyalty account with fixed ID 999
    INSERT INTO loyalty_accounts (id, public_id, patient_id, branch_id, referral_code, current_balance)
    VALUES (999, 'loy_concur_acc_0000000001', v_patient_id, v_branch_id, 'CONCUR99', 100)
    ON CONFLICT (id) DO UPDATE SET current_balance = 100;

    -- Clean previous concurrency test rows if any
    DELETE FROM loyalty_lot_consumptions WHERE earn_entry_id = 999100;
    DELETE FROM loyalty_ledger WHERE loyalty_account_id = 999;

    -- Earn lot: 100 points (ID 999100)
    INSERT INTO loyalty_ledger (id, public_id, loyalty_account_id, branch_id, points, entry_type, reason_code)
    VALUES (999100, 'led_concur_earn_00000001', 999, v_branch_id, 100, 'earn', 'treatment_payment');

    -- Two redemption ledger entries (IDs 999101 and 999102), each seeking 60 points
    INSERT INTO loyalty_ledger (id, public_id, loyalty_account_id, branch_id, points, entry_type, reason_code)
    VALUES (999101, 'led_concur_red1_00000001', 999, v_branch_id, -60, 'redeem', 'discount_voucher');

    INSERT INTO loyalty_ledger (id, public_id, loyalty_account_id, branch_id, points, entry_type, reason_code)
    VALUES (999102, 'led_concur_red2_00000001', 999, v_branch_id, -60, 'redeem', 'discount_voucher');

    RAISE NOTICE '>>> Concurrency test fixture prepared:';
    RAISE NOTICE '    Earn Lot ID: 999100 (100 points)';
    RAISE NOTICE '    Redeem Entry 1 ID: 999101 (60 points)';
    RAISE NOTICE '    Redeem Entry 2 ID: 999102 (60 points)';
END;
$$;
