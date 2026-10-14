<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * The clinic's own database (dental_clinic) is never used for demo data or demo checks by accident. backend/.env points at it,
 * so demo commands must name the demo database (DB_DATABASE=dental_clinic_demo). Running a guarded command on the clinic database
 * needs the deliberate flag ALLOW_CLINIC_DATABASE=yes (environment variable), e.g. an approved, reviewed migration step.
 */
class ClinicDatabaseGuard
{
    public const CLINIC_DATABASE = 'dental_clinic';

    public static function onClinicDatabase(): bool
    {
        $configured = (string) DB::connection()->getDatabaseName();
        if ($configured === self::CLINIC_DATABASE) return true;
        try {
            return DB::selectOne('select current_database() as name')?->name === self::CLINIC_DATABASE;
        } catch (\Throwable) {
            return false;
        }
    }

    /** A refusal message for $what, or null when it may run here. */
    public static function refusal(string $what): ?string
    {
        if (! self::onClinicDatabase() || getenv('ALLOW_CLINIC_DATABASE') === 'yes') return null;

        return "$what refuses to run on the clinic database ".self::CLINIC_DATABASE.'. Use DB_DATABASE=dental_clinic_demo, '
            .'or set ALLOW_CLINIC_DATABASE=yes only for an approved change.';
    }
}
