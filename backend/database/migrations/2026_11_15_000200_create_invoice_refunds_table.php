<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Invoice Refunds & Settlement Audit Trail.
 * Records finalized (settled) invoice refunds as an append-only ledger.
 * Adds refund_status to invoices without mutating the primary status machine.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_refunds', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('invoice_id')->constrained('invoices')->restrictOnDelete();
            $table->foreignId('payment_id')->constrained('payments')->restrictOnDelete();
            $table->string('provider_refund_id', 120)->nullable()->unique();
            $table->decimal('amount', 12, 2);
            $table->string('reason', 255);
            $table->timestampTz('refunded_at');
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->index(['invoice_id', 'refunded_at']);
        });

        DB::statement('ALTER TABLE invoice_refunds ADD CONSTRAINT invoice_refunds_amount_positive CHECK (amount > 0)');

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION invoice_refunds_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'invoice_refunds is append-only: modifications and deletions are forbidden';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER invoice_refunds_append_only
            BEFORE UPDATE OR DELETE ON invoice_refunds
            FOR EACH ROW EXECUTE FUNCTION invoice_refunds_append_only();
        SQL);

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('refund_status', 40)->default('none');
        });

        DB::statement("ALTER TABLE invoices ADD CONSTRAINT invoices_refund_status_check CHECK (refund_status IN ('none', 'partially_refunded', 'refunded'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_refund_status_check');
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('refund_status');
        });

        DB::unprepared('DROP TRIGGER IF EXISTS invoice_refunds_append_only ON invoice_refunds;');
        DB::unprepared('DROP FUNCTION IF EXISTS invoice_refunds_append_only();');
        Schema::dropIfExists('invoice_refunds');
    }
};
