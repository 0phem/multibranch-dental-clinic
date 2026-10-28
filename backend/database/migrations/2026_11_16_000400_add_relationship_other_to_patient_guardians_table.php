<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_guardians', function (Blueprint $table) {
            $table->string('relationship_other', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('patient_guardians', function (Blueprint $table) {
            $table->dropColumn('relationship_other');
        });
    }
};
