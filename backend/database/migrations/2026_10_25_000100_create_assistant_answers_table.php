<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M7 Clinic Assistant knowledge base: the clinic's own, editable answers (Administration → Assistant answers). The assistant's
 * knowledge mode answers only from these entries and from live clinic records; nothing is hard-coded in the frontend.
 * `draft` marks an entry the clinic has not confirmed yet; `seed_key` lets the seeder add its entries once without ever
 * overwriting an Owner's edit. Schema only: no clinic data is inserted here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assistant_answers', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->string('seed_key', 60)->nullable()->unique();
            $table->string('question', 200);
            $table->string('answer', 1000);
            $table->jsonb('keywords')->default(DB::raw("'[]'::jsonb"));
            $table->string('category', 40);
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->boolean('active')->default(true);
            $table->boolean('draft')->default(true);
            $table->string('source', 200)->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->index(['active', 'category']);
        });
        DB::statement("ALTER TABLE assistant_answers ADD CONSTRAINT assistant_answers_keywords_array CHECK (jsonb_typeof(keywords) = 'array' AND jsonb_array_length(keywords) <= 40)");
        DB::statement("ALTER TABLE assistant_answers ADD CONSTRAINT assistant_answers_category_check CHECK (category IN ('about','services','branches','hours','booking','changes','payment','account','contact','care','hmo','other'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_answers');
    }
};
