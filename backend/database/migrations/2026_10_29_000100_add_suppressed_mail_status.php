<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Mail guard: a message addressed to a reserved or fake domain (example.test, example.com, .test, .invalid, .localhost) is never
 * handed to a real mail transport; it is recorded in the outbox as "suppressed" (test address) instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE mail_dispatches DROP CONSTRAINT mail_dispatches_status_check');
        DB::statement("ALTER TABLE mail_dispatches ADD CONSTRAINT mail_dispatches_status_check CHECK (status IN ('pending','processing','retry_scheduled','logged_only','transport_accepted','failed','superseded','suppressed'))");
        DB::statement('ALTER TABLE mail_dispatch_attempts DROP CONSTRAINT mail_dispatch_attempts_outcome_check');
        DB::statement("ALTER TABLE mail_dispatch_attempts ADD CONSTRAINT mail_dispatch_attempts_outcome_check CHECK (outcome IN ('logged_only','transport_accepted','failed','skipped','suppressed'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE mail_dispatches DROP CONSTRAINT mail_dispatches_status_check');
        DB::statement("ALTER TABLE mail_dispatches ADD CONSTRAINT mail_dispatches_status_check CHECK (status IN ('pending','processing','retry_scheduled','logged_only','transport_accepted','failed','superseded'))");
        DB::statement('ALTER TABLE mail_dispatch_attempts DROP CONSTRAINT mail_dispatch_attempts_outcome_check');
        DB::statement("ALTER TABLE mail_dispatch_attempts ADD CONSTRAINT mail_dispatch_attempts_outcome_check CHECK (outcome IN ('logged_only','transport_accepted','failed','skipped'))");
    }
};
