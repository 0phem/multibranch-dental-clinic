<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            // USERS attaches to the shared PERSONS identity hub (its own person_id FK — never the other way
            // around, and PATIENTS never references users.id). One account per Person in this checkpoint.
            $table->foreignId('person_id')->unique()->constrained('persons')->cascadeOnDelete();
            // The authentication identifier and canonical unique-email constraint. Intentionally no separate
            // "name" column: display name is derived from the related Person, not a second source of truth
            // (see AGENTS.md "Avoid duplicate identity ... becoming independent sources of truth").
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            // Small explicit backend authorization model (see App\Enums\Role): canonical top-level role only.
            $table->string('role');
            // Account Active/Inactive is a distinct concept from operational availability (unmodeled here;
            // that belongs to a future Staff/Dentist backend phase) — mirrors the existing frontend distinction.
            $table->string('account_status')->default('Active');
            // Display-only Staff duty focus (e.g. "Receptionist", "Dental Assistant"). Never consulted for
            // authorization — a displayed title is not a permission (see CLAUDE_OPERATING_MODE.md §5).
            $table->string('title')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
