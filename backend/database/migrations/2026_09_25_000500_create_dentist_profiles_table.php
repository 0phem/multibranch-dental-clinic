<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// DENTIST_PROFILES — the operational profile for a Dentist-role Person (Phase 2A plan, section C/D/E). Same
// person_id-anchored, no-redundant-user_id design as STAFF_PROFILES; see that migration's comment. A
// Dentist can work multiple branches (see dentist_branches, a later migration) — a real structural
// difference from Staff's single nullable branch_id, which is why these stay two separate tables rather
// than one with a discriminator column. `license_no` is nullable and unique-when-present (Postgres treats
// multiple NULLs as non-conflicting by default, so no partial-index workaround is needed) — current seed
// values are demo-format placeholders, never claimed as verified real license numbers. `assistant_staff_id`
// is nullOnDelete(): an informational link, not an identity dependency.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dentist_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_ref')->nullable()->unique();
            $table->string('legacy_user_ref')->nullable();
            $table->foreignId('person_id')->unique()->constrained('persons')->cascadeOnDelete();
            $table->string('license_no')->nullable()->unique();
            $table->string('specialty')->nullable();
            $table->time('shift_start');
            $table->time('shift_end');
            $table->boolean('available')->default(true);
            $table->foreignId('assistant_staff_id')->nullable()->constrained('staff_profiles')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dentist_profiles');
    }
};
