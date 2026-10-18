<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Scheduled automations (Administration → Automations): six fixed jobs, not a rule engine.
 *
 *  automation_settings   one row per automation: on/off, its Owner-editable settings and when the scheduler last ran it.
 *                        The rows are inserted here with the shipped defaults (none confirmed by the clinic); the Owner
 *                        edits them, every edit is audited, and nothing is ever deleted.
 *  automation_deliveries one append-only row per thing an automation did or decided not to do (queued an email, notified
 *                        in the app, skipped with a reason). `dedupe_key` is unique per appointment, invoice, visit or day
 *                        and type, so a retry or a second scheduler run can never act twice. Emails themselves go through
 *                        the M18 outbox (mail_dispatches) with the same key.
 */
return new class extends Migration
{
    private const KEYS = ['appointment_reminders', 'no_show', 'overdue_invoices', 'recall', 'waitlist', 'owner_summary'];

    public function up(): void
    {
        Schema::create('automation_settings', function (Blueprint $table) {
            $table->string('key', 40)->primary();
            $table->boolean('enabled');
            $table->jsonb('settings');
            $table->unsignedInteger('revision')->default(1);
            $table->timestampTz('last_run_at')->nullable();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE automation_settings ADD CONSTRAINT automation_settings_key_check CHECK (key IN ('".implode("','", self::KEYS)."'))");
        DB::statement("ALTER TABLE automation_settings ADD CONSTRAINT automation_settings_object CHECK (jsonb_typeof(settings) = 'object')");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION automation_settings_no_delete() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'automation_settings rows are never deleted; switch the automation off instead';
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER automation_settings_no_delete BEFORE DELETE ON automation_settings
                FOR EACH ROW EXECUTE FUNCTION automation_settings_no_delete();
        SQL);

        $defaults = [
            'appointment_reminders' => [true, ['hours_before' => 24, 'morning_of' => false, 'morning_time' => '08:00']],
            'no_show' => [true, ['grace_minutes' => 30, 'rebook_email' => false]],
            'overdue_invoices' => [true, ['days' => [3, 7, 14]]],
            'recall' => [false, ['rules' => []]],
            'waitlist' => [true, ['notify_count' => 3]],
            'owner_summary' => [true, ['send_time' => '20:30']],
        ];
        foreach ($defaults as $key => [$enabled, $settings]) {
            DB::table('automation_settings')->insert(['key' => $key, 'enabled' => $enabled, 'settings' => json_encode($settings),
                'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
        }

        Schema::create('automation_deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('automation', 40);
            $table->string('dedupe_key', 191)->unique();
            $table->string('outcome', 20);
            $table->string('reason', 60)->nullable();
            $table->string('subject_type', 40)->nullable();
            $table->string('subject_public_id', 50)->nullable();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->foreignId('mail_dispatch_id')->nullable()->constrained('mail_dispatches')->restrictOnDelete();
            $table->timestampTz('created_at')->default(DB::raw('now()'));
            $table->index(['automation', 'created_at']);
            $table->index(['subject_type', 'subject_public_id']);
        });
        DB::statement("ALTER TABLE automation_deliveries ADD CONSTRAINT automation_deliveries_automation_check CHECK (automation IN ('".implode("','", self::KEYS)."'))");
        DB::statement("ALTER TABLE automation_deliveries ADD CONSTRAINT automation_deliveries_outcome_check CHECK (outcome IN ('queued','notified','flagged','skipped'))");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION automation_deliveries_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'automation_deliveries is append-only';
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER automation_deliveries_no_update_delete BEFORE UPDATE OR DELETE ON automation_deliveries
                FOR EACH ROW EXECUTE FUNCTION automation_deliveries_append_only();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_deliveries');
        Schema::dropIfExists('automation_settings');
        DB::unprepared('DROP FUNCTION IF EXISTS automation_deliveries_append_only(); DROP FUNCTION IF EXISTS automation_settings_no_delete();');
    }
};
