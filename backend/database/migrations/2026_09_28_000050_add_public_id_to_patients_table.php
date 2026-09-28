<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

// Shared identifier prerequisite (CONTRACTS.md §1) needed by M6: patients keep their internal bigint id and their
// clinic-facing patient_code; public_id is the ULID API/resource identity. Existing rows are backfilled one by one
// (non-destructive, idempotent: only NULLs are filled) before the column becomes NOT NULL + UNIQUE. This is the only
// change to M4's table in this pass.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->char('public_id', 26)->nullable()->after('id');
        });

        DB::table('patients')->whereNull('public_id')->orderBy('id')->select('id')->each(function ($row) {
            DB::table('patients')->where('id', $row->id)->update(['public_id' => strtolower((string) Str::ulid())]);
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->char('public_id', 26)->nullable(false)->change();
            $table->unique('public_id');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropUnique(['public_id']);
            $table->dropColumn('public_id');
        });
    }
};
