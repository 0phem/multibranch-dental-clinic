<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// DENTIST_SERVICE_ASSIGNMENTS — which services a Dentist is authorized to perform (Phase 2A plan, section
// C/D). `is_authorized` is read optionally by the existing frontend (`logic.js`/`scheduling.js`'s
// `a.isAuthorized!==false` checks) and defaults true here to match. dentist_profile_id cascades (same
// reasoning as dentist_branches); service_id restricts.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dentist_service_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->boolean('is_authorized')->default(true);
            $table->timestamps();

            $table->unique(['dentist_profile_id', 'service_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dentist_service_assignments');
    }
};
