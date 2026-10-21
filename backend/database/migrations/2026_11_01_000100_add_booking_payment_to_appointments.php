<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Section 22.3 / Decision 13: Online payment at booking via PayMongo.
// Adds booking payment columns to appointments (fee, status, 15-minute hold expiry, payment and refund references).
// Generalizes payment_checkout_sessions and payment_provider_events so a session can belong to either an invoice or an appointment.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->decimal('booking_fee_php', 10, 2)->nullable();
            $table->string('booking_payment_status', 20)->default('unpaid');
            $table->timestampTz('booking_hold_expires_at')->nullable();
            $table->string('booking_payment_method', 60)->nullable();
            $table->string('booking_payment_ref', 120)->nullable();
            $table->timestampTz('booking_paid_at')->nullable();
            $table->string('booking_refund_ref', 120)->nullable();
            $table->timestampTz('booking_refunded_at')->nullable();
            $table->index(['status', 'booking_payment_status', 'booking_hold_expires_at'], 'appointments_booking_hold_index');
        });
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_booking_payment_status_check CHECK (booking_payment_status IN ('unpaid', 'held', 'paid', 'refunded', 'partially_refunded', 'forfeited'))");

        Schema::table('payment_checkout_sessions', function (Blueprint $table) {
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->restrictOnDelete();
        });
        DB::statement('ALTER TABLE payment_checkout_sessions ALTER COLUMN invoice_id DROP NOT NULL');
        DB::statement("CREATE UNIQUE INDEX payment_checkout_sessions_one_open_per_appointment ON payment_checkout_sessions (appointment_id) WHERE status = 'Open'");
        DB::statement("ALTER TABLE payment_checkout_sessions ADD CONSTRAINT payment_checkout_sessions_target_check CHECK ((invoice_id IS NOT NULL AND appointment_id IS NULL) OR (invoice_id IS NULL AND appointment_id IS NOT NULL))");

        Schema::table('payment_provider_events', function (Blueprint $table) {
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->restrictOnDelete();
        });

        DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_settlement_type_check');
        DB::statement("ALTER TABLE invoices ADD CONSTRAINT invoices_settlement_type_check CHECK (settlement_type IS NULL OR (settlement_type = 'full_hmo_coverage' AND status = 'Paid' AND paid_amount = 0 AND patient_responsibility_amount = 0) OR (settlement_type IN ('booking_deposit', 'partial_booking_deposit')))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_settlement_type_check');
        DB::statement("ALTER TABLE invoices ADD CONSTRAINT invoices_settlement_type_check CHECK (settlement_type IS NULL OR (settlement_type = 'full_hmo_coverage' AND status = 'Paid' AND paid_amount = 0 AND patient_responsibility_amount = 0)) NOT VALID");

        Schema::table('payment_provider_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('appointment_id');
        });

        DB::statement('ALTER TABLE payment_checkout_sessions DROP CONSTRAINT IF EXISTS payment_checkout_sessions_target_check');
        DB::statement('DROP INDEX IF EXISTS payment_checkout_sessions_one_open_per_appointment');
        DB::statement('ALTER TABLE payment_checkout_sessions ALTER COLUMN invoice_id SET NOT NULL');
        Schema::table('payment_checkout_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('appointment_id');
        });

        DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_booking_payment_status_check');
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex('appointments_booking_hold_index');
            $table->dropColumn([
                'booking_fee_php',
                'booking_payment_status',
                'booking_hold_expires_at',
                'booking_payment_method',
                'booking_payment_ref',
                'booking_paid_at',
                'booking_refund_ref',
                'booking_refunded_at',
            ]);
        });
    }
};
