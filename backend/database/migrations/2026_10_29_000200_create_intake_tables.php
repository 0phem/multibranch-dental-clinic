<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Registration intake (interview R2-03, R2-05, R2-08, R2-12): patients register on their own phone at the counter instead of a
 * paper form that staff retype; staff confirm or correct; a parent or guardian registers and manages dependents.
 *
 *  branch_join_codes   the code on the front-desk screen that changes every clinic day (and when staff refresh it): joining
 *                      today's queue needs it, so nobody can join from home.
 *  intake_submissions  what a patient filled in at the counter (encrypted), waiting for staff to confirm or correct. Staff then
 *                      use an existing record (never auto-merged) or create a new one. No ID image and no ID number is stored:
 *                      only which ID type was scanned and which fields the scan prefilled.
 *  patient_guardians   a guardian's link to a dependent (a child or someone in their care), with the guardian's consent. It ends
 *                      (never deleted) when the dependent claims their own account at 18, or when Staff unlink it.
 *  patients.*          how the record was registered, and the in-person ID check: ID type, by whom and when; the last 4
 *                      characters only if the Owner turns that on. Never the full ID number, never the image.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branch_join_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->date('clinic_date');
            $table->string('code', 8);
            $table->boolean('active')->default(true);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });
        DB::statement('CREATE UNIQUE INDEX branch_join_codes_one_active ON branch_join_codes (branch_id, clinic_date) WHERE active');

        Schema::create('intake_submissions', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->string('reference', 12)->unique();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->string('channel', 10);
            $table->text('data')->nullable(); // encrypted JSON: the form (person, emergency contact, dependents)
            $table->string('id_type', 30)->nullable();
            $table->jsonb('scanned_fields')->default(DB::raw("'[]'::jsonb"));
            $table->boolean('join_queue')->default(false);
            $table->string('visit_for', 40)->default('self');
            $table->foreignId('account_patient_id')->nullable()->constrained('patients')->restrictOnDelete();
            $table->string('status', 20)->default('pending');
            $table->foreignId('patient_id')->nullable()->constrained('patients')->restrictOnDelete();
            $table->foreignId('visit_id')->nullable()->constrained('visits')->restrictOnDelete();
            $table->foreignId('confirmed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('confirmed_at')->nullable();
            $table->timestampTz('consent_at');
            $table->string('consent_version', 20);
            $table->char('device_hash', 64)->nullable();
            $table->timestampsTz();
            $table->index(['branch_id', 'status', 'created_at']);
        });
        DB::statement("ALTER TABLE intake_submissions ADD CONSTRAINT intake_submissions_channel_check CHECK (channel IN ('phone','kiosk','account'))");
        DB::statement("ALTER TABLE intake_submissions ADD CONSTRAINT intake_submissions_status_check CHECK (status IN ('pending','confirmed','cancelled','expired'))");
        DB::statement("ALTER TABLE intake_submissions ADD CONSTRAINT intake_submissions_form_check CHECK ((channel = 'account') = (account_patient_id IS NOT NULL) AND (channel = 'account' OR data IS NOT NULL))");

        Schema::create('patient_guardians', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('dependent_patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('guardian_patient_id')->constrained('patients')->restrictOnDelete();
            $table->string('relationship', 40);
            $table->timestampTz('consent_at');
            $table->foreignId('consent_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 10)->default('active');
            $table->timestampTz('ended_at')->nullable();
            $table->string('ended_reason', 30)->nullable();
            $table->foreignId('ended_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE patient_guardians ADD CONSTRAINT patient_guardians_status_check CHECK (status IN ('active','ended') AND (status = 'ended') = (ended_at IS NOT NULL))");
        DB::statement('ALTER TABLE patient_guardians ADD CONSTRAINT patient_guardians_not_self CHECK (dependent_patient_id <> guardian_patient_id)');
        DB::statement("CREATE UNIQUE INDEX patient_guardians_one_active ON patient_guardians (dependent_patient_id, guardian_patient_id) WHERE status = 'active'");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION patient_guardians_guard() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'patient_guardians rows are never deleted; end the link instead'; END IF;
                IF OLD.status = 'ended' THEN RAISE EXCEPTION 'an ended guardian link cannot change'; END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER patient_guardians_guard BEFORE UPDATE OR DELETE ON patient_guardians
                FOR EACH ROW EXECUTE FUNCTION patient_guardians_guard();
        SQL);

        Schema::table('patients', function (Blueprint $table) {
            $table->string('registration_source', 20)->nullable();
            $table->string('id_type', 30)->nullable();
            $table->string('id_last4', 4)->nullable();
            $table->foreignId('id_verified_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('id_verified_at')->nullable();
        });
        DB::statement("ALTER TABLE patients ADD CONSTRAINT patients_registration_source_check CHECK (registration_source IS NULL OR registration_source IN ('online','counter','front_desk','guardian'))");
        DB::statement('ALTER TABLE patients ADD CONSTRAINT patients_id_verified_type CHECK (id_verified_at IS NULL OR id_type IS NOT NULL)');

        // Owner settings for intake (privacy defaults): the last 4 characters of the ID are not kept, and ID image upload is off.
        foreach (['automation_settings_key_check' => ['automation_settings', 'key'], 'automation_deliveries_automation_check' => ['automation_deliveries', 'automation']] as $constraint => [$t, $c]) {
            DB::statement("ALTER TABLE $t DROP CONSTRAINT $constraint");
            DB::statement("ALTER TABLE $t ADD CONSTRAINT $constraint CHECK ($c IN ('appointment_reminders','no_show','overdue_invoices','recall','waitlist','owner_summary','fill_slots','attendance_policy','calendar_load','intake'))");
        }
        DB::table('automation_settings')->insert(['key' => 'intake', 'enabled' => true, 'settings' => json_encode(['store_id_last4' => false, 'id_upload' => false, 'id_upload_days' => 7]),
            'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE automation_settings DISABLE TRIGGER automation_settings_no_delete');
        DB::table('automation_settings')->where('key', 'intake')->delete();
        DB::statement('ALTER TABLE automation_settings ENABLE TRIGGER automation_settings_no_delete');
        Schema::table('patients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('id_verified_by_user_id');
            $table->dropColumn(['registration_source', 'id_type', 'id_last4', 'id_verified_at']);
        });
        Schema::dropIfExists('patient_guardians');
        DB::unprepared('DROP FUNCTION IF EXISTS patient_guardians_guard();');
        Schema::dropIfExists('intake_submissions');
        Schema::dropIfExists('branch_join_codes');
    }
};
