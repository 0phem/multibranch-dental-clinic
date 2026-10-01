<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('visit_id')->nullable()->constrained('visits')->nullOnDelete();
            $table->foreignId('hmo_case_id')->nullable()->constrained('hmo_cases')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('category', 64);
            $table->string('title', 255);
            $table->string('file_path', 512);
            $table->string('original_filename', 255);
            $table->string('mime_type', 128);
            $table->unsignedBigInteger('file_size_bytes');
            $table->char('checksum_sha256', 64);
            $table->string('status', 32)->default('Active');
            $table->jsonb('metadata')->nullable();
            $table->foreignId('uploaded_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('retracted_at')->nullable();
            $table->foreignId('retracted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('retraction_reason', 255)->nullable();
            $table->timestampsTz();

            $table->index(['patient_id', 'status']);
            $table->index('visit_id');
            $table->index('hmo_case_id');
            $table->index('checksum_sha256');
        });

        DB::statement("ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('Active', 'Archived', 'Retracted'))");
        DB::statement("ALTER TABLE documents ADD CONSTRAINT documents_category_check CHECK (category IN ('hmo_card', 'valid_id', 'treatment_request', 'clinical_attachment', 'consent_document', 'referral', 'other'))");
        DB::statement("ALTER TABLE documents ADD CONSTRAINT documents_size_check CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760)"); // 10MB limit

        Schema::create('patient_consents', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('document_id')->nullable()->constrained('documents')->nullOnDelete();
            $table->string('consent_type', 64);
            $table->string('version', 32)->default('1.0');
            $table->string('status', 32)->default('Granted');
            $table->text('notes')->nullable();
            $table->timestampTz('signed_at');
            $table->timestampTz('withdrawn_at')->nullable();
            $table->foreignId('recorded_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampsTz();

            $table->index(['patient_id', 'consent_type']);
        });

        DB::statement("ALTER TABLE patient_consents ADD CONSTRAINT patient_consents_status_check CHECK (status IN ('Granted', 'Withdrawn'))");
        DB::statement("ALTER TABLE patient_consents ADD CONSTRAINT patient_consents_type_check CHECK (consent_type IN ('general_treatment', 'data_privacy', 'hmo_authorization', 'photography_consent', 'minor_treatment'))");

        Schema::create('document_extractions', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            $table->string('extraction_method', 64)->default('native_text');
            $table->string('status', 32)->default('Draft');
            $table->text('raw_text')->nullable();
            $table->jsonb('structured_payload')->nullable();
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->timestampTz('extracted_at');
            $table->timestampsTz();

            $table->index('document_id');
        });

        DB::statement("ALTER TABLE document_extractions ADD CONSTRAINT document_extractions_status_check CHECK (status IN ('Draft', 'Reviewed', 'Rejected'))");
        DB::statement("ALTER TABLE document_extractions ADD CONSTRAINT document_extractions_method_check CHECK (extraction_method IN ('native_text', 'heuristic_parser', 'ocr_simulation', 'manual_paste'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('document_extractions');
        Schema::dropIfExists('patient_consents');
        Schema::dropIfExists('documents');
    }
};
