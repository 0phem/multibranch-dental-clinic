<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Backfills tooth_chart_entries.branch_id from linked treatments and patient preferences.
 * Safely disables the append-only trigger during the backfill, re-enables it immediately,
 * and reports the remaining NULL count without guessing fallback branch IDs.
 *
 * NOTE: The CHECK (branch_id IS NOT NULL) NOT VALID tightening constraint has been split
 * out to docs/pending/draft_tighten_tooth_chart_branch.php to ship with the DentalChartController fix.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Temporarily disable append-only trigger for migration backfill
        DB::statement('ALTER TABLE tooth_chart_entries DISABLE TRIGGER tooth_chart_entries_append_only');

        try {
            // 2. Backfill from linked treatments and clinical encounters
            DB::statement(<<<'SQL'
                UPDATE tooth_chart_entries tce
                SET branch_id = v.branch_id
                FROM treatments t
                JOIN visits v ON t.visit_id = v.id
                WHERE tce.treatment_id = t.id AND tce.branch_id IS NULL;
            SQL);

            // 3. Backfill unlinked rows where patient has a verified preferred branch
            DB::statement(<<<'SQL'
                UPDATE tooth_chart_entries tce
                SET branch_id = p.preferred_branch_id
                FROM patients p
                WHERE tce.patient_id = p.id 
                  AND tce.treatment_id IS NULL 
                  AND tce.branch_id IS NULL 
                  AND p.preferred_branch_id IS NOT NULL;
            SQL);
        } finally {
            // 4. Always re-enable trigger regardless of outcome
            DB::statement('ALTER TABLE tooth_chart_entries ENABLE TRIGGER tooth_chart_entries_append_only');
        }

        // 5. Audit remaining NULL rows
        $nullCount = DB::table('tooth_chart_entries')->whereNull('branch_id')->count();
        if ($nullCount > 0) {
            Log::warning("tooth_chart_entries has {$nullCount} rows without resolved branch_id after backfill.");
        }
    }

    public function down(): void
    {
        // Data backfill cannot be reversed destructively.
    }
};
