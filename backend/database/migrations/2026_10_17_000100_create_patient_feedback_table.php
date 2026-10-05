<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M26 Patient Feedback & Service Quality — a deliberately narrow technical FOUNDATION.
//   Established by the repository: M26 owns "authoritative Patient feedback … records tied to legitimate completed Visits"
//   (MODULE_COVERAGE.md). Everything else in the document is an "intended lifecycle", not an approved rule, so NOTHING else is modelled:
//   no rating, category, anonymity, review status, reply, publication flag, marketing consent or one-per-Visit rule.
//   A feedback row is a factual, IMMUTABLE record (trigger): the authenticated Patient, one of that Patient's own COMPLETED Visits,
//   free text, and a server timestamp. Multiplicity per Visit is unresolved policy, so there is no uniqueness on visit_id — duplicate
//   REQUESTS are prevented by the shared Idempotency-Key, never by matching text.
//   RESTRICT everywhere: no deletion of a Patient or Visit can erase feedback (no retention period exists: RETENTION POLICY REQUIRED).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_feedback', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('visit_id')->constrained('visits')->restrictOnDelete();
            $table->text('body');
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['patient_id', 'id']);
            $table->index('id');
        });
        DB::statement('ALTER TABLE patient_feedback ADD CONSTRAINT patient_feedback_body_check CHECK (length(btrim(body)) > 0 AND length(body) <= 4000)');
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION patient_feedback_immutable() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'submitted patient feedback is immutable';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER patient_feedback_no_update_delete
                BEFORE UPDATE OR DELETE ON patient_feedback
                FOR EACH ROW EXECUTE FUNCTION patient_feedback_immutable();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_feedback');
        DB::unprepared('DROP FUNCTION IF EXISTS patient_feedback_immutable();');
    }
};
