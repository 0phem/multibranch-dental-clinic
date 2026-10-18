<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M2: opening hours per weekday, because weekday, Saturday and Sunday hours differ. `weekly_hours` maps an ISO weekday
 * ("1" = Monday … "7" = Sunday) to {"open": "HH:MM", "close": "HH:MM"}; a weekday that is missing is closed. NULL keeps the
 * older single open_time/close_time on operating_days. Schema only: no data is set here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->jsonb('weekly_hours')->nullable()->after('close_time');
        });
        DB::statement("ALTER TABLE branches ADD CONSTRAINT branches_weekly_hours_check CHECK (weekly_hours IS NULL OR jsonb_typeof(weekly_hours) = 'object')");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_weekly_hours_check');
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn('weekly_hours');
        });
    }
};
