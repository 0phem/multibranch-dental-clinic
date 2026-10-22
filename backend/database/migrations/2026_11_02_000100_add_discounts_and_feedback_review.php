<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. M21 Billing: Senior Citizen & PWD statutory 20% discount (RA 9994 / RA 10754)
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('discount_type', 30)->nullable()->after('gross_amount');
            $table->string('discount_id_number', 50)->nullable()->after('discount_type');
            $table->decimal('discount_amount', 12, 2)->default(0)->after('discount_id_number');
        });

        // Update invoices_amounts_check constraint to include discount_amount
        DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_amounts_check');
        DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_amounts_check CHECK (
            gross_amount >= 0 
            AND discount_amount >= 0 
            AND hmo_coverage_amount >= 0 
            AND (discount_amount + hmo_coverage_amount) <= gross_amount 
            AND patient_responsibility_amount = (gross_amount - discount_amount - hmo_coverage_amount) 
            AND paid_amount >= 0 
            AND paid_amount <= patient_responsibility_amount
        )');

        // 2. M26 Feedback: 1-5 Star Rating
        Schema::table('patient_feedback', function (Blueprint $table) {
            $table->unsignedSmallInteger('rating')->nullable()->after('visit_id');
        });
        DB::statement('ALTER TABLE patient_feedback ADD CONSTRAINT patient_feedback_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))');

        // 3. M20 Follow-Up: allow 'feedback' as a valid source
        DB::statement('ALTER TABLE followup_tasks DROP CONSTRAINT IF EXISTS followup_tasks_source_check');
        DB::statement("ALTER TABLE followup_tasks ADD CONSTRAINT followup_tasks_source_check CHECK (source IN ('treatment','dentist','front_desk','feedback'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE followup_tasks DROP CONSTRAINT IF EXISTS followup_tasks_source_check');
        DB::statement("ALTER TABLE followup_tasks ADD CONSTRAINT followup_tasks_source_check CHECK (source IN ('treatment','dentist','front_desk'))");

        DB::statement('ALTER TABLE patient_feedback DROP CONSTRAINT IF EXISTS patient_feedback_rating_check');
        Schema::table('patient_feedback', function (Blueprint $table) {
            $table->dropColumn('rating');
        });

        DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_amounts_check');
        DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_amounts_check CHECK (
            gross_amount >= 0 
            AND hmo_coverage_amount >= 0 
            AND hmo_coverage_amount <= gross_amount 
            AND patient_responsibility_amount = gross_amount - hmo_coverage_amount 
            AND paid_amount >= 0 
            AND paid_amount <= patient_responsibility_amount
        )');

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['discount_type', 'discount_id_number', 'discount_amount']);
        });
    }
};
