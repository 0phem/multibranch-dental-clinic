<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * STF-14 & STF-15:
 * 1. Migrate queue statuses from Waiting/Called/Treatment Ready/Temporarily Away/Served
 *    to the remaining simplified statuses: In Queue, In Treatment, Done (preserving Cancelled/No-show).
 * 2. Remove urgent queue priority and enforce arrival-based FIFO ordering.
 * 3. Preserve the append-only audit trail of queue_entry_history: historical transition records
 *    are never updated, rewritten, or deleted, and the append-only trigger remains active at all times.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Cleanly migrate existing queue entries to remaining statuses
        DB::statement("UPDATE queue_entries SET status = 'In Queue' WHERE status IN ('Waiting', 'Temporarily Away')");
        DB::statement("UPDATE queue_entries SET status = 'In Treatment' WHERE status IN ('Called', 'Treatment Ready')");
        DB::statement("UPDATE queue_entries SET status = 'Done' WHERE status = 'Served'");

        // 2. Normalize any existing urgent queue priority to Normal
        DB::statement("UPDATE queue_entries SET priority = 'Normal', priority_reason = NULL WHERE priority = 'Urgent'");

        // 3. Align closed_at with status to satisfy closed_at check constraint
        DB::statement("UPDATE queue_entries SET closed_at = COALESCE(closed_at, updated_at, now()) WHERE status IN ('Done', 'Served') AND closed_at IS NULL");
        DB::statement("UPDATE queue_entries SET closed_at = NULL WHERE status NOT IN ('Done', 'Served') AND closed_at IS NOT NULL");

        // 4. Historical queue_entry_history records are preserved exactly as recorded at event time.
        // The queue_entry_history_no_update_delete trigger remains permanently active.
        // No trigger disabling or history rewriting is performed.

        // 5. Update status check constraint
        DB::statement('ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_status_check');
        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_status_check CHECK (status IN ('In Queue', 'In Treatment', 'Done', 'Cancelled', 'No-show', 'Waiting', 'Called', 'Treatment Ready', 'Temporarily Away', 'Served'))");

        // 6. Update closed_at check constraint (Done or Served means closed)
        DB::statement('ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_closed_check');
        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_closed_check CHECK ((status IN ('Done', 'Served')) = (closed_at IS NOT NULL))");

        // 7. Update priority check constraint (Urgent priority removed)
        DB::statement('ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_priority_check');
        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_priority_check CHECK (priority IN ('Normal', 'Priority'))");
    }

    public function down(): void
    {
        // 1. Loss-safety guard: Inspect queue_entries and queue_entry_history for unrepresentable statuses.
        // The legacy schema only permits: 'Waiting', 'Called', 'Treatment Ready', 'Temporarily Away', 'Served'.
        // Only statuses with clear legacy equivalents ('In Queue' -> 'Waiting', 'In Treatment' -> 'Treatment Ready',
        // 'Done' -> 'Served') can be converted losslessly. Any occurrence of 'Cancelled', 'No-show', or other non-legacy
        // statuses cannot be represented in the legacy schema without data corruption (e.g. converting cancellations into
        // completed/served visits).
        $unrepresentableQueueCount = (int) DB::scalar(
            "SELECT COUNT(*) FROM queue_entries 
             WHERE status IN ('Cancelled', 'No-show') 
                OR status NOT IN ('Waiting', 'Called', 'Treatment Ready', 'Temporarily Away', 'Served', 'In Queue', 'In Treatment', 'Done')"
        );

        $unrepresentableHistoryCount = (int) DB::scalar(
            "SELECT COUNT(*) FROM queue_entry_history 
             WHERE to_status IN ('Cancelled', 'No-show') 
                OR from_status IN ('Cancelled', 'No-show')
                OR (to_status IS NOT NULL AND to_status NOT IN ('Waiting', 'Called', 'Treatment Ready', 'Temporarily Away', 'Served', 'In Queue', 'In Treatment', 'Done'))
                OR (from_status IS NOT NULL AND from_status NOT IN ('Waiting', 'Called', 'Treatment Ready', 'Temporarily Away', 'Served', 'In Queue', 'In Treatment', 'Done'))"
        );

        if ($unrepresentableQueueCount > 0 || $unrepresentableHistoryCount > 0) {
            throw new \RuntimeException(
                "Cannot rollback queue migration losslessly: found {$unrepresentableQueueCount} queue entry record(s) " .
                "and {$unrepresentableHistoryCount} queue entry history record(s) with unrepresentable statuses " .
                "(including 'Cancelled' or 'No-show'). The legacy schema only supports 'Waiting', 'Called', " .
                "'Treatment Ready', 'Temporarily Away', and 'Served'. Rolling back would overwrite cancellations and " .
                "no-shows as completed visits ('Served') or fail legacy check constraints, causing permanent data loss " .
                "and corrupting clinical audit trails. A deliberate data-preservation or recovery decision is required before proceeding."
            );
        }

        // 2. Drop constraints first before data updates
        DB::statement('ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_priority_check');
        DB::statement('ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_closed_check');
        DB::statement('ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_status_check');

        // 3. Map statuses that have clear legacy equivalents (In Queue -> Waiting, In Treatment -> Treatment Ready, Done -> Served)
        DB::statement("UPDATE queue_entries SET status = 'Waiting', closed_at = NULL WHERE status = 'In Queue'");
        DB::statement("UPDATE queue_entries SET status = 'Treatment Ready', closed_at = NULL WHERE status = 'In Treatment'");
        DB::statement("UPDATE queue_entries SET status = 'Served', closed_at = COALESCE(closed_at, updated_at, now()) WHERE status = 'Done'");
        DB::statement("UPDATE queue_entries SET closed_at = NULL WHERE status IN ('Waiting', 'Called', 'Treatment Ready', 'Temporarily Away') AND closed_at IS NOT NULL");
        DB::statement("UPDATE queue_entries SET closed_at = COALESCE(closed_at, updated_at, now()) WHERE status = 'Served' AND closed_at IS NULL");

        // 4. Historical queue_entry_history records are preserved unchanged.
        // The append-only trigger is never disabled, preserving audit history integrity.

        // 5. Restore legacy constraints
        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_priority_check CHECK (priority IN ('Normal', 'Priority', 'Urgent'))");
        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_closed_check CHECK ((status = 'Served') = (closed_at IS NOT NULL))");
        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_status_check CHECK (status IN ('Waiting', 'Called', 'Treatment Ready', 'Temporarily Away', 'Served'))");
    }
};
