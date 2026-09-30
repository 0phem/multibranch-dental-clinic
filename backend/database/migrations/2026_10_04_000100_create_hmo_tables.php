<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Minimal server-authoritative M12 (HMO) foundation — the facts M11 needs before it may issue a bill or record money.
// Not the full M12 module: no provider directory, no documents (M14), no delivery (M18), no automation (M23).
//
// PATIENT_HMO_MEMBERSHIPS: at most one ACTIVE membership per Patient; a change ends the active row and adds a new one,
// so history is kept. Provider name and member number are Staff-entered text (no provider directory, no seeded
// providers).
//
// HMO_CASES: zero or one case per Visit (UNIQUE visit_id); Patient and branch equal the Visit's (trigger). Provider and
// member number are snapshots of the membership the case was opened from. Statuses follow CONTRACTS.md §8 plus the
// terminal pre-submission `Withdrawn` (no claim / self-pay). `approved_amount` exists exactly when Approved; final
// cases (Approved / Rejected / Withdrawn) are read-only. Legacy `Draft` is never created by the server.
//
// HMO_CASE_REQUIREMENTS: the three project requirement rules as domain rows (metadata label only — never a file).
// HMO_CASE_EVENTS: append-only case history; one submission and one response per case per submission cycle.
// Browser HMO records are never migrated here (CONTRACTS.md §8, cutover procedure in BACKEND_INTEGRATION.md).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_hmo_memberships', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->string('provider_name', 120);
            $table->string('member_number', 80);
            $table->string('status');
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at');
            $table->timestampTz('ended_at')->nullable();
            $table->foreignId('ended_by_user_id')->nullable()->constrained('users')->restrictOnDelete();

            $table->index(['patient_id', 'id']);
        });
        DB::statement("ALTER TABLE patient_hmo_memberships ADD CONSTRAINT hmo_memberships_status_check CHECK (status IN ('active','ended'))");
        DB::statement("ALTER TABLE patient_hmo_memberships ADD CONSTRAINT hmo_memberships_ended_check CHECK ((status = 'ended') = (ended_at IS NOT NULL) AND (ended_at IS NULL) = (ended_by_user_id IS NULL))");
        DB::statement("ALTER TABLE patient_hmo_memberships ADD CONSTRAINT hmo_memberships_text_check CHECK (length(btrim(provider_name)) > 0 AND length(btrim(member_number)) > 0)");
        DB::statement("CREATE UNIQUE INDEX hmo_memberships_one_active_per_patient ON patient_hmo_memberships (patient_id) WHERE status = 'active'");

        Schema::create('hmo_cases', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('visit_id')->unique()->constrained('visits')->restrictOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('membership_id')->constrained('patient_hmo_memberships')->restrictOnDelete();
            $table->string('provider_name', 120);
            $table->string('member_number', 80);
            $table->string('status');
            $table->unsignedInteger('submission_cycle')->default(0);
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('escalated_at')->nullable();
            $table->timestampTz('final_at')->nullable();
            $table->decimal('approved_amount', 12, 2)->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->index(['branch_id', 'status']);
            $table->index(['patient_id']);
        });
        DB::statement("ALTER TABLE hmo_cases ADD CONSTRAINT hmo_cases_status_check CHECK (status IN ('Missing Requirements','Ready for Submission','Pending','Escalated','Returned','Approved','Rejected','Withdrawn'))");
        DB::statement("ALTER TABLE hmo_cases ADD CONSTRAINT hmo_cases_approved_amount_check CHECK ((status = 'Approved') = (approved_amount IS NOT NULL) AND (approved_amount IS NULL OR approved_amount >= 0))");
        DB::statement("ALTER TABLE hmo_cases ADD CONSTRAINT hmo_cases_final_check CHECK ((status IN ('Approved','Rejected','Withdrawn')) = (final_at IS NOT NULL))");
        DB::statement("ALTER TABLE hmo_cases ADD CONSTRAINT hmo_cases_submission_check CHECK ((submission_cycle = 0) = (submitted_at IS NULL) AND (status NOT IN ('Pending','Escalated','Returned','Approved','Rejected') OR submission_cycle > 0) AND (status <> 'Withdrawn' OR submission_cycle = 0))");
        DB::statement("ALTER TABLE hmo_cases ADD CONSTRAINT hmo_cases_escalated_check CHECK (status <> 'Escalated' OR escalated_at IS NOT NULL)");

        Schema::create('hmo_case_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hmo_case_id')->constrained('hmo_cases')->restrictOnDelete();
            $table->string('rule_key');
            $table->string('state');
            $table->string('document_label', 200)->nullable();
            $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('validated_at')->nullable();
            $table->timestampsTz();

            $table->unique(['hmo_case_id', 'rule_key']);
        });
        DB::statement("ALTER TABLE hmo_case_requirements ADD CONSTRAINT hmo_requirements_rule_check CHECK (rule_key IN ('hmo-card','valid-id','treatment-request'))");
        DB::statement("ALTER TABLE hmo_case_requirements ADD CONSTRAINT hmo_requirements_state_check CHECK (state IN ('Missing','Validated'))");
        DB::statement("ALTER TABLE hmo_case_requirements ADD CONSTRAINT hmo_requirements_validated_check CHECK ((state = 'Validated') = (validated_at IS NOT NULL))");

        Schema::create('hmo_case_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hmo_case_id')->constrained('hmo_cases')->restrictOnDelete();
            $table->string('kind');
            $table->unsignedInteger('submission_cycle');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->unsignedInteger('revision');
            $table->string('method')->nullable();
            $table->text('note')->nullable();
            $table->text('next_action')->nullable();
            $table->string('provider_reference', 120)->nullable();
            $table->string('outcome')->nullable();
            $table->decimal('approved_amount', 12, 2)->nullable();
            $table->jsonb('rule_keys')->nullable();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role')->nullable();
            $table->timestampTz('occurred_at');

            $table->index(['hmo_case_id', 'id']);
        });
        DB::statement("ALTER TABLE hmo_case_events ADD CONSTRAINT hmo_events_kind_check CHECK (kind IN ('created','requirement','submission','contact','escalation','response','withdrawal'))");
        DB::statement("ALTER TABLE hmo_case_events ADD CONSTRAINT hmo_events_outcome_check CHECK ((kind = 'response') = (outcome IS NOT NULL) AND (outcome IS NULL OR outcome IN ('Approved','Rejected','Returned')) AND ((outcome = 'Approved') = (approved_amount IS NOT NULL)))");
        DB::statement("CREATE UNIQUE INDEX hmo_events_one_submission_per_cycle ON hmo_case_events (hmo_case_id, submission_cycle) WHERE kind = 'submission'");
        DB::statement("CREATE UNIQUE INDEX hmo_events_one_response_per_cycle ON hmo_case_events (hmo_case_id, submission_cycle) WHERE kind = 'response'");

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION hmo_case_events_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'hmo_case_events is append-only';
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER hmo_case_events_no_update_delete
                BEFORE UPDATE OR DELETE ON hmo_case_events
                FOR EACH ROW EXECUTE FUNCTION hmo_case_events_append_only();

            -- A membership is never deleted; the only change is ending an active row (nothing else may change).
            CREATE OR REPLACE FUNCTION hmo_memberships_history() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'patient_hmo_memberships keeps history; rows are never deleted';
                END IF;
                IF OLD.status <> 'active' OR NEW.status <> 'ended'
                    OR NEW.public_id <> OLD.public_id OR NEW.patient_id <> OLD.patient_id OR NEW.provider_name <> OLD.provider_name
                    OR NEW.member_number <> OLD.member_number OR NEW.created_by_user_id <> OLD.created_by_user_id OR NEW.created_at <> OLD.created_at THEN
                    RAISE EXCEPTION 'an HMO membership can only be ended; start a new membership to change it';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER hmo_memberships_history
                BEFORE UPDATE OR DELETE ON patient_hmo_memberships
                FOR EACH ROW EXECUTE FUNCTION hmo_memberships_history();

            -- Cases are never deleted, final cases never change, and the Visit/Patient/branch anchor never moves.
            CREATE OR REPLACE FUNCTION hmo_cases_guard() RETURNS trigger AS $$
            DECLARE
                v_patient bigint;
                v_branch bigint;
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'hmo_cases are never deleted';
                END IF;
                IF TG_OP = 'UPDATE' THEN
                    IF OLD.status IN ('Approved','Rejected','Withdrawn') THEN
                        RAISE EXCEPTION 'a final HMO case is read-only';
                    END IF;
                    IF NEW.visit_id <> OLD.visit_id OR NEW.membership_id <> OLD.membership_id OR NEW.provider_name <> OLD.provider_name
                        OR NEW.member_number <> OLD.member_number OR NEW.public_id <> OLD.public_id THEN
                        RAISE EXCEPTION 'an HMO case keeps its Visit and membership snapshot';
                    END IF;
                END IF;
                SELECT patient_id, branch_id INTO v_patient, v_branch FROM visits WHERE id = NEW.visit_id;
                IF NEW.patient_id IS DISTINCT FROM v_patient OR NEW.branch_id IS DISTINCT FROM v_branch THEN
                    RAISE EXCEPTION 'an HMO case must match its Visit''s Patient and branch';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER hmo_cases_guard
                BEFORE INSERT OR UPDATE OR DELETE ON hmo_cases
                FOR EACH ROW EXECUTE FUNCTION hmo_cases_guard();

            -- Requirement rows of a final case are read-only and rows are never deleted.
            CREATE OR REPLACE FUNCTION hmo_requirements_guard() RETURNS trigger AS $$
            DECLARE
                parent_status text;
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'hmo_case_requirements are never deleted';
                END IF;
                SELECT status INTO parent_status FROM hmo_cases WHERE id = NEW.hmo_case_id;
                IF TG_OP = 'UPDATE' AND (parent_status IN ('Approved','Rejected','Withdrawn') OR NEW.rule_key <> OLD.rule_key OR NEW.hmo_case_id <> OLD.hmo_case_id) THEN
                    RAISE EXCEPTION 'HMO requirements of a final case are read-only';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER hmo_requirements_guard
                BEFORE UPDATE OR DELETE ON hmo_case_requirements
                FOR EACH ROW EXECUTE FUNCTION hmo_requirements_guard();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('hmo_case_events');
        Schema::dropIfExists('hmo_case_requirements');
        Schema::dropIfExists('hmo_cases');
        Schema::dropIfExists('patient_hmo_memberships');
        DB::unprepared(<<<'SQL'
            DROP FUNCTION IF EXISTS hmo_case_events_append_only();
            DROP FUNCTION IF EXISTS hmo_memberships_history();
            DROP FUNCTION IF EXISTS hmo_cases_guard();
            DROP FUNCTION IF EXISTS hmo_requirements_guard();
        SQL);
    }
};
