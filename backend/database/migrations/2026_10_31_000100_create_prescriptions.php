<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M19 Prescriptions on the clinic server (replaces the browser-only prototype).
 *  prescriptions        written by a Dentist for a visit (and its treatment, if any): Draft → Issued → Void. Issuing locks it
 *                       (append-only): an issued prescription changes only to Void, with a reason. Numbered RX-YYYY-000001 when
 *                       issued, from prescription_counters (a row locked in the issuing transaction: no gaps, unlike a sequence).
 *  prescription_lines   free-text medicine, dosage, frequency, duration and instructions (encrypted). No drug list, no checks.
 *                       Lines can change only while the prescription is a Draft (enforced by a trigger).
 *  dentist_profiles.rx_license_no  optional, entered by the dentist on their own profile; never prefilled.
 *  automation_settings 'prescriptions'  Owner's optional list of common medicines for quick selection (empty).
 * Nothing is deleted.
 */
return new class extends Migration
{
    private const KINDS_BEFORE = "'appointment_booked','appointment_rescheduled','appointment_cancelled','invoice_issued','payment_received','message_received','appointment_reminder','no_show_rebook','invoice_overdue','recall_due','waitlist_opening','late_check','move_up_offer','closure_notice','dentist_unavailable','leave_requested','leave_decided','handover_received','record_shared'";

    /** "A prescription from your visit is ready" (no medicine) and the M20 follow-up notices. */
    private const KINDS_ADDED = "'prescription_ready','followup_due','followup_assigned'";

    public function up(): void
    {
        DB::statement('ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_kind_check');
        DB::statement('ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('.self::KINDS_BEFORE.','.self::KINDS_ADDED.'))');
        Schema::create('prescription_counters', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('last_number')->default(0);
        });

        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->string('number', 20)->nullable()->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('visit_id')->constrained('visits')->restrictOnDelete();
            $table->foreignId('treatment_id')->nullable()->constrained('treatments')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 8)->default('Draft');
            $table->text('note')->nullable();
            $table->string('license_no', 40)->nullable();
            $table->timestampTz('issued_at')->nullable();
            $table->foreignId('issued_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('voided_at')->nullable();
            $table->foreignId('voided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('void_reason', 300)->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->timestampsTz();
            $table->index(['patient_id', 'status']);
            $table->index(['branch_id', 'issued_at']);
        });
        DB::statement("ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_status_check CHECK (status IN ('Draft','Issued','Void'))");
        DB::statement("ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_issued_check CHECK (status = 'Draft' OR (number IS NOT NULL AND issued_at IS NOT NULL))");
        DB::statement("ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_void_check CHECK (status <> 'Void' OR (voided_at IS NOT NULL AND void_reason IS NOT NULL))");

        Schema::create('prescription_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prescription_id')->constrained('prescriptions')->restrictOnDelete();
            $table->unsignedSmallInteger('line_no');
            $table->text('medicine');
            $table->text('dosage')->nullable();
            $table->text('frequency')->nullable();
            $table->text('duration')->nullable();
            $table->text('instructions')->nullable();
            $table->timestampsTz();
            $table->unique(['prescription_id', 'line_no']);
        });

        // Append-only once issued: an issued prescription may only become Void (with its reason), and its lines never change again.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION prescriptions_guard() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'prescriptions are never deleted'; END IF;
                IF OLD.status = 'Void' THEN RAISE EXCEPTION 'a void prescription cannot change'; END IF;
                IF OLD.status = 'Issued' AND (NEW.status <> 'Void' OR NEW.number IS DISTINCT FROM OLD.number OR NEW.note IS DISTINCT FROM OLD.note
                    OR NEW.patient_id <> OLD.patient_id OR NEW.visit_id <> OLD.visit_id OR NEW.dentist_profile_id <> OLD.dentist_profile_id
                    OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR NEW.license_no IS DISTINCT FROM OLD.license_no) THEN
                    RAISE EXCEPTION 'an issued prescription is locked; void it and issue a new one';
                END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER prescriptions_guard BEFORE UPDATE OR DELETE ON prescriptions FOR EACH ROW EXECUTE FUNCTION prescriptions_guard();

            CREATE OR REPLACE FUNCTION prescription_lines_guard() RETURNS trigger AS $$
            DECLARE s text;
            BEGIN
                SELECT status INTO s FROM prescriptions WHERE id = COALESCE(NEW.prescription_id, OLD.prescription_id);
                IF s IS DISTINCT FROM 'Draft' THEN RAISE EXCEPTION 'prescription lines change only while it is a draft'; END IF;
                RETURN COALESCE(NEW, OLD);
            END; $$ LANGUAGE plpgsql;
            CREATE TRIGGER prescription_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON prescription_lines FOR EACH ROW EXECUTE FUNCTION prescription_lines_guard();
        SQL);

        Schema::table('dentist_profiles', fn (Blueprint $table) => $table->string('rx_license_no', 40)->nullable());

        foreach (['automation_settings_key_check' => ['automation_settings', 'key'], 'automation_deliveries_automation_check' => ['automation_deliveries', 'automation']] as $constraint => [$t, $c]) {
            DB::statement("ALTER TABLE $t DROP CONSTRAINT $constraint");
            DB::statement("ALTER TABLE $t ADD CONSTRAINT $constraint CHECK ($c IN ('appointment_reminders','no_show','overdue_invoices','recall','waitlist','owner_summary','fill_slots','attendance_policy','calendar_load','intake','staffing','prescriptions','followup_reminders'))");
        }
        DB::table('automation_settings')->insert(['key' => 'prescriptions', 'enabled' => true, 'settings' => json_encode(['common_medicines' => []]),
            'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_kind_check');
        DB::statement('ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('.self::KINDS_BEFORE.'))');
        DB::statement('ALTER TABLE automation_settings DISABLE TRIGGER automation_settings_no_delete');
        DB::table('automation_settings')->where('key', 'prescriptions')->delete();
        DB::statement('ALTER TABLE automation_settings ENABLE TRIGGER automation_settings_no_delete');
        foreach (['automation_settings_key_check' => ['automation_settings', 'key'], 'automation_deliveries_automation_check' => ['automation_deliveries', 'automation']] as $constraint => [$t, $c]) {
            DB::statement("ALTER TABLE $t DROP CONSTRAINT $constraint");
            DB::statement("ALTER TABLE $t ADD CONSTRAINT $constraint CHECK ($c IN ('appointment_reminders','no_show','overdue_invoices','recall','waitlist','owner_summary','fill_slots','attendance_policy','calendar_load','intake','staffing'))");
        }
        Schema::table('dentist_profiles', fn (Blueprint $table) => $table->dropColumn('rx_license_no'));
        Schema::dropIfExists('prescription_lines');
        Schema::dropIfExists('prescriptions');
        Schema::dropIfExists('prescription_counters');
        DB::unprepared('DROP FUNCTION IF EXISTS prescription_lines_guard(); DROP FUNCTION IF EXISTS prescriptions_guard();');
    }
};
