-- ============================================================================
-- LOYALTY CONCURRENCY TEST: SESSION 1
-- ============================================================================
-- Starts immediately, locks earn lot row via validate_lot_consumption(),
-- holds transaction open for 2 seconds, then commits 60 points consumption.
-- ============================================================================

\echo 'Session 1: Starting transaction to consume 60 points from earn lot 999100...'
BEGIN;

INSERT INTO loyalty_lot_consumptions (public_id, redeem_entry_id, earn_entry_id, points)
VALUES ('con_concur_s1_' || to_char(clock_timestamp(), 'HH24MISSMS'), 999101, 999100, 60);

\echo 'Session 1: Insert completed, holding lock for 2 seconds...'
SELECT pg_sleep(2);

COMMIT;
\echo 'Session 1: COMMITTED 60 points consumption.'
