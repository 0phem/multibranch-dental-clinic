<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Idempotency records for M6 commands (CONTRACTS.md §2: a replay returns the original result instead of acting
// twice). A key is scoped to the account that sent it. The row is written inside the same transaction as the
// command, so a failed command leaves no key behind and a concurrent duplicate waits on the unique index, then
// replays the committed response. `request_hash` detects a key reused for a different request.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointment_command_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('idempotency_key', 255);
            $table->string('command');
            $table->char('request_hash', 64);
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->restrictOnDelete();
            $table->unsignedSmallInteger('response_status')->nullable();
            // json (not jsonb) keeps the stored response byte-for-byte, so a replay is the original result.
            $table->json('response_body')->nullable();
            $table->timestampTz('created_at');

            $table->unique(['user_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_command_keys');
    }
};
