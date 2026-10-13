<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// M17 Priority 2 (Phase 2 decisions 3 and 5).
//  * Encryption at rest: new messages store only `body_encrypted` (Laravel encrypter, AES-256-CBC + MAC, APP_KEY); `body` becomes nullable
//    and holds plain text only for rows written before this change, until `php artisan messages:encrypt-bodies` converts them. Exactly one
//    of the two columns is set. Messages stay immutable: the trigger now allows ONE narrow update — swapping body <-> body_encrypted (or
//    re-encrypting during key rotation) — and only inside a transaction that sets `app.m17_body_migration = 'on'` (the commands do this);
//    every other column must be unchanged. Normal application code can still never edit or delete a message.
//  * Routing: `assigned_user_id` is the participant of record — the first Staff member who replies. Set once; never changed afterwards.
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE conversation_messages ADD COLUMN body_encrypted text NULL');
        DB::statement('ALTER TABLE conversation_messages ALTER COLUMN body DROP NOT NULL');
        DB::statement('ALTER TABLE conversation_messages DROP CONSTRAINT conversation_messages_body_check');
        DB::statement('ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_body_check CHECK (body IS NULL OR (length(btrim(body)) > 0 AND length(body) <= 4000))');
        DB::statement('ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_one_body_check CHECK ((body IS NULL) <> (body_encrypted IS NULL))');
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION conversation_messages_immutable() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'UPDATE'
                   AND current_setting('app.m17_body_migration', true) = 'on'
                   AND NEW.id = OLD.id AND NEW.public_id = OLD.public_id AND NEW.conversation_id = OLD.conversation_id
                   AND NEW.sender_user_id = OLD.sender_user_id AND NEW.created_at = OLD.created_at THEN
                    RETURN NEW;
                END IF;
                RAISE EXCEPTION 'conversation messages are immutable';
            END;
            $$ LANGUAGE plpgsql;
        SQL);

        DB::statement('ALTER TABLE conversations ADD COLUMN assigned_user_id bigint NULL REFERENCES users(id) ON DELETE RESTRICT');
        DB::unprepared(<<<'SQL'
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
                IF OLD.assigned_user_id IS NOT NULL AND NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
                    RAISE EXCEPTION 'the participant of record is set once';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        SQL);
    }

    public function down(): void
    {
        // Refuses while any message is still encrypted: run `php artisan messages:decrypt-bodies` first (or restore the backup).
        if (DB::table('conversation_messages')->whereNotNull('body_encrypted')->exists()) {
            throw new RuntimeException('Encrypted messages exist. Run php artisan messages:decrypt-bodies before rolling back.');
        }
        DB::unprepared(<<<'SQL'
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
            CREATE OR REPLACE FUNCTION conversation_messages_immutable() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'conversation messages are immutable';
            END;
            $$ LANGUAGE plpgsql;
        SQL);
        DB::statement('ALTER TABLE conversations DROP COLUMN assigned_user_id');
        DB::statement('ALTER TABLE conversation_messages DROP CONSTRAINT conversation_messages_one_body_check');
        DB::statement('ALTER TABLE conversation_messages DROP CONSTRAINT conversation_messages_body_check');
        DB::statement('ALTER TABLE conversation_messages ALTER COLUMN body SET NOT NULL');
        DB::statement('ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_body_check CHECK (length(btrim(body)) > 0 AND length(body) <= 4000)');
        DB::statement('ALTER TABLE conversation_messages DROP COLUMN body_encrypted');
    }
};
