<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Patient portal (real data only):
//  - branches.operating_days: ISO weekdays (1 = Monday … 7 = Sunday) the branch takes appointments; NULL = every day. The interview
//    (Q10) says weekends are busier, so no day is closed by default; the Owner sets closed days per branch.
//  - services.description: a short patient-facing description (optional).
//  - invoices.billed_to_name / receipts.received_from_name: the Patient's name as it was when the document was issued or paid
//    (decision 2: a later name correction never changes an issued document). Set when an invoice is issued and when a receipt
//    is created. Existing rows are NOT backfilled: issued financial evidence is immutable (M11 triggers), so documents issued
//    before this change show the current name.
//  - user_notifications: identity-specific notifications written only by real server events (appointment booked or changed,
//    invoice issued, payment received, new message). Never message content.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->jsonb('operating_days')->nullable();
        });
        DB::statement("ALTER TABLE branches ADD CONSTRAINT branches_operating_days_check CHECK (operating_days IS NULL OR jsonb_typeof(operating_days) = 'array')");
        Schema::table('services', function (Blueprint $table) {
            $table->string('description', 300)->nullable();
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('billed_to_name', 255)->nullable();
        });
        Schema::table('receipts', function (Blueprint $table) {
            $table->string('received_from_name', 255)->nullable();
        });

        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('kind', 40);
            $table->string('title', 160);
            $table->string('body', 300)->nullable();
            $table->string('target_page', 30)->nullable();
            $table->string('target_id', 40)->nullable();
            $table->string('dedupe_key', 191)->unique();
            $table->timestampTz('created_at');
            $table->timestampTz('read_at')->nullable();
            $table->index(['user_id', 'read_at', 'id']);
        });
        DB::statement("ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('appointment_booked','appointment_rescheduled','appointment_cancelled','invoice_issued','payment_received','message_received'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
        Schema::table('receipts', fn (Blueprint $table) => $table->dropColumn('received_from_name'));
        Schema::table('invoices', fn (Blueprint $table) => $table->dropColumn('billed_to_name'));
        Schema::table('services', fn (Blueprint $table) => $table->dropColumn('description'));
        DB::statement('ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_operating_days_check');
        Schema::table('branches', fn (Blueprint $table) => $table->dropColumn('operating_days'));
    }
};
