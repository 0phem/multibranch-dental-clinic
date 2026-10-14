<?php

namespace Database\Seeders;

use App\Models\Branch;
use Illuminate\Database\Seeder;

// Phase 2A reference data. Names, addresses and map coordinates are the clinic's real branches (RealBranchSeeder::REAL);
// hours and phone numbers are still project placeholders until the clinic sends them (docs/defense/OPEN_ITEMS.md). Originally transcribed from src/data.js's INITIAL_BRANCHES (Bocaue/Bocaue/Guiguinto,
// 3 branches) — the same real-world facts the frontend already encodes, not auto-generated from it (no
// cross-language codegen exists this phase; see the Phase 2A plan, section K, for the drift-mitigation
// note). These are project/demo placeholder values, not confirmed final clinic configuration (plan section
// E) — refuses to run in production, exactly like DemoAccountsSeeder.
class BranchSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('BranchSeeder refuses to run in production.');

            return;
        }

        $branches = [
            ['legacy_ref' => 'b1', 'branch_code' => 'BRC-A', 'name' => RealBranchSeeder::REAL['b1']['name'], 'city' => 'Bocaue', 'address' => RealBranchSeeder::REAL['b1']['address'], 'phone' => '(02) 8123 1001', 'open_time' => '09:00', 'close_time' => '18:00', 'latitude' => RealBranchSeeder::REAL['b1']['latitude'], 'longitude' => RealBranchSeeder::REAL['b1']['longitude'], 'status' => 'Open', 'capacity_threshold' => 80],
            ['legacy_ref' => 'b2', 'branch_code' => 'BRC-B', 'name' => RealBranchSeeder::REAL['b2']['name'], 'city' => 'Bocaue', 'address' => RealBranchSeeder::REAL['b2']['address'], 'phone' => '(02) 8123 1002', 'open_time' => '09:00', 'close_time' => '18:00', 'latitude' => RealBranchSeeder::REAL['b2']['latitude'], 'longitude' => RealBranchSeeder::REAL['b2']['longitude'], 'status' => 'Open', 'capacity_threshold' => 80],
            ['legacy_ref' => 'b3', 'branch_code' => 'BRC-C', 'name' => RealBranchSeeder::REAL['b3']['name'], 'city' => 'Guiguinto', 'address' => RealBranchSeeder::REAL['b3']['address'], 'phone' => '(02) 8123 1003', 'open_time' => '10:00', 'close_time' => '19:00', 'latitude' => RealBranchSeeder::REAL['b3']['latitude'], 'longitude' => RealBranchSeeder::REAL['b3']['longitude'], 'status' => 'Open', 'capacity_threshold' => 75],
        ];

        foreach ($branches as $branch) {
            Branch::firstOrCreate(['legacy_ref' => $branch['legacy_ref']], $branch);
        }
    }
}
