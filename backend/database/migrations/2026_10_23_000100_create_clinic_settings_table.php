<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// White-label settings (decision 12): the clinic's name, sender name, contact details, email/PDF design, brand colours and logo,
// edited by the Owner. One row per setting; a missing row means "use the default" from config/clinic.php.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinic_settings', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->jsonb('value')->nullable();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_settings');
    }
};
