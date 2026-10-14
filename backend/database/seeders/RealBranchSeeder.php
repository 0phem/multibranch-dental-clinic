<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Support\ClinicDatabaseGuard;
use Illuminate\Database\Seeder;

/**
 * The clinic's real branch names and addresses (given by the clinic owner's team, 2026-10-14), replacing the placeholder names
 * "Branch A/B/C". To rename a branch later, edit REAL below (or use the Owner's Branches screen, which is the normal way).
 *
 * Only a branch that still has its placeholder name is changed, so an Owner's later edit is never overwritten (idempotent).
 * Hours, phone and email are NOT changed here: the clinic has not sent them yet (see docs/defense/OPEN_ITEMS.md).
 * Coordinates: the public Google Maps place records cited in docs/BRANCH_LOCATIONS.md (approximate; for distance ranking only),
 * set only where a branch has none.
 *
 * On the clinic database dental_clinic this is a data change that needs approval: it refuses unless ALLOW_CLINIC_DATABASE=yes.
 */
class RealBranchSeeder extends Seeder
{
    public const PLACEHOLDERS = ['Branch A', 'Branch B', 'Branch C'];

    public const REAL = [
        'b1' => ['placeholder' => 'Branch A', 'name' => 'Dr. Dana Roxas Dental Clinic', 'address' => '#37, MacArthur Hwy, Bocaue, 3018 Bulacan', 'city' => 'Bocaue', 'latitude' => 14.800254, 'longitude' => 120.9233274],
        'b2' => ['placeholder' => 'Branch B', 'name' => 'Roxas - Cardinal Dental Center', 'address' => '67 MacArthur Hwy, Wakas, Bocaue, 3018 Bulacan', 'city' => 'Bocaue', 'latitude' => 14.7996762, 'longitude' => 120.9234564],
        // The street and ZIP code are incomplete: kept exactly as given (open item: the clinic confirms the full address).
        'b3' => ['placeholder' => 'Branch C', 'name' => 'Roxas Dental Clinic Guiguinto', 'address' => 'Unit 20 GD Plaza, Guiguinto, Bulacan', 'city' => 'Guiguinto', 'latitude' => 14.8284409, 'longitude' => 120.8745988],
    ];

    public function run(): void
    {
        if ($refusal = ClinicDatabaseGuard::refusal('RealBranchSeeder')) {
            $this->command?->error($refusal);

            return;
        }
        $renamed = 0;
        foreach (self::REAL as $ref => $real) {
            $branch = Branch::where('legacy_ref', $ref)->first();
            if (! $branch) continue;
            if ($branch->name === $real['placeholder']) {
                $branch->forceFill(['name' => $real['name'], 'address' => $real['address'], 'city' => $real['city']])->save();
                $renamed++;
            }
            if ($branch->latitude === null && $branch->longitude === null) {
                $branch->forceFill(['latitude' => $real['latitude'], 'longitude' => $real['longitude']])->save();
            }
        }
        $this->command?->info("Real branch names: {$renamed} placeholder branch(es) renamed; other branches unchanged.");
    }
}
