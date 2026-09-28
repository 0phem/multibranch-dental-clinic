<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// APPOINTMENTS (M6). Canonical relationships only: patients, branches, services and dentist_profiles are
// referenced by foreign key, never copied as display text. An appointment exists before any Visit (M8), so there
// is no visit foreign key here.
//
// Concurrency is enforced by PostgreSQL, not only by the application validator: two exclusion constraints make
// it impossible for two active appointments to overlap for the same Dentist or the same Patient, even when two
// requests validate at the same moment. They need the btree_gist extension (bundled with PostgreSQL contrib;
// creating it requires a role allowed to CREATE EXTENSION — see BACKEND_INTEGRATION.md). Active statuses are the
// non-terminal ones; Completed/Cancelled/No-show never occupy time (same TERMINAL list as src/contracts.js).
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');

        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            // Snapshot of the service duration applied at booking time, so a later catalog change never rewrites
            // an existing appointment.
            $table->unsignedSmallInteger('duration_minutes');
            $table->string('status');
            $table->string('source');
            $table->string('assignment_method');
            $table->string('assignment_rule_version')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->text('notes')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampsTz();

            $table->index(['branch_id', 'starts_at']);
            $table->index(['patient_id', 'starts_at']);
            $table->index(['dentist_profile_id', 'starts_at']);
        });

        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('Pending','Confirmed','Checked In','In Treatment','Completed','Cancelled','No-show'))");
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_source_check CHECK (source IN ('patient_portal','front_desk'))");
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_assignment_method_check CHECK (assignment_method IN ('auto','selected'))");
        DB::statement('ALTER TABLE appointments ADD CONSTRAINT appointments_time_order_check CHECK (ends_at > starts_at)');
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_no_dentist_overlap EXCLUDE USING gist (dentist_profile_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status IN ('Pending','Confirmed','Checked In','In Treatment'))");
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_no_patient_overlap EXCLUDE USING gist (patient_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status IN ('Pending','Confirmed','Checked In','In Treatment'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
        // btree_gist is intentionally left installed: other objects may depend on it and dropping an extension
        // is not this migration's decision.
    }
};
