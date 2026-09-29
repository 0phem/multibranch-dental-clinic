<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M9 Patient Queue Management. The queue is anchored to the Visit (CONTRACTS.md §3): a queue entry requires exactly one
// Visit and derives Patient, branch, arrival time, service and appointment from it — none of those are copied here.
//
// DENTIST_QUEUES is the ERD's per-branch / per-Dentist / per-clinic-day container and the atomic queue-number counter
// (`next_number` = the last number issued; the first entry of a new queue gets 1). QUEUE_ENTRIES holds the queue state:
// Waiting, Called, Treatment Ready, Temporarily Away and the terminal Served (the Patient left the waiting queue because
// treatment started — it does not mean the Visit is Completed). There is deliberately no In Treatment, Completed or
// No-show queue state: the Visit owns the clinical lifecycle and the appointment owns the pre-arrival No-show.
//
// PostgreSQL enforces: one queue entry per Visit; unique queue numbers per Dentist queue; numbers start at 1;
// closed_at is set exactly when the entry is Served. Many active entries may share one Dentist queue.
// QUEUE_ENTRY_HISTORY is append-only (trigger), like the appointment and Visit histories.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dentist_queues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->date('clinic_date');
            $table->unsignedInteger('next_number')->default(0);
            $table->timestampsTz();

            $table->unique(['branch_id', 'dentist_profile_id', 'clinic_date']);
        });

        Schema::create('queue_entries', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('visit_id')->unique()->constrained('visits')->restrictOnDelete();
            $table->foreignId('dentist_queue_id')->constrained('dentist_queues')->restrictOnDelete();
            $table->unsignedInteger('queue_number');
            $table->string('status');
            $table->string('priority')->default('Normal');
            $table->text('priority_reason')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->timestampTz('closed_at')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->unique(['dentist_queue_id', 'queue_number']);
        });

        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_status_check CHECK (status IN ('Waiting','Called','Treatment Ready','Temporarily Away','Served'))");
        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_priority_check CHECK (priority IN ('Normal','Priority','Urgent'))");
        DB::statement('ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_number_check CHECK (queue_number >= 1)');
        DB::statement("ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_closed_check CHECK ((status = 'Served') = (closed_at IS NOT NULL))");
        // A plain (non-unique) index: a Dentist queue holds many active entries at once.
        DB::statement("CREATE INDEX queue_entries_active_by_queue ON queue_entries (dentist_queue_id) WHERE status <> 'Served'");

        Schema::create('queue_entry_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('queue_entry_id')->constrained('queue_entries')->restrictOnDelete();
            $table->string('event');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->string('from_priority')->nullable();
            $table->string('to_priority');
            $table->text('priority_reason')->nullable();
            $table->unsignedInteger('revision');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role')->nullable();
            $table->timestampTz('occurred_at');

            $table->index(['queue_entry_id', 'id']);
        });

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION queue_entry_history_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'queue_entry_history is append-only';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER queue_entry_history_no_update_delete
                BEFORE UPDATE OR DELETE ON queue_entry_history
                FOR EACH ROW EXECUTE FUNCTION queue_entry_history_append_only();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('queue_entry_history');
        DB::unprepared('DROP FUNCTION IF EXISTS queue_entry_history_append_only()');
        Schema::dropIfExists('queue_entries');
        Schema::dropIfExists('dentist_queues');
    }
};
