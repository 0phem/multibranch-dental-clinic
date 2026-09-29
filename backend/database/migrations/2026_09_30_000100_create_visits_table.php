<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// VISITS — the shared Visit / Clinical Encounter (CONTRACTS.md §3). Not a numbered module: M8 opens a Visit at
// arrival (scheduled Check-In or Walk-In); M9 Queue, M5 Treatment and later M19/M11/M12 reference the Visit, so the
// Visit stores no queue, treatment or invoice id. The appointment (M6) stays the scheduling truth; a Visit only points
// at it (walk-ins have none) and never copies its times.
//
// Integrity is enforced by PostgreSQL, not only by VisitService:
//   - source 'appointment' <=> appointment_id present; 'walk_in' <=> no appointment (no fake appointments);
//   - one Visit per appointment, ever;
//   - at most one ACTIVE Visit (Checked In / In Treatment) per Patient, across all branches and days;
//   - closed_at is set exactly when the Visit is Completed.
// clinic_date is the Asia/Manila business date of arrived_at, written by the command (ClinicClock) in the same
// transaction.
//
// VISIT_HISTORY is append-only (trigger), like APPOINTMENT_HISTORY. COMMAND_KEYS stores Idempotency-Key results for
// the M8 commands (Visit Check-In, Walk-In, Visit transitions and front-desk Patient registration).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->restrictOnDelete();
            $table->string('source');
            $table->string('status');
            // Nullable by design (CONTRACTS.md §3): must be resolved before any Dentist-authorized clinical action.
            $table->foreignId('responsible_dentist_profile_id')->nullable()->constrained('dentist_profiles')->restrictOnDelete();
            // Walk-in reason/service context. A scheduled Visit reads its service from the appointment.
            $table->foreignId('requested_service_id')->nullable()->constrained('services')->restrictOnDelete();
            $table->timestampTz('arrived_at');
            $table->date('clinic_date');
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('closed_at')->nullable();
            $table->timestampsTz();

            $table->index(['branch_id', 'clinic_date']);
            $table->index(['responsible_dentist_profile_id', 'clinic_date']);
            $table->index(['patient_id', 'clinic_date']);
        });

        DB::statement("ALTER TABLE visits ADD CONSTRAINT visits_status_check CHECK (status IN ('Checked In','In Treatment','Completed'))");
        DB::statement("ALTER TABLE visits ADD CONSTRAINT visits_source_check CHECK (source IN ('appointment','walk_in'))");
        DB::statement("ALTER TABLE visits ADD CONSTRAINT visits_source_appointment_check CHECK ((source = 'appointment') = (appointment_id IS NOT NULL))");
        DB::statement("ALTER TABLE visits ADD CONSTRAINT visits_closed_check CHECK ((status = 'Completed') = (closed_at IS NOT NULL))");
        DB::statement('CREATE UNIQUE INDEX visits_one_per_appointment ON visits (appointment_id) WHERE appointment_id IS NOT NULL');
        DB::statement("CREATE UNIQUE INDEX visits_one_active_per_patient ON visits (patient_id) WHERE status IN ('Checked In','In Treatment')");

        Schema::create('visit_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->constrained('visits')->restrictOnDelete();
            $table->string('event');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->unsignedInteger('revision');
            $table->foreignId('responsible_dentist_profile_id')->nullable()->constrained('dentist_profiles')->restrictOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role')->nullable();
            $table->timestampTz('occurred_at');

            $table->index(['visit_id', 'id']);
        });

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION visit_history_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'visit_history is append-only';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER visit_history_no_update_delete
                BEFORE UPDATE OR DELETE ON visit_history
                FOR EACH ROW EXECUTE FUNCTION visit_history_append_only();
        SQL);

        Schema::create('command_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('idempotency_key', 255);
            $table->string('command');
            $table->char('request_hash', 64);
            $table->unsignedSmallInteger('response_status')->nullable();
            // json (not jsonb) keeps the stored response byte-for-byte, so a replay is the original result.
            $table->json('response_body')->nullable();
            $table->timestampTz('created_at');

            $table->unique(['user_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('command_keys');
        Schema::dropIfExists('visit_history');
        DB::unprepared('DROP FUNCTION IF EXISTS visit_history_append_only()');
        Schema::dropIfExists('visits');
    }
};
