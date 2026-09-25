<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(DemoAccountsSeeder::class);

        // Phase 2A reference data. Order matters: Branch/Service before the join tables that reference
        // them; StaffProfile before DentistProfile (d1's assistant_staff_id points at s3); DentistProfile
        // before the dentist_branches/dentist_service_assignments joins that reference it. Every one of
        // these seeders carries its own isProduction() guard (see each file), matching
        // DemoAccountsSeeder's existing pattern — this call list does not add a second gate on top.
        $this->call(BranchSeeder::class);
        $this->call(ServiceSeeder::class);
        $this->call(BranchServiceSeeder::class);
        $this->call(StaffProfileSeeder::class);
        $this->call(DentistProfileSeeder::class);
        $this->call(DentistBranchSeeder::class);
        $this->call(DentistServiceAssignmentSeeder::class);
    }
}
