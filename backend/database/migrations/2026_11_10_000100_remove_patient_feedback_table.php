<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Remove feedback source from followup_tasks
        DB::statement('ALTER TABLE followup_tasks DROP CONSTRAINT IF EXISTS followup_tasks_source_check');
        DB::statement("UPDATE followup_tasks SET source = 'front_desk' WHERE source = 'feedback'");
        DB::statement("ALTER TABLE followup_tasks ADD CONSTRAINT followup_tasks_source_check CHECK (source IN ('treatment','dentist','front_desk'))");

        // 2. Drop immutable trigger & function on patient_feedback
        DB::unprepared('DROP TRIGGER IF EXISTS patient_feedback_no_update_delete ON patient_feedback;');
        DB::unprepared('DROP FUNCTION IF EXISTS patient_feedback_immutable();');

        // 3. Drop patient_feedback table cleanly
        Schema::dropIfExists('patient_feedback');
    }

    public function down(): void
    {
        Schema::create('patient_feedback', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('visit_id')->constrained('visits')->restrictOnDelete();
            $table->unsignedSmallInteger('rating')->nullable();
            $table->text('body');
            $table->timestampTz('submitted_at');
        });

        DB::statement('ALTER TABLE followup_tasks DROP CONSTRAINT IF EXISTS followup_tasks_source_check');
        DB::statement("ALTER TABLE followup_tasks ADD CONSTRAINT followup_tasks_source_check CHECK (source IN ('treatment','dentist','front_desk','feedback'))");
    }
};
