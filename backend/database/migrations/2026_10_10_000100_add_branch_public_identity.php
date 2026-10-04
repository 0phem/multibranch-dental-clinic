<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->ulid('public_id')->nullable()->unique();
        });
        foreach (DB::table('branches')->orderBy('id')->get(['id']) as $branch) {
            DB::table('branches')->where('id', $branch->id)->update(['public_id' => (string) Str::ulid()]);
        }
        Schema::table('branches', function (Blueprint $table) {
            $table->ulid('public_id')->nullable(false)->change();
            // Retain the pre-existing name constraint until legacy name-based consumers migrate.
            // Public identity is the ULID; this is transitional compatibility, not clinic naming policy.
        });
    }

    public function down(): void
    {
        // Forward-only: public identities and existing foreign keys must survive.
    }
};
