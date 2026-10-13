<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Decision 8: optional BIR registration details per branch, printed on the Payment Receipt and Invoice (email and PDF) only
// when filled in. All empty by default; nothing is assumed about a branch's registration. The documents are titled "Payment
// Receipt" and "Invoice" whatever is filled in here.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->string('bir_registered_name', 255)->nullable();
            $table->string('bir_tin', 30)->nullable();
            $table->string('bir_registered_address', 255)->nullable();
            $table->string('bir_vat_status', 10)->nullable();
            $table->string('bir_permit_numbers', 255)->nullable();
        });
        DB::statement("ALTER TABLE branches ADD CONSTRAINT branches_bir_vat_status_check CHECK (bir_vat_status IS NULL OR bir_vat_status IN ('vat','non_vat'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_bir_vat_status_check');
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn(['bir_registered_name', 'bir_tin', 'bir_registered_address', 'bir_vat_status', 'bir_permit_numbers']);
        });
    }
};
