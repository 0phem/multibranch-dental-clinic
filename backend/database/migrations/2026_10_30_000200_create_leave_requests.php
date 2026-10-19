<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M15 Leave Management. A dentist or staff member asks for leave (vacation, sick, other) over an instant range (full or
 * partial days, Asia/Manila). Pending → Approved | Declined; Pending or Approved → Cancelled. Approved dentist leave blocks
 * that dentist's booking time through M3. The private note is encrypted and shown only to the requester and the approver.
 * No balances or entitlements (the clinic gave no policy). Never deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('requester_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('dentist_profile_id')->nullable()->constrained('dentist_profiles')->restrictOnDelete();
            $table->foreignId('staff_profile_id')->nullable()->constrained('staff_profiles')->restrictOnDelete();
            $table->string('type', 12);
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->text('private_note')->nullable();
            $table->string('status', 10)->default('Pending');
            $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('decided_at')->nullable();
            $table->foreignId('cancelled_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampTz('patients_notified_at')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'starts_at']);
            $table->index(['dentist_profile_id', 'status']);
        });
        DB::statement("ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_type_check CHECK (type IN ('vacation','sick','other'))");
        DB::statement("ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check CHECK (status IN ('Pending','Approved','Declined','Cancelled'))");
        DB::statement('ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_range_check CHECK (starts_at < ends_at)');
        DB::statement('ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_person_check CHECK (dentist_profile_id IS NOT NULL OR staff_profile_id IS NOT NULL)');
        DB::statement("ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_decision_check CHECK (status NOT IN ('Approved','Declined') OR decided_at IS NOT NULL)");
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION leave_requests_no_delete() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'leave_requests rows are never deleted; cancel them'; END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER leave_requests_no_delete BEFORE DELETE ON leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_no_delete();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_requests');
        DB::unprepared('DROP FUNCTION IF EXISTS leave_requests_no_delete();');
    }
};
