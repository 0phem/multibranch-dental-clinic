<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F5 closed and holiday dates (R2-13: "closed and holiday dates should be grayed out"). The Owner closes a date for one branch or
 * every branch (branch_id NULL), with an optional reason and optional partial hours (open only between open_time and close_time).
 * Philippine holidays may be added as SUGGESTIONS (status 'suggested'): they change nothing until the Owner confirms each one.
 * A closure never cancels an appointment: the front desk sees the affected appointments and may email those patients a
 * reschedule link. Removing a closure keeps the row (status 'removed'); rows are never deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branch_closures', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->date('closed_on');
            $table->string('reason', 120)->nullable();
            $table->time('open_time')->nullable();
            $table->time('close_time')->nullable();
            $table->string('status', 20)->default('active');
            $table->string('source', 20)->default('owner');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('patients_notified_at')->nullable();
            $table->timestampsTz();
            $table->index(['closed_on', 'status']);
        });
        DB::statement("ALTER TABLE branch_closures ADD CONSTRAINT branch_closures_status_check CHECK (status IN ('active','suggested','removed','dismissed'))");
        DB::statement("ALTER TABLE branch_closures ADD CONSTRAINT branch_closures_source_check CHECK (source IN ('owner','holiday_suggestion'))");
        DB::statement('ALTER TABLE branch_closures ADD CONSTRAINT branch_closures_hours_check CHECK ((open_time IS NULL) = (close_time IS NULL) AND (open_time IS NULL OR close_time > open_time))');
        // One effective closure per branch (or for all branches) and date.
        DB::statement("CREATE UNIQUE INDEX branch_closures_one_active ON branch_closures (COALESCE(branch_id, 0), closed_on) WHERE status IN ('active','suggested')");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION branch_closures_no_delete() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'branch_closures rows are never deleted; remove the closure instead';
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER branch_closures_no_delete BEFORE DELETE ON branch_closures
                FOR EACH ROW EXECUTE FUNCTION branch_closures_no_delete();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_closures');
        DB::unprepared('DROP FUNCTION IF EXISTS branch_closures_no_delete();');
    }
};
