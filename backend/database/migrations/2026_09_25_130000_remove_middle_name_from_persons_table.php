<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// The current identity contract uses first_name and last_name only. This additive migration supersedes the
// original persons-table definition without rewriting that historical migration.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->dropColumn('middle_name');
        });
    }

    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->string('middle_name')->nullable()->after('first_name');
        });
    }
};
