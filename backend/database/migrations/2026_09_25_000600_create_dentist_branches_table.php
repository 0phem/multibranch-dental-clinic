<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// DENTIST_BRANCHES — the many-to-many join recording which branches a Dentist works at (Phase 2A plan,
// section C/D). Promoted to a full model rather than an implicit pivot so Owner assignment/unassignment has
// its own timestamps. dentist_profile_id cascades (a join row has no meaning once its owning profile is
// gone); branch_id restricts (protects future Appointment-reachable history — plan section D/L).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dentist_branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dentist_profile_id')->constrained('dentist_profiles')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['dentist_profile_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dentist_branches');
    }
};
