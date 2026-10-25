<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds high-impact foreign key and revenue analytics indexes concurrently.
 * public $withinTransaction = false enables non-blocking CREATE INDEX CONCURRENTLY in PostgreSQL.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    private const INDEXES = [
        'payments_recorded_at_index' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_recorded_at_index ON payments (recorded_at)',
        'invoices_analytics_index' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_analytics_index ON invoices (branch_id, status, paid_at)',
        'invoices_patient_id_index' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_patient_id_index ON invoices (patient_id)',
        'invoices_visit_id_index' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_visit_id_index ON invoices (visit_id)',
        'prescriptions_patient_id_index' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS prescriptions_patient_id_index ON prescriptions (patient_id)',
        'prescriptions_visit_id_index' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS prescriptions_visit_id_index ON prescriptions (visit_id)',
        'appointments_service_id_index' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS appointments_service_id_index ON appointments (service_id)',
        'treatment_procedures_service_id_index' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS treatment_procedures_service_id_index ON treatment_procedures (service_id)',
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::INDEXES) as $indexName) {
            DB::statement("DROP INDEX CONCURRENTLY IF EXISTS {$indexName}");
        }
    }
};
