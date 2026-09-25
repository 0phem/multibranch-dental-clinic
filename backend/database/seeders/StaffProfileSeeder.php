<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Person;
use App\Models\StaffProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

// Phase 2A reference data. Values transcribed from src/data.js's INITIAL_STAFF. Refuses to run in
// production, exactly like DemoAccountsSeeder.
//
// Identity resolution (Phase 2A plan, section E) — two paths, not a uniform create loop:
//   - s1 (legacy_user_ref 'u2') is the one roster member with a real backend login
//     (staff.reception@example.test, seeded by DemoAccountsSeeder). This seeder finds that ALREADY-EXISTING
//     real Person via the User and attaches the new StaffProfile to it — no new Person, no new User, no new
//     credential. If DemoAccountsSeeder hasn't run yet (no such User exists), s1 is skipped with a warning
//     rather than fabricating a duplicate identity — run DemoAccountsSeeder first.
//   - s2-s5 have no real backend login today. Each gets a brand-new, real `persons` row (name/contact only
//     — genuine roster identity data, not a credential) and NO `users` row at all: nothing to log in with,
//     so there is nothing for a production-safety gate to protect beyond the isProduction() check every
//     Phase 2A seeder already carries.
// "No profile attached to the wrong role": for s1, the linked User's role is asserted to be Staff before
// attaching — a genuine identity/role mismatch here is a real data problem, not something to paper over.
class StaffProfileSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('StaffProfileSeeder refuses to run in production.');

            return;
        }

        $this->attachToExistingDemoLogin();
        $this->createRosterOnlyProfiles();
    }

    private function attachToExistingDemoLogin(): void
    {
        $user = User::where('email', 'staff.reception@example.test')->first();

        if (! $user) {
            $this->command?->warn('StaffProfileSeeder: staff.reception@example.test not found — run DemoAccountsSeeder first. Skipping s1.');

            return;
        }

        if ($user->role !== Role::Staff) {
            throw new RuntimeException('StaffProfileSeeder: staff.reception@example.test is not role=staff — refusing to attach a StaffProfile to the wrong role.');
        }

        $branch = Branch::where('legacy_ref', 'b1')->firstOrFail();

        StaffProfile::firstOrCreate(
            ['legacy_ref' => 's1'],
            [
                'legacy_user_ref' => 'u2',
                // Stored directly on the profile, not derived from $user->title — see the
                // add_title_to_staff_profiles_table migration comment for why (bugfix: only this one
                // roster member has a real linked User to derive it from at all).
                'title' => 'Receptionist',
                'person_id' => $user->person_id,
                'branch_id' => $branch->id,
                'shift_start' => '09:00',
                'shift_end' => '18:00',
                'available' => true,
            ]
        );
    }

    private function createRosterOnlyProfiles(): void
    {
        $roster = [
            ['legacy_ref' => 's2', 'legacy_user_ref' => 'u4', 'title' => 'HMO Coordinator', 'first_name' => 'Marco', 'last_name' => 'Villanueva', 'email' => 'marco.v@clinic.demo', 'phone' => '0917 000 0004', 'branch' => 'b2', 'shift_start' => '09:00', 'shift_end' => '18:00'],
            ['legacy_ref' => 's3', 'legacy_user_ref' => 'u10', 'title' => 'Dental Assistant', 'first_name' => 'Nina', 'last_name' => 'Torres', 'email' => 'nina.torres@clinic.demo', 'phone' => '0917 000 0010', 'branch' => 'b1', 'shift_start' => '09:00', 'shift_end' => '18:00'],
            ['legacy_ref' => 's4', 'legacy_user_ref' => 'u5', 'title' => 'Cashier', 'first_name' => 'Lea', 'last_name' => 'Mendoza', 'email' => 'lea.mendoza@clinic.demo', 'phone' => '0917 000 0005', 'branch' => 'b3', 'shift_start' => '10:00', 'shift_end' => '19:00'],
            ['legacy_ref' => 's5', 'legacy_user_ref' => 'u11', 'title' => 'Patient Engagement Staff', 'first_name' => 'Mika', 'last_name' => 'Ramos', 'email' => 'mika.ramos@clinic.demo', 'phone' => '0917 000 0011', 'branch' => null, 'shift_start' => '09:00', 'shift_end' => '18:00'],
        ];

        foreach ($roster as $entry) {
            // firstOrCreate by email keeps this idempotent and prevents a duplicate Person identity on rerun.
            $person = Person::firstOrCreate(
                ['email' => $entry['email']],
                ['first_name' => $entry['first_name'], 'last_name' => $entry['last_name'], 'phone' => $entry['phone']]
            );

            $branchId = $entry['branch'] ? Branch::where('legacy_ref', $entry['branch'])->firstOrFail()->id : null;

            StaffProfile::firstOrCreate(
                ['legacy_ref' => $entry['legacy_ref']],
                [
                    'legacy_user_ref' => $entry['legacy_user_ref'],
                    'title' => $entry['title'],
                    'person_id' => $person->id,
                    'branch_id' => $branchId,
                    'shift_start' => $entry['shift_start'],
                    'shift_end' => $entry['shift_end'],
                    'available' => true,
                ]
            );
        }
    }
}
