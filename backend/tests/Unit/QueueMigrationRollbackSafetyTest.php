<?php

namespace Tests\Unit;

use App\Models\QueueEntry;
use PHPUnit\Framework\TestCase;

class QueueMigrationRollbackSafetyTest extends TestCase
{
    private string $migrationContent;

    protected function setUp(): void
    {
        parent::setUp();
        $migrationPath = dirname(__DIR__, 2) . '/database/migrations/2026_11_16_000500_update_queue_statuses_and_remove_urgent_priority.php';
        $this->assertFileExists($migrationPath);
        $this->migrationContent = (string) file_get_contents($migrationPath);
    }

    public function test_migration_never_disables_or_drops_append_only_history_trigger(): void
    {
        $this->assertStringNotContainsStringIgnoringCase(
            'DISABLE TRIGGER',
            $this->migrationContent,
            'Migration must never disable queue_entry_history append-only trigger'
        );
        $this->assertStringNotContainsStringIgnoringCase(
            'DROP TRIGGER',
            $this->migrationContent,
            'Migration must never drop queue_entry_history trigger'
        );
    }

    public function test_migration_never_modifies_or_deletes_historical_audit_records(): void
    {
        $this->assertStringNotContainsStringIgnoringCase(
            'UPDATE queue_entry_history',
            $this->migrationContent,
            'Migration must never rewrite historical audit rows in queue_entry_history'
        );
        $this->assertStringNotContainsStringIgnoringCase(
            'DELETE FROM queue_entry_history',
            $this->migrationContent,
            'Migration must never delete historical audit rows from queue_entry_history'
        );
    }

    public function test_rollback_contains_safety_guard_for_unrepresentable_statuses_including_cancelled_and_noshow(): void
    {
        $this->assertStringContainsString(
            "SELECT COUNT(*) FROM queue_entries",
            $this->migrationContent,
            'Rollback guard must inspect queue_entries before performing any changes'
        );
        $this->assertStringContainsString(
            "SELECT COUNT(*) FROM queue_entry_history",
            $this->migrationContent,
            'Rollback guard must inspect queue_entry_history before performing any changes'
        );
        $this->assertStringContainsString(
            "'Cancelled', 'No-show'",
            $this->migrationContent,
            "Rollback guard must explicitly guard 'Cancelled' and 'No-show' statuses"
        );
        $this->assertStringContainsString(
            'Cannot rollback queue migration losslessly',
            $this->migrationContent,
            'Rollback must throw actionable RuntimeException when unrepresentable statuses are present'
        );
    }

    public function test_forward_migration_satisfies_queue_status_and_closed_at_constraints(): void
    {
        // 1. Queue statuses mapped
        $this->assertStringContainsString("UPDATE queue_entries SET status = 'In Queue' WHERE status IN ('Waiting', 'Temporarily Away')", $this->migrationContent);
        $this->assertStringContainsString("UPDATE queue_entries SET status = 'In Treatment' WHERE status IN ('Called', 'Treatment Ready')", $this->migrationContent);
        $this->assertStringContainsString("UPDATE queue_entries SET status = 'Done' WHERE status = 'Served'", $this->migrationContent);

        // 2. Urgent priority normalized
        $this->assertStringContainsString("UPDATE queue_entries SET priority = 'Normal', priority_reason = NULL WHERE priority = 'Urgent'", $this->migrationContent);

        // 3. closed_at alignment
        $this->assertStringContainsString("UPDATE queue_entries SET closed_at = COALESCE(closed_at, updated_at, now()) WHERE status IN ('Done', 'Served') AND closed_at IS NULL", $this->migrationContent);
        $this->assertStringContainsString("UPDATE queue_entries SET closed_at = NULL WHERE status NOT IN ('Done', 'Served') AND closed_at IS NOT NULL", $this->migrationContent);

        // 4. Check constraints added
        $this->assertStringContainsString("CHECK (status IN ('In Queue', 'In Treatment', 'Done', 'Cancelled', 'No-show'", $this->migrationContent);
        $this->assertStringContainsString("CHECK ((status IN ('Done', 'Served')) = (closed_at IS NOT NULL))", $this->migrationContent);
        $this->assertStringContainsString("CHECK (priority IN ('Normal', 'Priority'))", $this->migrationContent);
    }

    public function test_rollback_migration_satisfies_legacy_status_and_closed_at_constraints(): void
    {
        // 1. Lossless reverse mapping
        $this->assertStringContainsString("UPDATE queue_entries SET status = 'Waiting', closed_at = NULL WHERE status = 'In Queue'", $this->migrationContent);
        $this->assertStringContainsString("UPDATE queue_entries SET status = 'Treatment Ready', closed_at = NULL WHERE status = 'In Treatment'", $this->migrationContent);
        $this->assertStringContainsString("UPDATE queue_entries SET status = 'Served', closed_at = COALESCE(closed_at, updated_at, now()) WHERE status = 'Done'", $this->migrationContent);

        // 2. Legacy check constraints restored
        $this->assertStringContainsString("CHECK (priority IN ('Normal', 'Priority', 'Urgent'))", $this->migrationContent);
        $this->assertStringContainsString("CHECK ((status = 'Served') = (closed_at IS NOT NULL))", $this->migrationContent);
        $this->assertStringContainsString("CHECK (status IN ('Waiting', 'Called', 'Treatment Ready', 'Temporarily Away', 'Served'))", $this->migrationContent);
    }

    public function test_queue_entry_model_priority_constants_exclude_urgent(): void
    {
        $this->assertSame(['Normal', 'Priority'], QueueEntry::PRIORITIES);
        $this->assertNotContains('Urgent', QueueEntry::PRIORITIES);
    }
}
