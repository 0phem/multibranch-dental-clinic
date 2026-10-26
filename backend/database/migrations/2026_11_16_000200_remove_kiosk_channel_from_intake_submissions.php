<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * GEN-05: Remove kiosk channel from intake_submissions.
 *
 * Verifies that no kiosk rows exist before modifying the check constraint.
 * Preserves 'phone' and 'account' (which is set server-side).
 */
return new class extends Migration
{
    public function up(): void
    {
        $kioskCount = DB::table('intake_submissions')->where('channel', 'kiosk')->count();
        if ($kioskCount > 0) {
            throw new \RuntimeException("Cannot migrate: found {$kioskCount} intake_submissions row(s) with channel='kiosk'. Manual review required before removing kiosk channel constraint.");
        }

        DB::statement('ALTER TABLE intake_submissions DROP CONSTRAINT IF EXISTS intake_submissions_channel_check');
        DB::statement("ALTER TABLE intake_submissions ADD CONSTRAINT intake_submissions_channel_check CHECK (channel IN ('phone','account'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE intake_submissions DROP CONSTRAINT IF EXISTS intake_submissions_channel_check');
        DB::statement("ALTER TABLE intake_submissions ADD CONSTRAINT intake_submissions_channel_check CHECK (channel IN ('phone','kiosk','account'))");
    }
};
