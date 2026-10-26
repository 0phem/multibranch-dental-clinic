<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * ============================================================================
 * PROPOSED MIGRATION: BACKFILL & TIGHTEN TOOTH_CHART_ENTRIES.BRANCH_ID
 * ============================================================================
 * REVISED SPECIFICATION:
 * 1. Log security audit event when append-only trigger is disabled.
 * 2. Backfill ONLY verified treatment visit branch (treatment_id -> visits.branch_id).
 * 3. NO GUESSING: The "dentist's sole branch" tier is dropped. Any unresolved rows
 *    are left as NULL and audited/reported for clinic management manual review.
 * 4. Add CHECK (branch_id IS NOT NULL) NOT VALID to enforce on all future writes.
 * 5. Validate constraint if 0 NULLs remain; otherwise hold NOT VALID for manual review.
 * ============================================================================
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Audit trigger bypass before disabling
        DB::table('audit_logs')->insert([
            'public_id' => strtolower((string) Str::ulid()),
            'action' => 'security.trigger_bypass',
            'category' => 'security',
            'severity' => 'warning',
            'payload' => json_encode([
                'table' => 'tooth_chart_entries',
                'trigger' => 'tooth_chart_entries_append_only',
                'event' => 'disable_for_migration_backfill',
                'timestamp' => now()->toIso8601String(),
            ]),
            'created_at' => now(),
        ]);

        // Temporarily disable append-only trigger for migration backfill
        DB::statement('ALTER TABLE tooth_chart_entries DISABLE TRIGGER tooth_chart_entries_append_only');

        try {
            // Tier 1: Backfill exclusively from verified linked treatments
            DB::statement(<<<'SQL'
                UPDATE tooth_chart_entries tce
                SET branch_id = v.branch_id
                FROM treatments t
                JOIN visits v ON t.visit_id = v.id
                WHERE tce.treatment_id = t.id 
                  AND tce.branch_id IS NULL;
            SQL);
        } finally {
            // Always re-enable append-only trigger
            DB::statement('ALTER TABLE tooth_chart_entries ENABLE TRIGGER tooth_chart_entries_append_only');

            // Audit trigger re-enabled
            DB::table('audit_logs')->insert([
                'public_id' => strtolower((string) Str::ulid()),
                'action' => 'security.trigger_bypass',
                'category' => 'security',
                'severity' => 'info',
                'payload' => json_encode([
                    'table' => 'tooth_chart_entries',
                    'trigger' => 'tooth_chart_entries_append_only',
                    'event' => 're_enabled_after_migration_backfill',
                    'timestamp' => now()->toIso8601String(),
                ]),
                'created_at' => now(),
            ]);
        }

        // Tier 2: Audit and report remaining NULL rows without guessing.
        // NOTE: "Dentist's sole branch" is intentionally NOT automated here because clinicians
        // may rotate across branches; assigning sole branch requires explicit clinic review.
        $unresolved = DB::table('tooth_chart_entries')
            ->whereNull('branch_id')
            ->select('id', 'public_id', 'tooth', 'patient_id', 'dentist_profile_id', 'recorded_on')
            ->get();

        if ($unresolved->isNotEmpty()) {
            Log::warning(
                "tooth_chart_entries has {$unresolved->count()} legacy rows without resolved branch_id: " .
                $unresolved->map(fn ($r) => "[#{$r->id} tooth:{$r->tooth} dentist:{$r->dentist_profile_id}]")->implode(', ')
            );
        }

        // 3. Tighten: Add CHECK (branch_id IS NOT NULL) NOT VALID
        // Enforces non-null on all future inserts without locking historical rows
        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'tooth_chart_entries_branch_id_check'
                ) THEN
                    ALTER TABLE tooth_chart_entries 
                    ADD CONSTRAINT tooth_chart_entries_branch_id_check 
                    CHECK (branch_id IS NOT NULL) NOT VALID;
                END IF;
            END $$;
        SQL);

        // 4. If zero unresolved rows remain, validate the constraint
        if ($unresolved->isEmpty()) {
            DB::statement('ALTER TABLE tooth_chart_entries VALIDATE CONSTRAINT tooth_chart_entries_branch_id_check');
            Log::info('tooth_chart_entries_branch_id_check constraint validated successfully.');
        } else {
            Log::warning("tooth_chart_entries constraint tooth_chart_entries_branch_id_check left NOT VALID pending manual resolution of {$unresolved->count()} legacy rows.");
        }
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE tooth_chart_entries DROP CONSTRAINT IF EXISTS tooth_chart_entries_branch_id_check');
    }
};
