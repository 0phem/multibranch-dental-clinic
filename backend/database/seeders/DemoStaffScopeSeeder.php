<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use App\Models\UserBranchScope;
use Illuminate\Database\Seeder;

// Local/dev only. Grants the two demo Staff logins an explicit AUTHORIZATION branch scope (user_branch_scopes),
// matching the frontend demo accounts they mirror (u2 Receptionist and u10 Dental Assistant, both scoped to b1 in
// src/data.js INITIAL_USERS). This is an explicit demo grant, not derived from staff_profiles.branch_id: operational
// assignment never implies authorization scope (CONTRACTS.md §1). Idempotent; existing scopes are never removed.
class DemoStaffScopeSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DemoStaffScopeSeeder refuses to run in production.');

            return;
        }

        $branch = Branch::where('legacy_ref', 'b1')->first();
        if (! $branch) {
            $this->command?->warn('DemoStaffScopeSeeder: branch b1 not found — run BranchSeeder first. Skipping.');

            return;
        }

        User::whereIn('email', ['staff.reception@example.test', 'staff.assistant@example.test'])
            ->each(fn (User $user) => UserBranchScope::firstOrCreate(['user_id' => $user->id, 'branch_id' => $branch->id]));
    }
}
