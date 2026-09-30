<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('m11_billing_cutovers', function (Blueprint $table) {
            $table->id();
            $table->timestampTz('established_at');
            $table->timestampsTz();
        });
        DB::table('m11_billing_cutovers')->insert(['id' => 1, 'established_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::statement("CREATE SEQUENCE IF NOT EXISTS m11_invoice_number_seq START 1");
        DB::statement("CREATE SEQUENCE IF NOT EXISTS m11_receipt_number_seq START 1");

        Schema::create('invoices', function (Blueprint $table) {
            $table->id(); $table->ulid('public_id')->unique();
            $table->foreignId('treatment_id')->unique()->constrained('treatments')->restrictOnDelete();
            $table->foreignId('visit_id')->constrained('visits')->restrictOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->string('invoice_number')->unique();
            $table->string('status', 20); $table->unsignedInteger('revision')->default(1);
            $table->decimal('gross_amount', 12, 2)->default(0);
            $table->decimal('hmo_coverage_amount', 12, 2)->default(0);
            $table->decimal('patient_responsibility_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->string('hmo_status')->nullable(); $table->decimal('hmo_approved_amount', 12, 2)->nullable();
            $table->string('settlement_type')->nullable();
            $table->timestampTz('issued_at')->nullable(); $table->timestampTz('paid_at')->nullable();
            $table->foreignId('created_by_user_id')->constrained('users'); $table->foreignId('updated_by_user_id')->constrained('users');
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('Draft','Review','Issued','Paid'))");
        DB::statement("ALTER TABLE invoices ADD CONSTRAINT invoices_amounts_check CHECK (gross_amount >= 0 AND hmo_coverage_amount >= 0 AND hmo_coverage_amount <= gross_amount AND patient_responsibility_amount = gross_amount - hmo_coverage_amount AND paid_amount >= 0 AND paid_amount <= patient_responsibility_amount)");

        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->id(); $table->ulid('public_id')->unique();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->foreignId('service_price_id')->constrained('service_prices')->restrictOnDelete();
            $table->unsignedInteger('line_no'); $table->string('service_code'); $table->string('service_name');
            $table->unsignedInteger('quantity'); $table->decimal('unit_price', 12, 2); $table->decimal('line_total', 12, 2);
            $table->timestampsTz(); $table->unique(['invoice_id','line_no']);
        });
        DB::statement('ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_amount_check CHECK (quantity >= 1 AND unit_price >= 0 AND line_total = quantity * unit_price)');

        Schema::create('invoice_histories', function (Blueprint $table) {
            $table->id(); $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->string('event'); $table->string('from_status')->nullable(); $table->string('to_status')->nullable();
            $table->string('settlement_type')->nullable(); $table->jsonb('snapshot')->nullable();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete(); $table->timestampTz('occurred_at');
        });
        Schema::create('payments', function (Blueprint $table) {
            $table->id(); $table->ulid('public_id')->unique(); $table->foreignId('invoice_id')->unique()->constrained('invoices')->restrictOnDelete();
            $table->decimal('amount', 12, 2); $table->string('method', 30); $table->string('external_reference')->nullable();
            $table->foreignId('recorded_by_user_id')->constrained('users'); $table->timestampTz('recorded_at'); $table->timestampsTz();
        });
        Schema::create('receipts', function (Blueprint $table) {
            $table->id(); $table->ulid('public_id')->unique(); $table->foreignId('payment_id')->unique()->constrained('payments')->restrictOnDelete();
            $table->foreignId('invoice_id')->constrained('invoices')->restrictOnDelete(); $table->string('receipt_number')->unique();
            $table->decimal('amount', 12, 2); $table->string('method', 30); $table->string('external_reference')->nullable();
            $table->timestampTz('issued_at'); $table->timestampsTz();
        });
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION m11_financial_append_only() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'M11 financial evidence is immutable'; END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER receipts_append_only BEFORE UPDATE OR DELETE ON receipts FOR EACH ROW EXECUTE FUNCTION m11_financial_append_only();
            CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION m11_financial_append_only();
            CREATE TRIGGER invoice_histories_append_only BEFORE UPDATE OR DELETE ON invoice_histories FOR EACH ROW EXECUTE FUNCTION m11_financial_append_only();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('receipts'); Schema::dropIfExists('payments'); Schema::dropIfExists('invoice_histories'); Schema::dropIfExists('invoice_lines'); Schema::dropIfExists('invoices');
        DB::unprepared('DROP FUNCTION IF EXISTS m11_financial_append_only()'); DB::statement('DROP SEQUENCE IF EXISTS m11_receipt_number_seq'); DB::statement('DROP SEQUENCE IF EXISTS m11_invoice_number_seq'); Schema::dropIfExists('m11_billing_cutovers');
    }
};
