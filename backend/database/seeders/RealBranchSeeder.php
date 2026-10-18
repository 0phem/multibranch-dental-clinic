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
 * Phone, email and opening hours: given by the clinic on 2026-10-17 (same hours for all three branches: Monday to Friday 8:00 AM
 * to 8:00 PM, Saturday 8:00 AM to 5:00 PM, Sunday closed). They replace the project placeholders ((02) 8123 100x, 09:00–18:00)
 * and are applied only where a branch still has a placeholder phone or no per-day hours, so an Owner's edit is kept.
 * Open items (docs/defense/OPEN_ITEMS.md): branches 1 and 2 were given the same phone number; branch 3 has no email and an
 * incomplete address.
 * Coordinates: the public Google Maps place records cited in docs/BRANCH_LOCATIONS.md (approximate; for distance ranking only),
 * set only where a branch has none.
 *
 * On the clinic database dental_clinic this is a data change that needs approval: it refuses unless ALLOW_CLINIC_DATABASE=yes.
 */
class RealBranchSeeder extends Seeder
{
    public const PLACEHOLDERS = ['Branch A', 'Branch B', 'Branch C'];

    /** ISO weekday => hours; a missing day (7, Sunday) is closed. */
    public const HOURS = [
        '1' => ['open' => '08:00', 'close' => '20:00'], '2' => ['open' => '08:00', 'close' => '20:00'], '3' => ['open' => '08:00', 'close' => '20:00'],
        '4' => ['open' => '08:00', 'close' => '20:00'], '5' => ['open' => '08:00', 'close' => '20:00'], '6' => ['open' => '08:00', 'close' => '17:00'],
    ];

    /** The placeholder phone numbers the project seeded before the clinic sent the real ones. */
    public const PLACEHOLDER_PHONES = ['(02) 8123 1001', '(02) 8123 1002', '(02) 8123 1003'];

    public const REAL = [
        'b1' => ['placeholder' => 'Branch A', 'name' => 'Dr. Dana Roxas Dental Clinic', 'address' => '#37, MacArthur Hwy, Bocaue, 3018 Bulacan', 'city' => 'Bocaue', 'latitude' => 14.800254, 'longitude' => 120.9233274, 'phone' => '0922 878 7341', 'email' => 'danaroxas.dentalclinic@gmail.com'],
        'b2' => ['placeholder' => 'Branch B', 'name' => 'Roxas - Cardinal Dental Center', 'address' => '67 MacArthur Hwy, Wakas, Bocaue, 3018 Bulacan', 'city' => 'Bocaue', 'latitude' => 14.7996762, 'longitude' => 120.9234564, 'phone' => '0922 878 7341', 'email' => 'danaroxasdental@gmail.com'],
        // The street and ZIP code are incomplete: kept exactly as given (open item: the clinic confirms the full address).
        'b3' => ['placeholder' => 'Branch C', 'name' => 'Roxas Dental Clinic Guiguinto', 'address' => 'Unit 20 GD Plaza, Guiguinto, Bulacan', 'city' => 'Guiguinto', 'latitude' => 14.8284409, 'longitude' => 120.8745988, 'phone' => '0933 867 8725', 'email' => null], // no email given
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
            if ($branch->phone === null || in_array($branch->phone, self::PLACEHOLDER_PHONES, true) || $branch->weekly_hours === null) {
                // Real contacts and per-day hours; the single open/close and operating_days stay consistent for older screens.
                $branch->forceFill(['phone' => $real['phone'], 'email' => $real['email'], 'weekly_hours' => self::HOURS,
                    'open_time' => '08:00', 'close_time' => '20:00', 'operating_days' => array_map('intval', array_keys(self::HOURS))])->save();
            }
            if ($branch->latitude === null && $branch->longitude === null) {
                $branch->forceFill(['latitude' => $real['latitude'], 'longitude' => $real['longitude']])->save();
            }
        }
        $this->command?->info("Real branch names: {$renamed} placeholder branch(es) renamed; contacts and opening hours checked.");
    }
}
