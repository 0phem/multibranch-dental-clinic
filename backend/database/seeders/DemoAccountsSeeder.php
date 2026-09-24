<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

// Safe local/dev demo accounts only — refuses to run in production. One account per canonical role
// (Patient/Staff/Dentist/Owner), each a full Person(+Patient for the patient)+User chain, so RBAC and the
// eventual Backend Foundation 1B frontend both have something real to authenticate against.
class DemoAccountsSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DemoAccountsSeeder refuses to run in production.');

            return;
        }

        // No plaintext password is committed to a tracked file. DEMO_ACCOUNT_PASSWORD may be set in the
        // gitignored .env; the fallback below is a clearly-labeled, non-secret local-dev-only default,
        // documented in backend/README.md, never intended for anything but a throwaway local database.
        $password = Hash::make(env('DEMO_ACCOUNT_PASSWORD', 'DemoPass123'));

        $this->demoPatient($password);
        $this->demoStaff($password, 'staff.reception@example.test', 'Reception Staff', 'Receptionist');
        $this->demoStaff($password, 'staff.assistant@example.test', 'Assistant Staff', 'Dental Assistant');
        $this->demoUser($password, Role::Dentist, 'dentist@example.test', 'Demo Dentist');
        $this->demoUser($password, Role::Owner, 'owner@example.test', 'Demo Owner');
    }

    private function demoPatient(string $password): void
    {
        $person = Person::firstOrCreate(
            ['email' => 'patient@example.test'],
            ['first_name' => 'Demo', 'last_name' => 'Patient', 'phone' => '09170000001']
        );

        Patient::firstOrCreate(
            ['person_id' => $person->id],
            ['patient_code' => 'PAT-0000', 'consent' => true]
        );

        User::firstOrCreate(
            ['email' => 'patient@example.test'],
            [
                'person_id' => $person->id,
                'password' => $password,
                'role' => Role::Patient,
                'account_status' => 'Active',
            ]
        );
    }

    private function demoStaff(string $password, string $email, string $lastName, string $title): void
    {
        $person = Person::firstOrCreate(['email' => $email], ['first_name' => 'Demo', 'last_name' => $lastName]);

        User::firstOrCreate(
            ['email' => $email],
            [
                'person_id' => $person->id,
                'password' => $password,
                'role' => Role::Staff,
                'account_status' => 'Active',
                'title' => $title,
            ]
        );
    }

    private function demoUser(string $password, Role $role, string $email, string $lastName): void
    {
        $person = Person::firstOrCreate(['email' => $email], ['first_name' => 'Demo', 'last_name' => $lastName]);

        User::firstOrCreate(
            ['email' => $email],
            [
                'person_id' => $person->id,
                'password' => $password,
                'role' => $role,
                'account_status' => 'Active',
            ]
        );
    }
}
