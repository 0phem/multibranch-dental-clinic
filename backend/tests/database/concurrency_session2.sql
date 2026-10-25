-- ============================================================================
-- LOYALTY CONCURRENCY TEST: SESSION 2
-- ============================================================================
-- Starts with a 0.3-second delay, attempts to consume 60 points from lot 999100.
-- It blocks waiting for Session 1's FOR UPDATE lock on the earn lot.
-- Once Session 1 commits, Session 2 sees only 40 points remain and aborts.
-- ============================================================================

\echo 'Session 2: Pausing 0.3s to ensure Session 1 obtains lock first...'
SELECT pg_sleep(0.3);

\echo 'Session 2: Starting transaction to consume 60 points from earn lot 999100...'
BEGIN;

INSERT INTO loyalty_lot_consumptions (public_id, redeem_entry_id, earn_entry_id, points)
VALUES ('con_concur_s2_' || to_char(clock_timestamp(), 'HH24MISSMS'), 999102, 999100, 60);

COMMIT;
\echo 'Session 2: Transaction finished.'
