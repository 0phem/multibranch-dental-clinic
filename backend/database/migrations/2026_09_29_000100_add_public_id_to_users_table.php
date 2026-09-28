<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

// M1 identifier cutover (CONTRACTS.md §1): users keep their internal bigint id (every foreign key still points at it)
// and gain a ULID public_id, the only user identifier the API accepts or returns. Existing rows — including
// soft-deleted ones — are backfilled one by one (only NULLs are filled, so re-running is harmless) before the column
// becomes NOT NULL + UNIQUE. Same pattern as the patients.public_id prerequisite.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->char('public_id', 26)->nullable()->after('id');
        });

        DB::table('users')->whereNull('public_id')->orderBy('id')->select('id')->each(function ($row) {
            DB::table('users')->where('id', $row->id)->update(['public_id' => strtolower((string) Str::ulid())]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->char('public_id', 26)->nullable(false)->change();
            $table->unique('public_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['public_id']);
            $table->dropColumn('public_id');
        });
    }
};
