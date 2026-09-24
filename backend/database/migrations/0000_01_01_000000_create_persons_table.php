<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// PERSONS is the canonical shared identity hub (see ERD_ALIGNMENT.md / PHASE4B3_ONBOARDING_BOOKING.md's identity
// model, carried over from the frontend). USERS and PATIENTS each attach to a PERSON through their own person_id
// foreign key — PERSONS never references either of them. This migration runs before the users migration (its
// filename timestamp sorts first) so users.person_id can reference it.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('persons', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            // The canonical contact/identity email. Kept equal to the sibling users.email at registration time
            // (see RegisteredPatientController) but is its own column, not a foreign key to users — a Person may
            // exist with no User/login at all.
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('sex')->nullable();
            $table->string('address')->nullable();
            $table->timestamps();

            $table->unique('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('persons');
    }
};
