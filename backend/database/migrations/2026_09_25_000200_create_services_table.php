<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// SERVICES — see Phase 2A plan, section C/F. `reference_fee_php` is project/demo/reference configuration
// only — it is NEVER clinic-confirmed pricing, even for the services whose value happens to fall inside an
// interview-quoted range (the interview supports price *ranges* for 3 services, never an exact confirmed
// figure; CLAUDE_OPERATING_MODE.md §8). No column here claims exact-value confirmation. `duration_minutes`
// is required NOT NULL because the scheduling engine has an unconditional dependency on it, but its
// specific value is project/technical configuration, not a clinic-interview fact. `code` is a
// project/system-generated technical identifier, not a claimed clinic-supplied code.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_ref')->nullable()->unique();
            $table->string('code')->unique();
            $table->string('name');
            $table->unsignedSmallInteger('duration_minutes');
            $table->decimal('reference_fee_php', 10, 2)->nullable();
            $table->string('category');
            $table->string('status')->default('Active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
