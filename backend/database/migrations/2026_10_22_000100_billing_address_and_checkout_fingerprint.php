<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Decision 9: an optional structured billing address the Patient may save for online payments (line1, line2, city, state,
// postal_code, country — the keys PayMongo documents). Saved only when the Patient ticks "save"; empty by default.
// A checkout session records a fingerprint of what was sent to PayMongo (amount, line items, billing details, methods), so an
// open session is reused only for an identical request; anything else retires it and starts a new one.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->jsonb('billing_address')->nullable();
        });
        DB::statement("ALTER TABLE patients ADD CONSTRAINT patients_billing_address_object_check CHECK (billing_address IS NULL OR jsonb_typeof(billing_address) = 'object')");
        Schema::table('payment_checkout_sessions', function (Blueprint $table) {
            $table->char('request_fingerprint', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payment_checkout_sessions', function (Blueprint $table) {
            $table->dropColumn('request_fingerprint');
        });
        DB::statement('ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_billing_address_object_check');
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('billing_address');
        });
    }
};
