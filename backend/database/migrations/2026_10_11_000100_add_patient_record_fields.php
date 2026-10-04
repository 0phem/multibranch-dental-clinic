<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// M4 Patient record hardening. Forward-only and additive: existing rows keep their internal ids, public_ids and
// patient_codes, and every new column is nullable or defaulted. `revision` is the optimistic-concurrency token for
// Patient/Person profile edits (a stale edit is refused with 409). `emergency_contact` and `preferred_branch_id` are the
// non-clinical, Staff-maintained fields the frontend prototype already carried (preferred_branch_id was named as an
// approved future addition in the create_patients_table migration). No clinical/medical/dental history column is added:
// the clinical history schema and its mandatory fields are an undecided clinic/clinical policy.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->unsignedInteger('revision')->default(1);
            $table->string('emergency_contact', 500)->nullable();
            $table->foreignId('preferred_branch_id')->nullable()->constrained('branches')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('preferred_branch_id');
            $table->dropColumn(['emergency_contact', 'revision']);
        });
    }
};
