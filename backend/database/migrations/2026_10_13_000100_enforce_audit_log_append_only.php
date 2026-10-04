<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// M22: audit history is append-only at the DATABASE, not only in the model. Eloquent guards (update()/delete() overrides)
// do not stop a query-builder update/delete, a raw statement or a forgotten code path, so PostgreSQL itself refuses to
// change or remove an audit row. Forward-only and non-destructive: no existing row is touched.
//
// The ONLY change a row may undergo is the referential cleanup PostgreSQL performs itself when a referenced User or Branch
// row is actually deleted (the FKs are ON DELETE SET NULL): actor_user_id / branch_id becoming NULL. That path is told apart
// from an application UPDATE two ways, both required: the statement runs INSIDE the foreign-key trigger (pg_trigger_depth()
// > 1; a direct UPDATE has depth 1) AND the referenced row no longer exists. So `UPDATE audit_logs SET actor_user_id = NULL`
// against an existing user or branch is refused; so is re-pointing a row at a different user. The actor's name and role are
// already copied onto the row, so history stays understandable. A no-op UPDATE (nothing changes) is harmless and allowed.
// Retention/deletion policy is undecided, so no pruning mechanism exists and none is permitted here.
//
// This is append-only against the application, not tamper-proof: the table owner or a superuser can still disable or drop
// these triggers, so deployment must run the application under a role that cannot (see docs/M22_PRODUCTION_HARDENING.md).
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION audit_logs_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit_logs rows are append-only and cannot be deleted';
    ELSIF TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'audit_logs is append-only and cannot be truncated';
    END IF;
    IF NEW IS NOT DISTINCT FROM OLD THEN
        RETURN NEW; -- no-op
    END IF;
    -- Only the FK SET NULL action: nested inside the referential trigger, every other column unchanged, and a referenced row
    -- that is really gone.
    IF pg_trigger_depth() > 1
       AND (to_jsonb(NEW) - 'actor_user_id' - 'branch_id') = (to_jsonb(OLD) - 'actor_user_id' - 'branch_id')
       AND (NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
            OR (NEW.actor_user_id IS NULL AND OLD.actor_user_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.actor_user_id)))
       AND (NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id
            OR (NEW.branch_id IS NULL AND OLD.branch_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM branches WHERE id = OLD.branch_id))) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'audit_logs rows are append-only and cannot be modified';
END;
$$ LANGUAGE plpgsql;
SQL);
        DB::unprepared('CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_guard()');
        DB::unprepared('CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_guard()');
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs');
        DB::unprepared('DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs');
        DB::unprepared('DROP FUNCTION IF EXISTS audit_logs_guard()');
    }
};
