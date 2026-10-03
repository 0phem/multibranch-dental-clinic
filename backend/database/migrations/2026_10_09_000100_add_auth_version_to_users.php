<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Additive: retains every account and clinical relationship. Old sessions
        // have no revision and must sign in again after deployment.
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('auth_version')->default(0);
        });
    }

    public function down(): void
    {
        // Intentionally forward-only: removing the revision would resurrect stale sessions.
    }
};
