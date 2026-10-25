-- ============================================================================
-- LOYALTY CONCURRENCY TEST: VERIFICATION
-- ============================================================================
-- Checks remaining lot balance and consumption rows.
-- Expected: Exactly 60 points consumed, 40 points remaining, zero overspend.
-- ============================================================================

SELECT earn_entry_id, original_points, consumed_points, reversed_points, remaining_points
FROM loyalty_lot_balances
WHERE earn_entry_id = 999100;

SELECT id, public_id, redeem_entry_id, earn_entry_id, points, created_at
FROM loyalty_lot_consumptions
WHERE earn_entry_id = 999100;
