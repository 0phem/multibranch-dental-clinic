<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// BRANCH_SERVICES — the join between BRANCHES and SERVICES (Phase 2A plan, section C). restrictOnDelete()
// on both foreign keys on purpose: a future Appointment (Phase 2B) will reference these rows transitively,
// so a Branch/Service must be deactivated (status/active flags), never hard-deleted while assignments
// exist — see the plan's delete-behavior decision (section D/L). `duration_override_minutes` is read
// optionally by the existing frontend (`logic.js`'s `assignment?.durationOverride`) and is never populated
// by the current seed data, but the column must exist for that code path to keep working unchanged.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branch_services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('duration_override_minutes')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'service_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_services');
    }
};
