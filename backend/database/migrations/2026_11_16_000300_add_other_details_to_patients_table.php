<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * STF-04: Staff Counter Intake ID-Check — Other valid ID specification.
 *
 * Adds optional other_details column to patients to store specification text
 * when id_type = 'other'.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->string('other_details', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('other_details');
        });
    }
};
