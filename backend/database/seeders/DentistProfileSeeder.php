<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\DentistProfile;
use App\Models\Person;
use App\Models\StaffProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

// Phase 2A reference data. Values transcribed from src/data.js's INITIAL_DENTISTS. Refuses to run in
// production. Same two-path identity resolution as StaffProfileSeeder (see its comment) — d1 attaches to
// the real dentist@example.test Person; d2-d5 get a new Person with no User. license_no values are
// demo-format placeholders, never claimed as verified real license numbers (plan section C). Depends on
// StaffProfileSeeder having already run (d1's assistant_staff_id references s3).
class DentistProfileSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DentistProfileSeeder refuses to run in production.');

            return;
        }

        $this->attachToExistingDemoLogin();
        $this->createRosterOnlyProfiles();
    }

    private function attachToExistingDemoLogin(): void
    {
        $user = User::where('email', 'dentist@example.test')->first();

        if (! $user) {
            $this->command?->warn('DentistProfileSeeder: dentist@example.test not found — run DemoAccountsSeeder first. Skipping d1.');

            return;
        }

        if ($user->role !== Role::Dentist) {
            throw new RuntimeException('DentistProfileSeeder: dentist@example.test is not role=dentist — refusing to attach a DentistProfile to the wrong role.');
        }

        $assistant = StaffProfile::where('legacy_ref', 's3')->first();

        DentistProfile::firstOrCreate(
            ['legacy_ref' => 'd1'],
            [
                'legacy_user_ref' => 'u3',
                'person_id' => $user->person_id,
                'license_no' => 'PRC-D-1001',
                'specialty' => 'General Dentistry',
                'shift_start' => '09:00',
                'shift_end' => '18:00',
                'available' => true,
                'assistant_staff_id' => $assistant?->id,
            ]
        );
    }

    private function createRosterOnlyProfiles(): void
    {
        $roster = [
            ['legacy_ref' => 'd2', 'legacy_user_ref' => 'u6', 'first_name' => 'Patricia', 'last_name' => 'Lim', 'email' => 'patricia.lim@clinic.demo', 'phone' => '0917 000 0102', 'license_no' => 'PRC-D-1002', 'specialty' => 'Orthodontics', 'shift_start' => '10:00', 'shift_end' => '19:00'],
            ['legacy_ref' => 'd3', 'legacy_user_ref' => 'u7', 'first_name' => 'Carlo', 'last_name' => 'Mendoza', 'email' => 'carlo.mendoza@clinic.demo', 'phone' => '0917 000 0103', 'license_no' => 'PRC-D-1003', 'specialty' => 'Pediatric Dentistry', 'shift_start' => '09:00', 'shift_end' => '18:00'],
            ['legacy_ref' => 'd4', 'legacy_user_ref' => 'u8', 'first_name' => 'Andrea', 'last_name' => 'Flores', 'email' => 'andrea.flores@clinic.demo', 'phone' => '0917 000 0104', 'license_no' => 'PRC-D-1004', 'specialty' => 'Dental Implant', 'shift_start' => '10:00', 'shift_end' => '19:00'],
            ['legacy_ref' => 'd5', 'legacy_user_ref' => 'u9', 'first_name' => 'Luis', 'last_name' => 'Navarro', 'email' => 'luis.navarro@clinic.demo', 'phone' => '0917 000 0105', 'license_no' => 'PRC-D-1005', 'specialty' => 'General Dentistry', 'shift_start' => '11:00', 'shift_end' => '19:00'],
        ];

        foreach ($roster as $entry) {
            $person = Person::firstOrCreate(
                ['email' => $entry['email']],
                ['first_name' => $entry['first_name'], 'last_name' => $entry['last_name'], 'phone' => $entry['phone']]
            );

            DentistProfile::firstOrCreate(
                ['legacy_ref' => $entry['legacy_ref']],
                [
                    'legacy_user_ref' => $entry['legacy_user_ref'],
                    'person_id' => $person->id,
                    'license_no' => $entry['license_no'],
                    'specialty' => $entry['specialty'],
                    'shift_start' => $entry['shift_start'],
                    'shift_end' => $entry['shift_end'],
                    'available' => true,
                    'assistant_staff_id' => null,
                ]
            );
        }
    }
}
