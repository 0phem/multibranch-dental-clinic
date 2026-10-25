<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Expands patient_consents_type_check to support marketing and promotional communication consent.
 * Pure schema adjustment: does not assume or touch external database roles.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE patient_consents DROP CONSTRAINT IF EXISTS patient_consents_type_check');
        DB::statement("ALTER TABLE patient_consents ADD CONSTRAINT patient_consents_type_check CHECK (consent_type IN ('general_treatment', 'data_privacy', 'hmo_authorization', 'photography_consent', 'minor_treatment', 'marketing', 'promotional_sms'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE patient_consents DROP CONSTRAINT IF EXISTS patient_consents_type_check');
        DB::statement("ALTER TABLE patient_consents ADD CONSTRAINT patient_consents_type_check CHECK (consent_type IN ('general_treatment', 'data_privacy', 'hmo_authorization', 'photography_consent', 'minor_treatment'))");
    }
};
