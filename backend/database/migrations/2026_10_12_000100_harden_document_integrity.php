<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// M14 integrity hardening. Forward-only and non-destructive: no row is changed or removed. (1) A stored object path can
// belong to one document only. (2) Patient documents and consent records are clinical/legal evidence, so a Patient can no
// longer be deleted out from under them (the foreign keys were ON DELETE CASCADE, which would have silently dropped the
// metadata rows and orphaned the private files); retention/deletion policy is undecided, so the safe default is to refuse.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->unique('file_path');
            $table->dropForeign(['patient_id']);
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
        });
        Schema::table('patient_consents', function (Blueprint $table) {
            $table->dropForeign(['patient_id']);
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('patient_consents', function (Blueprint $table) {
            $table->dropForeign(['patient_id']);
            $table->foreign('patient_id')->references('id')->on('patients')->cascadeOnDelete();
        });
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['patient_id']);
            $table->foreign('patient_id')->references('id')->on('patients')->cascadeOnDelete();
            $table->dropUnique(['file_path']);
        });
    }
};
