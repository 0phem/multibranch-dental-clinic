<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// PATIENTS is the sibling of USERS: both attach to the shared PERSONS hub through their own person_id foreign
// key. There is deliberately no patients.user_id column (that would model PATIENT -> USER, which the ERD does
// not) — see ERD_ALIGNMENT.md's identity-model clarification, carried into this real schema unchanged.
//
// This checkpoint (Backend Foundation 1A) is identity/auth only: no BRANCHES table exists yet, so there is no
// preferred_branch_id here (an approved future addition once the branch/appointment backend phase begins). The
// clinical/HMO/loyalty fields the frontend's local `patients` collection carries (allergies, medical history,
// HMO membership, etc.) are explicitly out of scope for this checkpoint and are not created here either.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('person_id')->unique()->constrained('persons')->cascadeOnDelete();
            // A human-readable reference, mirroring the frontend's PAT-#### convention. Not yet branch-scoped.
            $table->string('patient_code')->unique();
            $table->boolean('consent')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
