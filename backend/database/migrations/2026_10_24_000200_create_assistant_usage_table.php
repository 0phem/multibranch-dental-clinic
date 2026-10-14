<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// M7 Clinic Assistant usage log: one row per question for the per-patient daily cap and for monitoring. It records WHO asked,
// WHEN, in which mode (ai / fallback / refused), the tool names used and token counts — never the question or the answer.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assistant_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('clinic_date');
            $table->string('mode', 20);
            $table->string('outcome', 30);
            $table->jsonb('tools')->nullable();
            $table->unsignedInteger('input_tokens')->nullable();
            $table->unsignedInteger('output_tokens')->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->timestampTz('created_at');
            $table->index(['user_id', 'clinic_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_usage');
    }
};
