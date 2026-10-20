<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M10 Dental Charts. tooth_chart_entries is an append-only history: each row is one finding a Dentist recorded for one tooth (FDI
 * code, adult 11–48 or primary 51–85) and optional surfaces, with a status from the Owner's list, a date, an optional note
 * (encrypted) and an optional treatment link. The current chart is the latest entry per tooth. No row is ever changed or deleted.
 * automation_settings 'dental_chart' (Owner): tooth numbering shown (FDI by default, Universal available) and the status list.
 * The system makes no diagnosis or suggestion.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tooth_chart_entries', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->string('tooth', 2);
            $table->jsonb('surfaces')->default(DB::raw("'[]'::jsonb"));
            $table->string('status', 40);
            $table->date('recorded_on');
            $table->text('note')->nullable();
            $table->foreignId('treatment_id')->nullable()->constrained('treatments')->restrictOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->default(DB::raw('now()'));
            $table->index(['patient_id', 'tooth', 'id']);
        });
        DB::statement("ALTER TABLE tooth_chart_entries ADD CONSTRAINT tooth_chart_entries_tooth_check CHECK (tooth ~ '^([1-4][1-8]|[5-8][1-5])$')");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION tooth_chart_entries_append_only() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'chart history is append-only: record a new entry instead'; END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER tooth_chart_entries_append_only BEFORE UPDATE OR DELETE ON tooth_chart_entries FOR EACH ROW EXECUTE FUNCTION tooth_chart_entries_append_only();
        SQL);
        foreach (['automation_settings_key_check' => ['automation_settings', 'key'], 'automation_deliveries_automation_check' => ['automation_deliveries', 'automation']] as $constraint => [$t, $c]) {
            DB::statement("ALTER TABLE $t DROP CONSTRAINT $constraint");
            DB::statement("ALTER TABLE $t ADD CONSTRAINT $constraint CHECK ($c IN ('appointment_reminders','no_show','overdue_invoices','recall','waitlist','owner_summary','fill_slots','attendance_policy','calendar_load','intake','staffing','prescriptions','followup_reminders','dental_chart'))");
        }
        DB::table('automation_settings')->insert(['key' => 'dental_chart', 'enabled' => true, 'settings' => json_encode(['numbering' => 'fdi',
            'statuses' => ['Healthy', 'Caries', 'Filled', 'Crown', 'Root canal', 'Missing', 'Extracted', 'Implant', 'To monitor']]),
            'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE automation_settings DISABLE TRIGGER automation_settings_no_delete');
        DB::table('automation_settings')->where('key', 'dental_chart')->delete();
        DB::statement('ALTER TABLE automation_settings ENABLE TRIGGER automation_settings_no_delete');
        foreach (['automation_settings_key_check' => ['automation_settings', 'key'], 'automation_deliveries_automation_check' => ['automation_deliveries', 'automation']] as $constraint => [$t, $c]) {
            DB::statement("ALTER TABLE $t DROP CONSTRAINT $constraint");
            DB::statement("ALTER TABLE $t ADD CONSTRAINT $constraint CHECK ($c IN ('appointment_reminders','no_show','overdue_invoices','recall','waitlist','owner_summary','fill_slots','attendance_policy','calendar_load','intake','staffing','prescriptions','followup_reminders'))");
        }
        Schema::dropIfExists('tooth_chart_entries');
        DB::unprepared('DROP FUNCTION IF EXISTS tooth_chart_entries_append_only();');
    }
};
