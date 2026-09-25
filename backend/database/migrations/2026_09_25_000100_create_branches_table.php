<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// BRANCHES is the first Phase 2A reference-data table (see Phase 2A plan, section C). `legacy_ref` is a
// purely transitional bridge key — it lets the still-frontend-local collections (appointments, queue,
// treatments, etc.) keep referencing today's string ids ('b1', 'b2', 'b3') unchanged while this table's
// real primary key stays an ordinary bigint. It is never exposed as a business fact and is retired once
// those collections migrate to real backend foreign keys in a later phase. `branch_code` is a
// project/system-generated technical identifier ('BRC-A') — there is no evidence the clinic ever supplied
// this value, so it is never described as clinic-confirmed. `latitude`/`longitude` are seeded NULL and stay
// that way this phase (CLAUDE_OPERATING_MODE.md §6: never invent coordinates outside test fixtures).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_ref')->nullable()->unique();
            $table->string('branch_code')->unique();
            $table->string('name')->unique();
            $table->string('city');
            $table->string('address');
            $table->string('phone')->nullable();
            $table->time('open_time');
            $table->time('close_time');
            $table->string('status')->default('Open');
            $table->unsignedSmallInteger('capacity_threshold')->default(80);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
