<?php

use App\Services\Treatments\TreatmentCutover;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M5 Treatment & Clinical Workflow. The Treatment is the authoritative clinical record of ONE Visit (CONTRACTS.md §3):
// Visit -> zero or one Treatment -> procedure lines. Patient, branch, appointment and clinic date are read from the Visit
// and never copied here. Pricing and money belong to M13/M11: no fee, amount or subtotal column exists in M5.
//
// PostgreSQL enforces:
//   - one Treatment per Visit (UNIQUE visit_id);
//   - at most one In Treatment Treatment per Dentist at a time (partial unique index; not a per-day rule);
//   - completed_at is set exactly when the Treatment is Completed;
//   - follow-up recommendation fields only when the Dentist marked a follow-up as required;
//   - a Completed Treatment and its procedure lines are read-only (amendments are unresolved policy P6);
//   - a procedure line's service and its code/name snapshot never change (a changed service is a new line);
//   - Visit/Treatment consistency at commit (deferred constraint triggers): a Visit In Treatment has an In Treatment
//     Treatment, a Visit is never Completed while its Treatment is still active, and a Treatment's status follows its Visit.
// TREATMENT_HISTORY is append-only (trigger) and snapshots the documentation and procedure lines of every committed
// revision. It is M5 clinical history, not the future M22 organisation-wide audit trail.
//
// Cutover (decision Q-T8): nothing is backfilled and no empty Treatment shell is created. The migration refuses to run
// while any Visit is In Treatment, because such a Visit has no server Treatment and none may be fabricated.
return new class extends Migration
{
    public function up(): void
    {
        TreatmentCutover::assertReady();

        Schema::create('treatments', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('visit_id')->unique()->constrained('visits')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->string('status');
            $table->text('chief_complaint')->nullable();
            $table->text('treatment_plan')->nullable();
            $table->text('procedure_summary')->nullable();
            $table->text('clinical_notes')->nullable();
            // Snapshot of the Dentist profile's assistant when treatment started (nullable: none assigned).
            $table->foreignId('assistant_staff_profile_id')->nullable()->constrained('staff_profiles')->restrictOnDelete();
            $table->boolean('prescription_required')->default(false);
            $table->boolean('followup_required')->default(false);
            $table->date('followup_recommended_date')->nullable();
            $table->text('followup_reason')->nullable();
            $table->string('followup_interval')->nullable();
            $table->timestampTz('started_at');
            $table->timestampTz('completed_at')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['dentist_profile_id', 'status']);
        });

        DB::statement("ALTER TABLE treatments ADD CONSTRAINT treatments_status_check CHECK (status IN ('In Treatment','Completed'))");
        DB::statement("ALTER TABLE treatments ADD CONSTRAINT treatments_completed_check CHECK ((status = 'Completed') = (completed_at IS NOT NULL))");
        DB::statement('ALTER TABLE treatments ADD CONSTRAINT treatments_followup_check CHECK (followup_required OR (followup_recommended_date IS NULL AND followup_reason IS NULL AND followup_interval IS NULL))');
        DB::statement("CREATE UNIQUE INDEX treatments_one_active_per_dentist ON treatments (dentist_profile_id) WHERE status = 'In Treatment'");

        Schema::create('treatment_procedures', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('treatment_id')->constrained('treatments')->restrictOnDelete();
            $table->unsignedInteger('line_no');
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->text('notes')->nullable();
            // Historical display facts of the canonical service when the line was recorded. No price is copied.
            $table->string('service_code');
            $table->string('service_name');
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE treatment_procedures ADD CONSTRAINT treatment_procedures_quantity_check CHECK (quantity >= 1)');
        DB::statement('ALTER TABLE treatment_procedures ADD CONSTRAINT treatment_procedures_line_no_check CHECK (line_no >= 1)');
        // Deferred, so a documentation save may renumber retained lines inside one transaction.
        DB::statement('ALTER TABLE treatment_procedures ADD CONSTRAINT treatment_procedures_line_unique UNIQUE (treatment_id, line_no) DEFERRABLE INITIALLY DEFERRED');

        Schema::create('treatment_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_id')->constrained('treatments')->restrictOnDelete();
            $table->string('event');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->unsignedInteger('revision');
            $table->jsonb('snapshot');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role')->nullable();
            $table->timestampTz('occurred_at');

            $table->index(['treatment_id', 'id']);
        });

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION treatment_history_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'treatment_history is append-only';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER treatment_history_no_update_delete
                BEFORE UPDATE OR DELETE ON treatment_history
                FOR EACH ROW EXECUTE FUNCTION treatment_history_append_only();

            CREATE OR REPLACE FUNCTION treatment_completed_read_only() RETURNS trigger AS $$
            BEGIN
                IF OLD.status = 'Completed' THEN
                    RAISE EXCEPTION 'a Completed treatment is read-only';
                END IF;
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'treatments are never deleted';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER treatments_completed_read_only
                BEFORE UPDATE OR DELETE ON treatments
                FOR EACH ROW EXECUTE FUNCTION treatment_completed_read_only();

            CREATE OR REPLACE FUNCTION treatment_procedure_guard() RETURNS trigger AS $$
            DECLARE
                parent_status text;
            BEGIN
                SELECT status INTO parent_status FROM treatments
                    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.treatment_id ELSE NEW.treatment_id END;
                IF parent_status = 'Completed' THEN
                    RAISE EXCEPTION 'the procedure lines of a Completed treatment are read-only';
                END IF;
                IF TG_OP = 'UPDATE' AND (NEW.public_id <> OLD.public_id OR NEW.treatment_id <> OLD.treatment_id
                    OR NEW.service_id <> OLD.service_id OR NEW.service_code <> OLD.service_code OR NEW.service_name <> OLD.service_name) THEN
                    RAISE EXCEPTION 'a procedure line keeps its identity, service and service snapshot';
                END IF;
                IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER treatment_procedures_guard
                BEFORE INSERT OR UPDATE OR DELETE ON treatment_procedures
                FOR EACH ROW EXECUTE FUNCTION treatment_procedure_guard();

            CREATE OR REPLACE FUNCTION visit_treatment_consistency() RETURNS trigger AS $$
            BEGIN
                IF NEW.status = 'In Treatment' AND NOT EXISTS (
                    SELECT 1 FROM treatments WHERE visit_id = NEW.id AND status = 'In Treatment') THEN
                    RAISE EXCEPTION 'visit % is In Treatment without an In Treatment treatment', NEW.public_id;
                END IF;
                IF NEW.status = 'Completed' AND EXISTS (
                    SELECT 1 FROM treatments WHERE visit_id = NEW.id AND status <> 'Completed') THEN
                    RAISE EXCEPTION 'visit % is Completed while its treatment is still active', NEW.public_id;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE CONSTRAINT TRIGGER visits_treatment_consistency
                AFTER INSERT OR UPDATE OF status ON visits
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION visit_treatment_consistency();

            CREATE OR REPLACE FUNCTION treatment_visit_consistency() RETURNS trigger AS $$
            DECLARE
                visit_status text;
            BEGIN
                SELECT status INTO visit_status FROM visits WHERE id = NEW.visit_id;
                IF visit_status IS DISTINCT FROM NEW.status THEN
                    RAISE EXCEPTION 'treatment % is % but its visit is %', NEW.public_id, NEW.status, visit_status;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE CONSTRAINT TRIGGER treatments_visit_consistency
                AFTER INSERT OR UPDATE OF status ON treatments
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION treatment_visit_consistency();
        SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            DROP TRIGGER IF EXISTS visits_treatment_consistency ON visits;
            DROP FUNCTION IF EXISTS visit_treatment_consistency();
        SQL);
        Schema::dropIfExists('treatment_history');
        Schema::dropIfExists('treatment_procedures');
        Schema::dropIfExists('treatments');
        DB::unprepared(<<<'SQL'
            DROP FUNCTION IF EXISTS treatment_history_append_only();
            DROP FUNCTION IF EXISTS treatment_completed_read_only();
            DROP FUNCTION IF EXISTS treatment_procedure_guard();
            DROP FUNCTION IF EXISTS treatment_visit_consistency();
        SQL);
    }
};
