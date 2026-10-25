<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GEN-11: Replaces hard deletes with role-scoped soft-delete archive metadata.
 * Adds archived_at, archived_by_user_id, and archive_reason to invoices, visits,
 * prescriptions, and user_notifications. All columns are nullable and backward-compatible.
 */
return new class extends Migration
{
    private const TABLES = ['invoices', 'visits', 'prescriptions', 'user_notifications'];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->timestampTz('archived_at')->nullable();
                $table->foreignId('archived_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
                $table->text('archive_reason')->nullable();
                $table->index('archived_at');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropIndex(['archived_at']);
                $table->dropConstrainedForeignId('archived_by_user_id');
                $table->dropColumn(['archived_at', 'archive_reason']);
            });
        }
    }
};
