<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A2 "possible no-show": the scheduler flags a booked appointment with no check-in after the grace period. The flag is only a
 * hint for the front desk; the appointment's status changes only when a person confirms through the existing No-show
 * command. A flag is resolved once (confirmed, dismissed, or cleared because the patient arrived or the booking changed) and is
 * never deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('no_show_flags', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('appointment_id')->unique()->constrained('appointments')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->unsignedInteger('appointment_revision');
            $table->string('status', 20)->default('open');
            $table->timestampTz('flagged_at');
            $table->timestampTz('resolved_at')->nullable();
            $table->foreignId('resolved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->index(['branch_id', 'status']);
        });
        DB::statement("ALTER TABLE no_show_flags ADD CONSTRAINT no_show_flags_status_check CHECK (status IN ('open','confirmed','dismissed','cleared'))");
        DB::statement("ALTER TABLE no_show_flags ADD CONSTRAINT no_show_flags_resolution_check CHECK ((status = 'open') = (resolved_at IS NULL))");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION no_show_flags_guard() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'no_show_flags rows are never deleted'; END IF;
                IF OLD.status <> 'open' THEN RAISE EXCEPTION 'a resolved no-show flag cannot change'; END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER no_show_flags_guard BEFORE UPDATE OR DELETE ON no_show_flags
                FOR EACH ROW EXECUTE FUNCTION no_show_flags_guard();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('no_show_flags');
        DB::unprepared('DROP FUNCTION IF EXISTS no_show_flags_guard();');
    }
};
