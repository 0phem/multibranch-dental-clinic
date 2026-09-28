<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// APPOINTMENT_HISTORY — append-only lifecycle record for M6 (created / rescheduled / cancelled). Each row
// snapshots the schedule it produced so a reschedule never erases where the appointment used to be. A trigger
// rejects UPDATE and DELETE so application code cannot rewrite history (CONTRACTS.md §12/§13). `event` values are
// the stable domain event names (appointment.created, ...), never module numbers.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointment_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained('appointments')->restrictOnDelete();
            $table->string('event');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->unsignedInteger('revision');
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role')->nullable();
            $table->string('assignment_rule_version')->nullable();
            $table->timestampTz('occurred_at');

            $table->index(['appointment_id', 'id']);
        });

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION appointment_history_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'appointment_history is append-only';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER appointment_history_no_update_delete
                BEFORE UPDATE OR DELETE ON appointment_history
                FOR EACH ROW EXECUTE FUNCTION appointment_history_append_only();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_history');
        DB::unprepared('DROP FUNCTION IF EXISTS appointment_history_append_only()');
    }
};
