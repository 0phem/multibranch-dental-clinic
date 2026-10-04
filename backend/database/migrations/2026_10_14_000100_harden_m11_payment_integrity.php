<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M11 payment integrity. Forward-only; no existing row is changed or removed.
//
// 1. payment_checkout_sessions: every hosted-checkout session the server creates is recorded (the provider's session id, the
//    invoice, the exact amount and who initiated it), so a provider event can be bound to a session WE created for THAT invoice
//    and amount instead of trusting an invoice reference inside the event.
// 2. payment_provider_events: every verified provider event is stored by its provider event id BEFORE it is acted on. This is
//    the duplicate-delivery guard the provider requires and the reconciliation record: an externally captured payment that
//    cannot be applied (amount mismatch, held invoice, second payment for a paid invoice, unknown session) stays here as
//    "Needs review" instead of disappearing. No raw payload, headers or credentials are stored.
// 3. One provider payment id can settle one payment only; and the financial CHECK constraints below state invariants the
//    code already enforces (a Paid invoice is fully settled; full-HMO settlement is Paid with nothing paid by the Patient; a
//    payment or receipt is never zero or negative). They are NOT VALID so any legacy row cannot block deployment, but they
//    bind every new or changed row.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_checkout_sessions', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('invoice_id')->constrained('invoices')->restrictOnDelete();
            $table->string('provider', 20)->default('paymongo');
            $table->string('provider_session_id', 120)->unique();
            $table->text('checkout_url')->nullable(); // lets a repeated initiation return the same hosted page instead of opening another
            $table->decimal('amount', 12, 2);
            $table->char('currency', 3)->default('PHP');
            $table->string('status', 20)->default('Open');
            $table->foreignId('initiated_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampsTz();
            $table->index('invoice_id');
        });
        DB::statement("ALTER TABLE payment_checkout_sessions ADD CONSTRAINT payment_checkout_sessions_status_check CHECK (status IN ('Open','Settled','Superseded'))");
        // At most ONE locally open session per invoice (the invoice row lock serializes creation; this index is the last guard).
        DB::statement("CREATE UNIQUE INDEX payment_checkout_sessions_one_open_per_invoice ON payment_checkout_sessions (invoice_id) WHERE status = 'Open'");
        DB::statement('ALTER TABLE payment_checkout_sessions ADD CONSTRAINT payment_checkout_sessions_amount_check CHECK (amount > 0)');

        Schema::create('payment_provider_events', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('provider', 20)->default('paymongo');
            $table->string('provider_event_id', 120)->unique();
            $table->string('event_type', 100);
            $table->string('provider_session_id', 120)->nullable()->index();
            $table->string('provider_payment_id', 120)->nullable();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->restrictOnDelete();
            $table->unsignedBigInteger('amount_centavos')->nullable();
            $table->char('currency', 3)->nullable();
            $table->string('status', 20)->default('Received');
            $table->string('reason', 60)->nullable();
            $table->timestampTz('received_at');
            $table->timestampTz('processed_at')->nullable();
            $table->timestampsTz();
            $table->index('status');
        });
        DB::statement("ALTER TABLE payment_provider_events ADD CONSTRAINT payment_provider_events_status_check CHECK (status IN ('Received','Settled','Duplicate','Needs review','Ignored'))");

        // A provider payment id may be applied once. Manual references (POS slips, bank references) are not provider-unique, so
        // the constraint is limited to the provider-recorded method label.
        DB::statement("CREATE UNIQUE INDEX payments_provider_reference_unique ON payments (external_reference) WHERE method LIKE 'PayMongo%' AND external_reference IS NOT NULL");

        DB::statement("ALTER TABLE invoices ADD CONSTRAINT invoices_paid_settled_check CHECK (status <> 'Paid' OR paid_amount = patient_responsibility_amount) NOT VALID");
        DB::statement("ALTER TABLE invoices ADD CONSTRAINT invoices_settlement_type_check CHECK (settlement_type IS NULL OR (settlement_type = 'full_hmo_coverage' AND status = 'Paid' AND paid_amount = 0 AND patient_responsibility_amount = 0)) NOT VALID");
        DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_positive_check CHECK (amount > 0) NOT VALID');
        DB::statement('ALTER TABLE receipts ADD CONSTRAINT receipts_amount_positive_check CHECK (amount > 0) NOT VALID');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_amount_positive_check');
        DB::statement('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_positive_check');
        DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_settlement_type_check');
        DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_paid_settled_check');
        DB::statement('DROP INDEX IF EXISTS payments_provider_reference_unique');
        Schema::dropIfExists('payment_provider_events');
        Schema::dropIfExists('payment_checkout_sessions');
    }
};
