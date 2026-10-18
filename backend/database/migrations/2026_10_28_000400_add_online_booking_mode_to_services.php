<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F7 consultation-first services (R2-17: braces and other sensitive services are not booked directly; the patient books the
 * consultation that leads to them). `online_booking`: 'bookable' (default, unchanged behaviour), 'consultation_first' (online
 * booking books `consultation_service_id` instead) or 'hidden' (not offered online; the front desk still books it).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->string('online_booking', 20)->default('bookable');
            $table->foreignId('consultation_service_id')->nullable()->constrained('services')->restrictOnDelete();
        });
        DB::statement("ALTER TABLE services ADD CONSTRAINT services_online_booking_check CHECK (online_booking IN ('bookable','consultation_first','hidden'))");
        DB::statement("ALTER TABLE services ADD CONSTRAINT services_consultation_pair CHECK ((online_booking = 'consultation_first') = (consultation_service_id IS NOT NULL) AND consultation_service_id IS DISTINCT FROM id)");
    }

    public function down(): void
    {
        Schema::table('services', fn (Blueprint $table) => $table->dropConstrainedForeignId('consultation_service_id'));
        Schema::table('services', fn (Blueprint $table) => $table->dropColumn('online_booking'));
    }
};
