<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M17 Unified Patient Messaging — persistent in-app HUMAN conversation between an identified Patient and the clinic.
//   * A conversation belongs to exactly one Patient and one branch and has EXPLICIT participant users (the Patient's account plus the
//     assigned Staff/Dentist), mirroring the existing prototype. Roles grant no participation: Owner has none.
//   * There is NO creation command: the prototype created conversations only from the M16 inquiry conversion, which deliberately no
//     longer does so (routing/ownership/handoff policy is unresolved). Rows are therefore created only by a future, reviewed handoff.
//   * Messages are IMMUTABLE (trigger): no edit, no delete. The sender is always the authenticated account; the order is the
//     serial id (a conversation row lock serializes concurrent sends).
//   * Read state is per participant and in-application only: `last_read_message_id` is the INTERNAL serial id of the last message that
//     participant has opened. The database guarantees it (a) belongs to the SAME conversation (composite foreign key) and (b) only ever
//     moves FORWARD (trigger). It is never shown to other participants and says nothing about SMS/email/social delivery — none exists.
//   * A message's sender must be a participant of its conversation (composite foreign key).
//   * Nothing cascades: conversations, participants and messages are RESTRICTed so removing an account can never erase history
//     (no retention period is defined: RETENTION POLICY REQUIRED).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->string('context', 200);
            $table->string('status')->default('Open');
            $table->unsignedInteger('revision')->default(1);
            $table->timestampTz('closed_at')->nullable();
            $table->foreignId('closed_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampsTz();
            $table->index(['patient_id', 'id']);
            $table->index(['branch_id', 'id']);
        });
        DB::statement("ALTER TABLE conversations ADD CONSTRAINT conversations_status_check CHECK (status IN ('Open','Closed'))");
        DB::statement("ALTER TABLE conversations ADD CONSTRAINT conversations_closed_check CHECK ((status = 'Closed') = (closed_at IS NOT NULL AND closed_by_user_id IS NOT NULL))");

        Schema::create('conversation_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedBigInteger('last_read_message_id')->nullable();
            $table->timestampTz('last_read_at')->nullable();
            $table->timestampTz('created_at');
            $table->unique(['conversation_id', 'user_id']);
            $table->index('user_id');
        });

        Schema::create('conversation_messages', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('conversation_id')->constrained('conversations')->restrictOnDelete();
            $table->foreignId('sender_user_id')->constrained('users')->restrictOnDelete();
            $table->text('body');
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['conversation_id', 'id']);
            $table->unique(['conversation_id', 'id']);      // target of the read-marker composite foreign key
        });
        // Same-conversation invariants (MATCH SIMPLE: a NULL marker is simply "nothing read yet").
        DB::statement('ALTER TABLE conversation_participants ADD CONSTRAINT conversation_participants_read_marker_fk FOREIGN KEY (conversation_id, last_read_message_id) REFERENCES conversation_messages (conversation_id, id) ON DELETE RESTRICT');
        DB::statement('ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_sender_participant_fk FOREIGN KEY (conversation_id, sender_user_id) REFERENCES conversation_participants (conversation_id, user_id) ON DELETE RESTRICT');
        DB::statement('ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_body_check CHECK (length(btrim(body)) > 0 AND length(body) <= 4000)');

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION conversation_messages_immutable() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'conversation messages are immutable';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER conversation_messages_no_update_delete
                BEFORE UPDATE OR DELETE ON conversation_messages
                FOR EACH ROW EXECUTE FUNCTION conversation_messages_immutable();

            CREATE OR REPLACE FUNCTION conversation_participants_guard() RETURNS trigger AS $$
            BEGIN
                IF NEW.conversation_id <> OLD.conversation_id OR NEW.user_id <> OLD.user_id THEN
                    RAISE EXCEPTION 'a participant row keeps its conversation and user';
                END IF;
                IF OLD.last_read_message_id IS NOT NULL AND (NEW.last_read_message_id IS NULL OR NEW.last_read_message_id < OLD.last_read_message_id) THEN
                    RAISE EXCEPTION 'a read marker only moves forward';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER conversation_participants_guard
                BEFORE UPDATE ON conversation_participants
                FOR EACH ROW EXECUTE FUNCTION conversation_participants_guard();

            CREATE OR REPLACE FUNCTION conversations_guard() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'conversations are never deleted';
                END IF;
                IF OLD.status = 'Closed' THEN
                    RAISE EXCEPTION 'a closed conversation is final';
                END IF;
                IF NEW.public_id <> OLD.public_id OR NEW.patient_id <> OLD.patient_id OR NEW.branch_id <> OLD.branch_id OR NEW.context <> OLD.context THEN
                    RAISE EXCEPTION 'a conversation''s Patient, branch and context are immutable';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER conversations_guard
                BEFORE UPDATE OR DELETE ON conversations
                FOR EACH ROW EXECUTE FUNCTION conversations_guard();
        SQL);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE IF EXISTS conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_read_marker_fk');
        Schema::dropIfExists('conversation_messages');
        Schema::dropIfExists('conversation_participants');
        Schema::dropIfExists('conversations');
        DB::unprepared('DROP FUNCTION IF EXISTS conversation_messages_immutable(); DROP FUNCTION IF EXISTS conversations_guard(); DROP FUNCTION IF EXISTS conversation_participants_guard();');
    }
};
