<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\DentistBranch;
use App\Models\DentistProfile;
use Illuminate\Database\Seeder;

// Phase 2A reference data. Values transcribed from src/data.js's INITIAL_DENTISTS.branches (name arrays,
// here resolved to real branch rows) — d5 genuinely works 2 branches, matching current frontend behavior
// exactly (this is why dentist_branches is a real many-to-many, not a single nullable FK like staff). Depends
// on BranchSeeder/DentistProfileSeeder. Refuses to run in production.
class DentistBranchSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DentistBranchSeeder refuses to run in production.');

            return;
        }

        $assignments = [
            'd1' => ['b1'],
            'd2' => ['b1'],
            'd3' => ['b2'],
            'd4' => ['b3'],
            'd5' => ['b2', 'b3'],
        ];

        foreach ($assignments as $dentistRef => $branchRefs) {
            $dentist = DentistProfile::where('legacy_ref', $dentistRef)->first();

            if (! $dentist) {
                continue;
            }

            foreach ($branchRefs as $branchRef) {
                $branch = Branch::where('legacy_ref', $branchRef)->firstOrFail();

                DentistBranch::firstOrCreate([
                    'dentist_profile_id' => $dentist->id,
                    'branch_id' => $branch->id,
                ]);
            }
        }
    }
}
