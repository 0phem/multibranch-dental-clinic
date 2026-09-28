<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// USER_BRANCH_SCOPES — AUTHORIZATION branch scope (CONTRACTS.md §1): which branches' data an account may act on.
// An account may hold zero, one or several scopes. Deliberately separate from operational assignment
// (staff_profiles.branch_id / dentist_branches), which never grants scope. M6 only reads this table; M1 will own the
// administrative workflow that maintains it. Owner authority does not depend on it.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_branch_scopes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->timestampsTz();

            $table->unique(['user_id', 'branch_id']);
            $table->index('branch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_branch_scopes');
    }
};
