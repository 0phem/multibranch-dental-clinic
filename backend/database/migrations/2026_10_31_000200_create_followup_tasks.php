<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M20 Patient Follow-Up on the clinic server (replaces the browser-only prototype).
 *  followup_tasks  one per follow-up: from a completed treatment's follow-up fields (once per treatment), or added by a Dentist or
 *                  the front desk. Open → Contacted → Booked (set automatically when the patient's next appointment is booked) →
 *                  Closed (a note is required when closed without a booking). Assignee: the branch front desk unless one person
 *                  is named. The reason is encrypted. Never deleted.
 *  automation_settings 'followup_reminders'  optional patient email when a follow-up is due: OFF; its wording 'followup_due'
 *                  needs the Owner's and a Dentist's approval (clinical content, like recall).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('followup_tasks', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('treatment_id')->nullable()->constrained('treatments')->restrictOnDelete();
            $table->foreignId('service_id')->nullable()->constrained('services')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->nullable()->constrained('dentist_profiles')->restrictOnDelete();
            $table->text('reason');
            $table->date('due_on');
            $table->foreignId('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source', 12);
            $table->string('status', 10)->default('Open');
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->restrictOnDelete();
            $table->text('close_note')->nullable();
            $table->timestampTz('contacted_at')->nullable();
            $table->timestampTz('booked_at')->nullable();
            $table->timestampTz('closed_at')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('revision')->default(1);
            $table->timestampsTz();
            $table->index(['branch_id', 'status', 'due_on']);
            $table->index(['patient_id', 'status']);
        });
        DB::statement("ALTER TABLE followup_tasks ADD CONSTRAINT followup_tasks_status_check CHECK (status IN ('Open','Contacted','Booked','Closed'))");
        DB::statement("ALTER TABLE followup_tasks ADD CONSTRAINT followup_tasks_source_check CHECK (source IN ('treatment','dentist','front_desk'))");
        DB::statement("ALTER TABLE followup_tasks ADD CONSTRAINT followup_tasks_booked_check CHECK (status <> 'Booked' OR appointment_id IS NOT NULL)");
        DB::statement("ALTER TABLE followup_tasks ADD CONSTRAINT followup_tasks_closed_check CHECK (status <> 'Closed' OR appointment_id IS NOT NULL OR close_note IS NOT NULL)");
        DB::statement("CREATE UNIQUE INDEX followup_tasks_one_per_treatment ON followup_tasks (treatment_id) WHERE source = 'treatment'");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION followup_tasks_no_delete() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'follow-up tasks are never deleted; close them'; END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER followup_tasks_no_delete BEFORE DELETE ON followup_tasks FOR EACH ROW EXECUTE FUNCTION followup_tasks_no_delete();
        SQL);

        DB::table('automation_settings')->insert(['key' => 'followup_reminders', 'enabled' => false, 'settings' => json_encode(['days_before' => 0]),
            'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
        [$subject, $body, $needsDentist] = \App\Services\Automations\MessageTemplates::DEFAULTS['followup_due'];
        DB::table('message_templates')->insertOrIgnore(['key' => 'followup_due', 'subject' => $subject, 'body' => $body, 'needs_dentist' => $needsDentist,
            'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE message_templates DISABLE TRIGGER USER');
        DB::table('message_templates')->where('key', 'followup_due')->delete();
        DB::statement('ALTER TABLE message_templates ENABLE TRIGGER USER');
        DB::statement('ALTER TABLE automation_settings DISABLE TRIGGER automation_settings_no_delete');
        DB::table('automation_settings')->where('key', 'followup_reminders')->delete();
        DB::statement('ALTER TABLE automation_settings ENABLE TRIGGER automation_settings_no_delete');
        Schema::dropIfExists('followup_tasks');
        DB::unprepared('DROP FUNCTION IF EXISTS followup_tasks_no_delete();');
    }
};
