<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M25 Patient Handovers. When a patient's care moves to another dentist or branch (R2-08), the sender writes a handover: a
 * summary, pending treatment, notes for the next dentist and references to existing documents of that patient. The receiving
 * branch's front desk and the receiving dentist acknowledge it. Sent → Acknowledged, or Sent → Cancelled by the sender. The
 * clinical text is encrypted and never shown to the patient or in the Owner's views (metadata only). Never deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_handovers', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('from_branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('to_branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('from_dentist_profile_id')->nullable()->constrained('dentist_profiles')->restrictOnDelete();
            $table->foreignId('to_dentist_profile_id')->nullable()->constrained('dentist_profiles')->restrictOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->text('summary');
            $table->text('pending_treatment')->nullable();
            $table->text('notes')->nullable();
            $table->jsonb('document_ids')->default(DB::raw("'[]'::jsonb"));
            $table->string('status', 14)->default('Sent');
            $table->foreignId('acknowledged_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('acknowledged_at')->nullable();
            $table->foreignId('cancelled_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampsTz();
            $table->index(['to_branch_id', 'status']);
            $table->index(['patient_id', 'status']);
        });
        DB::statement("ALTER TABLE patient_handovers ADD CONSTRAINT patient_handovers_status_check CHECK (status IN ('Sent','Acknowledged','Cancelled'))");
        DB::statement('ALTER TABLE patient_handovers ADD CONSTRAINT patient_handovers_target_check CHECK (to_branch_id <> from_branch_id OR to_dentist_profile_id IS DISTINCT FROM from_dentist_profile_id)');
        DB::statement("ALTER TABLE patient_handovers ADD CONSTRAINT patient_handovers_ack_check CHECK (status <> 'Acknowledged' OR acknowledged_at IS NOT NULL)");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION patient_handovers_no_delete() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'patient_handovers rows are never deleted; cancel them'; END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER patient_handovers_no_delete BEFORE DELETE ON patient_handovers FOR EACH ROW EXECUTE FUNCTION patient_handovers_no_delete();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_handovers');
        DB::unprepared('DROP FUNCTION IF EXISTS patient_handovers_no_delete();');
    }
};
