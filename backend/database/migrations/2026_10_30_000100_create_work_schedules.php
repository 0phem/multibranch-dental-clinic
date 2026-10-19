<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M3 Work Schedules.
 *  dentist_schedules            a dentist's weekly hours at one branch on one ISO weekday (start, end, optional break). One
 *                               active row per dentist + weekday + branch; a dentist may work at several branches on different
 *                               days (or different hours of one day, never overlapping). Edited in place, removed by status:
 *                               never deleted. Every change is audited with the old and new hours.
 *  dentist_schedule_exceptions  one date: a day off (every branch) or custom hours at one branch. Removed by status.
 *  automation_settings 'staffing' Owner settings: who approves leave, whether the front desk edits their branch's schedules, and
 *                               how long an acknowledged M25 handover keeps the receiving branch's access (days).
 *  message_templates            'dentist_unavailable_notice' (to patients), 'leave_requested', 'leave_decided' (to staff),
 *                               unapproved until the Owner approves them like every other email.
 * No schedule is invented here: until a dentist has weekly rows, booking falls back to the hours on their profile.
 */
return new class extends Migration
{
    private const KINDS_BEFORE = "'appointment_booked','appointment_rescheduled','appointment_cancelled','invoice_issued','payment_received','message_received','appointment_reminder','no_show_rebook','invoice_overdue','recall_due','waitlist_opening','late_check','move_up_offer','closure_notice'";

    /** In-app notices: the patient's "please choose a new time", leave to the approver and back, a handover to the receiving side, the neutral "record shared". */
    private const KINDS_ADDED = "'dentist_unavailable','leave_requested','leave_decided','handover_received','record_shared'";

    public function up(): void
    {
        DB::statement('ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_kind_check');
        DB::statement('ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('.self::KINDS_BEFORE.','.self::KINDS_ADDED.'))');

        Schema::create('dentist_schedules', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->unsignedTinyInteger('weekday');
            $table->time('start_time');
            $table->time('end_time');
            $table->time('break_start')->nullable();
            $table->time('break_end')->nullable();
            $table->string('status', 10)->default('active');
            $table->boolean('demo')->default(false);
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->index(['dentist_profile_id', 'weekday', 'status']);
        });
        DB::statement("ALTER TABLE dentist_schedules ADD CONSTRAINT dentist_schedules_status_check CHECK (status IN ('active','removed'))");
        DB::statement('ALTER TABLE dentist_schedules ADD CONSTRAINT dentist_schedules_weekday_check CHECK (weekday BETWEEN 1 AND 7)');
        DB::statement('ALTER TABLE dentist_schedules ADD CONSTRAINT dentist_schedules_hours_check CHECK (start_time < end_time)');
        DB::statement('ALTER TABLE dentist_schedules ADD CONSTRAINT dentist_schedules_break_check CHECK ((break_start IS NULL AND break_end IS NULL) OR (break_start < break_end AND break_start > start_time AND break_end < end_time))');
        DB::statement("CREATE UNIQUE INDEX dentist_schedules_one_active ON dentist_schedules (dentist_profile_id, weekday, branch_id) WHERE status = 'active'");

        Schema::create('dentist_schedule_exceptions', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->date('on_date');
            $table->string('kind', 12);
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->string('reason', 120)->nullable();
            $table->string('status', 10)->default('active');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->index(['dentist_profile_id', 'on_date', 'status']);
        });
        DB::statement("ALTER TABLE dentist_schedule_exceptions ADD CONSTRAINT dse_kind_check CHECK (kind IN ('day_off','custom_hours'))");
        DB::statement("ALTER TABLE dentist_schedule_exceptions ADD CONSTRAINT dse_status_check CHECK (status IN ('active','removed'))");
        DB::statement("ALTER TABLE dentist_schedule_exceptions ADD CONSTRAINT dse_shape_check CHECK ((kind = 'day_off' AND start_time IS NULL AND end_time IS NULL) OR (kind = 'custom_hours' AND branch_id IS NOT NULL AND start_time < end_time))");

        foreach (['dentist_schedules', 'dentist_schedule_exceptions'] as $t) {
            DB::unprepared(<<<SQL
                CREATE OR REPLACE FUNCTION {$t}_no_delete() RETURNS trigger AS \$\$
                BEGIN RAISE EXCEPTION '{$t} rows are never deleted; set status to removed'; END;
                \$\$ LANGUAGE plpgsql;
                CREATE TRIGGER {$t}_no_delete BEFORE DELETE ON {$t} FOR EACH ROW EXECUTE FUNCTION {$t}_no_delete();
            SQL);
        }

        foreach (['automation_settings_key_check' => ['automation_settings', 'key'], 'automation_deliveries_automation_check' => ['automation_deliveries', 'automation']] as $constraint => [$t, $c]) {
            DB::statement("ALTER TABLE $t DROP CONSTRAINT $constraint");
            DB::statement("ALTER TABLE $t ADD CONSTRAINT $constraint CHECK ($c IN ('appointment_reminders','no_show','overdue_invoices','recall','waitlist','owner_summary','fill_slots','attendance_policy','calendar_load','intake','staffing'))");
        }
        DB::table('automation_settings')->insert(['key' => 'staffing', 'enabled' => true, 'settings' => json_encode(['leave_approver' => 'owner', 'front_desk_edits_schedules' => true, 'handover_access_days' => 60]),
            'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);

        foreach (['dentist_unavailable_notice', 'leave_requested', 'leave_decided'] as $key) {
            [$subject, $body, $needsDentist] = \App\Services\Automations\MessageTemplates::DEFAULTS[$key];
            // A fresh database already has them (the template migration inserts every default); an existing one gets them here.
            DB::table('message_templates')->insertOrIgnore(['key' => $key, 'subject' => $subject, 'body' => $body, 'needs_dentist' => $needsDentist,
                'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
        }
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_kind_check');
        DB::statement('ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('.self::KINDS_BEFORE.'))');
        DB::statement('ALTER TABLE message_templates DISABLE TRIGGER USER');
        DB::table('message_templates')->whereIn('key', ['dentist_unavailable_notice', 'leave_requested', 'leave_decided'])->delete();
        DB::statement('ALTER TABLE message_templates ENABLE TRIGGER USER');
        DB::statement('ALTER TABLE automation_settings DISABLE TRIGGER automation_settings_no_delete');
        DB::table('automation_settings')->where('key', 'staffing')->delete();
        DB::statement('ALTER TABLE automation_settings ENABLE TRIGGER automation_settings_no_delete');
        foreach (['automation_settings_key_check' => ['automation_settings', 'key'], 'automation_deliveries_automation_check' => ['automation_deliveries', 'automation']] as $constraint => [$t, $c]) {
            DB::statement("ALTER TABLE $t DROP CONSTRAINT $constraint");
            DB::statement("ALTER TABLE $t ADD CONSTRAINT $constraint CHECK ($c IN ('appointment_reminders','no_show','overdue_invoices','recall','waitlist','owner_summary','fill_slots','attendance_policy','calendar_load','intake'))");
        }
        Schema::dropIfExists('dentist_schedule_exceptions');
        Schema::dropIfExists('dentist_schedules');
        DB::unprepared('DROP FUNCTION IF EXISTS dentist_schedule_exceptions_no_delete(); DROP FUNCTION IF EXISTS dentist_schedules_no_delete();');
    }
};
