<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A5 waitlist: a Patient asks to be told when a time opens on a fully booked day (branch, service, optional Dentist, clinic
 * date). Nothing is held: the Patient still books through the normal booking command and its no-double-booking guard. An
 * entry moves once from waiting to notified, expired (the date passed) or cancelled (by the Patient); it is never deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('waitlist_entries', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->nullable()->constrained('dentist_profiles')->restrictOnDelete();
            $table->date('clinic_date');
            $table->string('status', 20)->default('waiting');
            $table->timestampTz('notified_at')->nullable();
            $table->timestampTz('closed_at')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'clinic_date']);
        });
        DB::statement("ALTER TABLE waitlist_entries ADD CONSTRAINT waitlist_entries_status_check CHECK (status IN ('waiting','notified','expired','cancelled'))");
        // One waiting entry per Patient for the same branch, service and day.
        DB::statement("CREATE UNIQUE INDEX waitlist_entries_one_waiting ON waitlist_entries (patient_id, branch_id, service_id, clinic_date) WHERE status = 'waiting'");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION waitlist_entries_guard() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'waitlist_entries rows are never deleted'; END IF;
                IF OLD.status <> 'waiting' THEN RAISE EXCEPTION 'a closed waitlist entry cannot change'; END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER waitlist_entries_guard BEFORE UPDATE OR DELETE ON waitlist_entries
                FOR EACH ROW EXECUTE FUNCTION waitlist_entries_guard();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('waitlist_entries');
        DB::unprepared('DROP FUNCTION IF EXISTS waitlist_entries_guard();');
    }
};
