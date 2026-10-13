<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M18 durable email dispatch. One MAIL_DISPATCHES row is the intent to send one message (written inside the same transaction
// as the domain change that caused it, so a rolled-back change leaves no intent). MAIL_DISPATCH_ATTEMPTS is the append-only
// record of every try. Minimal data: no address, subject line, body, link or token is stored — the recipient is the user
// account and the message is re-rendered from the authoritative record at send time.
//
// Outcomes stay distinct: logged_only (a log/array mailer sent nothing), transport_accepted (a real transport accepted it;
// inbox delivery NOT confirmed) and failed. `delivery_confirmed_at` exists for future provider delivery evidence and is never
// set by this application today.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mail_dispatches', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('purpose', 60);
            // Duplicate protection: one intent per business event (for example appointment X at revision N).
            $table->string('dedupe_key', 191)->unique();
            $table->string('subject_type', 40)->nullable();
            $table->string('subject_public_id', 50)->nullable();
            $table->unsignedInteger('subject_revision')->nullable();
            $table->foreignId('recipient_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('retryable')->default(true);
            $table->string('status', 30)->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('max_attempts')->default(1);
            $table->timestampTz('next_attempt_at')->nullable();
            $table->timestampTz('locked_at')->nullable();
            $table->string('failure_reason', 40)->nullable();
            $table->string('mailer', 40)->nullable();
            $table->string('transport_kind', 20)->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('delivery_confirmed_at')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'next_attempt_at']);
            $table->index(['subject_type', 'subject_public_id']);
        });
        DB::statement("ALTER TABLE mail_dispatches ADD CONSTRAINT mail_dispatches_status_check CHECK (status IN ('pending','processing','retry_scheduled','logged_only','transport_accepted','failed','superseded'))");
        DB::statement('ALTER TABLE mail_dispatches ADD CONSTRAINT mail_dispatches_attempts_check CHECK (max_attempts >= 1 AND attempts <= max_attempts)');
        // Recipient delivery can only be recorded on a message a real transport accepted.
        DB::statement("ALTER TABLE mail_dispatches ADD CONSTRAINT mail_dispatches_delivery_check CHECK (delivery_confirmed_at IS NULL OR status = 'transport_accepted')");

        Schema::create('mail_dispatch_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mail_dispatch_id')->constrained('mail_dispatches')->restrictOnDelete();
            $table->unsignedSmallInteger('attempt_no');
            $table->string('outcome', 30);
            $table->string('mailer', 40)->nullable();
            $table->string('transport_kind', 20)->nullable();
            // Exception CLASS only: transport messages can contain message content or credentials.
            $table->string('error_class', 191)->nullable();
            $table->timestampTz('started_at');
            $table->timestampTz('finished_at');
            $table->unique(['mail_dispatch_id', 'attempt_no']);
        });
        DB::statement("ALTER TABLE mail_dispatch_attempts ADD CONSTRAINT mail_dispatch_attempts_outcome_check CHECK (outcome IN ('logged_only','transport_accepted','failed','skipped'))");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION mail_dispatch_attempts_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'mail_dispatch_attempts is append-only';
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER mail_dispatch_attempts_no_update_delete
                BEFORE UPDATE OR DELETE ON mail_dispatch_attempts
                FOR EACH ROW EXECUTE FUNCTION mail_dispatch_attempts_append_only();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_dispatch_attempts');
        Schema::dropIfExists('mail_dispatches');
        DB::unprepared('DROP FUNCTION IF EXISTS mail_dispatch_attempts_append_only();');
    }
};
