<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F1 Owner-approved wording (interview R2-09: "the Owner approves the wording"). One row per automated email: its subject and
 * message, edited by the Owner with a preview. An automation cannot be switched on until every template it sends is approved;
 * a health-related template (recall) also needs a Dentist's approval (R2-11). Editing the wording clears both approvals and
 * switches the automations that use it off. The shipped wording is ours ("recommended, not confirmed by the clinic"), so every
 * row starts unapproved and every automation starts off. Rows are never deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_templates', function (Blueprint $table) {
            $table->string('key', 40)->primary();
            $table->string('subject', 160);
            $table->text('body');
            $table->boolean('needs_dentist')->default(false);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('approved_at')->nullable();
            $table->foreignId('dentist_approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('dentist_approved_at')->nullable();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });
        DB::statement('ALTER TABLE message_templates ADD CONSTRAINT message_templates_dentist_approval CHECK (needs_dentist OR dentist_approved_at IS NULL)');
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION message_templates_no_delete() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'message_templates rows are never deleted';
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER message_templates_no_delete BEFORE DELETE ON message_templates
                FOR EACH ROW EXECUTE FUNCTION message_templates_no_delete();
        SQL);
        foreach (\App\Services\Automations\MessageTemplates::DEFAULTS as $key => [$subject, $body, $needsDentist]) {
            DB::table('message_templates')->insert(['key' => $key, 'subject' => $subject, 'body' => $body, 'needs_dentist' => $needsDentist,
                'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
        }
        // Nothing may send unapproved wording: every automation is off until the Owner approves its emails.
        DB::table('automation_settings')->update(['enabled' => false]);
    }

    public function down(): void
    {
        Schema::dropIfExists('message_templates');
        DB::unprepared('DROP FUNCTION IF EXISTS message_templates_no_delete();');
    }
};
