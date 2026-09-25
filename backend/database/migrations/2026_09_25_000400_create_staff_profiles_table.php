<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// STAFF_PROFILES — the operational profile for a Staff-role Person (Phase 2A plan, section C/D/E). Anchored
// on person_id (unique, 1:1), not user_id — the ERD's own cross-table rule requires the profile reference
// the same PERSON its USER account uses; the linked User (if any) is reachable via Person::user(), so no
// redundant user_id foreign key is stored here. `legacy_user_ref` is a plain string, NOT a foreign key — a
// purely transitional value matching today's frontend `INITIAL_STAFF[i].userId` so the bridge can still
// resolve `state.users` (which stays local/unchanged this phase) exactly as before; account activity/status
// itself is explicitly NOT backend-authoritative this phase (plan section G). `branch_id` is nullable —
// NULL reproduces today's "All Branches" sentinel and is operational-assignment metadata ONLY, never an
// authorization/access-scope grant (plan section I). `legacy_ref` is the same transitional bridge key
// pattern as `branches`/`services`.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_ref')->nullable()->unique();
            $table->string('legacy_user_ref')->nullable();
            $table->foreignId('person_id')->unique()->constrained('persons')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->time('shift_start');
            $table->time('shift_end');
            $table->boolean('available')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_profiles');
    }
};
