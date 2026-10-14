<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Person;
use App\Models\StaffProfile;
use App\Models\User;
use App\Models\UserBranchScope;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

// Local/dev DEMO data only (refuses to run in production). Gives every demo Staff login an operational staff profile and an explicit
// authorization branch scope, so each one opens a workspace, and adds one Staff login at a SECOND branch so the cross-branch messaging
// check (b2 (Roxas - Cardinal Dental Center) must not see b1's Patient conversations) can be shown without inviting anyone by hand.
//   staff.assistant@example.test  Dental Assistant, b1 (Dr. Dana Roxas Dental Clinic) (b1)  — profile s-demo-a1 (it previously had no profile: no workspace)
//   staff.branchb@example.test    Receptionist,     b2 (Roxas - Cardinal Dental Center) (b2)  — profile s-demo-b2, scope b2
// New profile references are used on purpose: the roster profiles s1–s5 belong to the frontend's built-in demo people.
// Operational assignment (profile branch) and authorization scope are granted separately and explicitly (CONTRACTS.md §1). Idempotent.
class DemoStaffProfileSeeder extends Seeder
{
    public function run(): void
    {
        if ($refusal = \App\Support\ClinicDatabaseGuard::refusal('DemoStaffProfileSeeder')) {
            $this->command?->error($refusal);

            return;
        }
        if (app()->isProduction()) {
            $this->command?->error('DemoStaffProfileSeeder refuses to run in production.');

            return;
        }

        $password = Hash::make(env('DEMO_ACCOUNT_PASSWORD', 'DemoPass123'));
        foreach ([
            ['email' => 'staff.assistant@example.test', 'last_name' => 'Assistant Staff', 'title' => 'Dental Assistant', 'branch' => 'b1', 'profile' => 's-demo-a1'],
            ['email' => 'staff.branchb@example.test', 'last_name' => 'Cardinal Staff', 'title' => 'Receptionist', 'branch' => 'b2', 'profile' => 's-demo-b2'],
        ] as $entry) {
            $branch = Branch::where('legacy_ref', $entry['branch'])->first();
            if (! $branch) {
                $this->command?->warn("DemoStaffProfileSeeder: branch {$entry['branch']} not found — run BranchSeeder first. Skipping.");

                continue;
            }
            $person = Person::firstOrCreate(['email' => $entry['email']], ['first_name' => 'Demo', 'last_name' => $entry['last_name']]);
            $user = User::firstOrCreate(['email' => $entry['email']], [
                'person_id' => $person->id, 'password' => $password, 'role' => Role::Staff, 'account_status' => 'Active', 'title' => $entry['title'],
            ]);
            if (! StaffProfile::where('person_id', $person->id)->exists()) {
                StaffProfile::firstOrCreate(['legacy_ref' => $entry['profile']], [
                    'legacy_user_ref' => $user->public_id, 'title' => $entry['title'], 'person_id' => $person->id, 'branch_id' => $branch->id,
                    'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true,
                ]);
            }
            UserBranchScope::firstOrCreate(['user_id' => $user->id, 'branch_id' => $branch->id]);
        }
    }
}
