<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F1–F4 (interview round 2).
 *
 *  appointment_responses  what a Patient answered: "I'll be there", "I can't make it", "On my way" or "I'll take the earlier
 *                         time". `link_hash` is the hash of the one-time email link used (unique: a link works once).
 *                         Append-only.
 *  slot_openings          a time that became free (cancelled, "I can't make it", released after the late limit, or left by a
 *                         patient who moved up). Offered first to patients booked later that day ("move up"), then to the
 *                         waitlist, then shown to the front desk for walk-ins. Nothing is held or moved without acceptance.
 *  slot_offers            one "an earlier time is available" offer per opening and patient; the first to accept wins through
 *                         the normal no-double-booking guard, the others lose.
 *  queue_entries.late_arrival  checked in after the late limit: ordered after on-time patients (R2-07); Staff may restore the
 *                         normal order with a reason.
 *  appointments.late_cancellation  cancelled by the Patient less than the policy's hours before the visit (R2-13).
 *  patients.confirmation_required_at  set when a Patient reaches the policy's limit of late cancellations and no-shows;
 *                         their next online bookings wait for front-desk confirmation until Staff clear it.
 */
return new class extends Migration
{
    private const KEYS_BEFORE = ['appointment_reminders', 'no_show', 'overdue_invoices', 'recall', 'waitlist', 'owner_summary'];

    private const KEYS = ['appointment_reminders', 'no_show', 'overdue_invoices', 'recall', 'waitlist', 'owner_summary', 'fill_slots', 'attendance_policy', 'calendar_load'];

    private const KINDS_BEFORE = "'appointment_booked','appointment_rescheduled','appointment_cancelled','invoice_issued','payment_received','message_received','appointment_reminder','no_show_rebook','invoice_overdue','recall_due','waitlist_opening'";

    private const KINDS_ADDED = "'late_check','move_up_offer','closure_notice'";

    public function up(): void
    {
        Schema::create('appointment_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained('appointments')->restrictOnDelete();
            $table->unsignedInteger('appointment_revision');
            $table->string('response', 20);
            $table->string('via', 10);
            $table->char('link_hash', 64)->nullable()->unique();
            $table->timestampTz('created_at')->default(DB::raw('now()'));
            $table->index(['appointment_id', 'created_at']);
        });
        DB::statement("ALTER TABLE appointment_responses ADD CONSTRAINT appointment_responses_response_check CHECK (response IN ('attending','cant_make_it','on_my_way','move_up_accepted'))");
        DB::statement("ALTER TABLE appointment_responses ADD CONSTRAINT appointment_responses_via_check CHECK (via IN ('email','app'))");
        $this->appendOnly('appointment_responses');

        Schema::create('slot_openings', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->restrictOnDelete();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->date('clinic_date');
            $table->string('source', 20);
            $table->foreignId('appointment_id')->constrained('appointments')->restrictOnDelete();
            $table->unsignedInteger('appointment_revision');
            $table->string('status', 20)->default('open');
            $table->string('filled_via', 20)->nullable();
            $table->foreignId('filled_appointment_id')->nullable()->constrained('appointments')->restrictOnDelete();
            $table->timestampTz('offers_sent_at')->nullable();
            $table->timestampTz('waitlist_at')->nullable();
            $table->timestampTz('closed_at')->nullable();
            $table->foreignId('closed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->unique(['appointment_id', 'appointment_revision']);
            $table->index(['branch_id', 'clinic_date', 'status']);
        });
        DB::statement("ALTER TABLE slot_openings ADD CONSTRAINT slot_openings_source_check CHECK (source IN ('cancelled','cant_make_it','released','moved_up'))");
        DB::statement("ALTER TABLE slot_openings ADD CONSTRAINT slot_openings_status_check CHECK (status IN ('open','filled','expired','withdrawn'))");
        DB::statement("ALTER TABLE slot_openings ADD CONSTRAINT slot_openings_filled_check CHECK ((status = 'filled') = (filled_via IS NOT NULL) AND (filled_via IS NULL OR filled_via IN ('move_up','waitlist','booking','walk_in')))");
        DB::statement('ALTER TABLE slot_openings ADD CONSTRAINT slot_openings_time_check CHECK (ends_at > starts_at)');
        $this->closesOnce('slot_openings', 'open');

        Schema::create('slot_offers', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('slot_opening_id')->constrained('slot_openings')->restrictOnDelete();
            $table->foreignId('appointment_id')->constrained('appointments')->restrictOnDelete();
            $table->unsignedInteger('appointment_revision');
            $table->string('status', 20)->default('offered');
            $table->timestampTz('offered_at');
            $table->timestampTz('closed_at')->nullable();
            $table->timestampsTz();
            $table->unique(['slot_opening_id', 'appointment_id']);
            $table->index(['appointment_id', 'status']);
        });
        DB::statement("ALTER TABLE slot_offers ADD CONSTRAINT slot_offers_status_check CHECK (status IN ('offered','accepted','lost','expired'))");
        $this->closesOnce('slot_offers', 'offered');

        Schema::table('queue_entries', fn (Blueprint $table) => $table->boolean('late_arrival')->default(false));
        Schema::table('appointments', fn (Blueprint $table) => $table->boolean('late_cancellation')->default(false));
        Schema::table('patients', function (Blueprint $table) {
            $table->timestampTz('confirmation_required_at')->nullable();
            $table->timestampTz('attendance_cleared_at')->nullable();
        });

        DB::statement("ALTER TABLE no_show_flags DROP CONSTRAINT no_show_flags_status_check");
        DB::statement("ALTER TABLE no_show_flags ADD CONSTRAINT no_show_flags_status_check CHECK (status IN ('open','confirmed','dismissed','cleared','released'))");

        DB::statement('ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_kind_check');
        DB::statement('ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('.self::KINDS_BEFORE.','.self::KINDS_ADDED.'))');

        // Settings: the new shapes and rows, from the catalog (the Owner had not saved these yet: the old values were our defaults).
        foreach (['automation_settings_key_check' => 'automation_settings', 'automation_deliveries_automation_check' => 'automation_deliveries'] as $constraint => $table) {
            $column = $table === 'automation_settings' ? 'key' : 'automation';
            DB::statement("ALTER TABLE $table DROP CONSTRAINT $constraint");
            DB::statement("ALTER TABLE $table ADD CONSTRAINT $constraint CHECK ($column IN ('".implode("','", self::KEYS)."'))");
        }
        $definitions = \App\Services\Automations\AutomationCatalog::definitions();
        foreach (['appointment_reminders', 'no_show', 'recall'] as $key) {
            DB::table('automation_settings')->where('key', $key)->whereNull('updated_by_user_id')
                ->update(['settings' => json_encode($definitions[$key][4]), 'enabled' => false, 'updated_at' => DB::raw('now()')]);
        }
        foreach (['fill_slots', 'attendance_policy', 'calendar_load'] as $key) {
            $policy = \App\Services\Automations\AutomationCatalog::isPolicy($key);
            DB::table('automation_settings')->insert(['key' => $key, 'enabled' => $policy && $definitions[$key][3], 'settings' => json_encode($definitions[$key][4]),
                'created_at' => DB::raw('now()'), 'updated_at' => DB::raw('now()')]);
        }
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE automation_settings DISABLE TRIGGER automation_settings_no_delete');
        DB::table('automation_settings')->whereIn('key', ['fill_slots', 'attendance_policy', 'calendar_load'])->delete();
        DB::statement('ALTER TABLE automation_settings ENABLE TRIGGER automation_settings_no_delete');
        Schema::dropIfExists('slot_offers');
        Schema::dropIfExists('slot_openings');
        Schema::dropIfExists('appointment_responses');
        foreach (['appointment_responses_append_only', 'slot_openings_closes_once', 'slot_offers_closes_once'] as $fn) DB::unprepared("DROP FUNCTION IF EXISTS $fn();");
        Schema::table('queue_entries', fn (Blueprint $table) => $table->dropColumn('late_arrival'));
        Schema::table('appointments', fn (Blueprint $table) => $table->dropColumn('late_cancellation'));
        Schema::table('patients', fn (Blueprint $table) => $table->dropColumn(['confirmation_required_at', 'attendance_cleared_at']));
    }

    private function appendOnly(string $table): void
    {
        DB::unprepared(<<<SQL
            CREATE OR REPLACE FUNCTION {$table}_append_only() RETURNS trigger AS \$\$
            BEGIN
                RAISE EXCEPTION '{$table} is append-only';
            END;
            \$\$ LANGUAGE plpgsql;
            CREATE TRIGGER {$table}_append_only BEFORE UPDATE OR DELETE ON {$table}
                FOR EACH ROW EXECUTE FUNCTION {$table}_append_only();
        SQL);
    }

    /** A row moves once from its first status to a final one and is never deleted. */
    private function closesOnce(string $table, string $first): void
    {
        DB::unprepared(<<<SQL
            CREATE OR REPLACE FUNCTION {$table}_closes_once() RETURNS trigger AS \$\$
            BEGIN
                IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '{$table} rows are never deleted'; END IF;
                IF OLD.status <> '{$first}' THEN RAISE EXCEPTION 'a closed {$table} row cannot change'; END IF;
                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
            CREATE TRIGGER {$table}_closes_once BEFORE UPDATE OR DELETE ON {$table}
                FOR EACH ROW EXECUTE FUNCTION {$table}_closes_once();
        SQL);
    }
};
