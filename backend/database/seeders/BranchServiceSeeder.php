<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\BranchService;
use App\Models\Service;
use Illuminate\Database\Seeder;

// Phase 2A reference data. Values transcribed from src/data.js's INITIAL_BRANCH_SERVICES. Depends on
// BranchSeeder/ServiceSeeder having already run. Refuses to run in production.
class BranchServiceSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('BranchServiceSeeder refuses to run in production.');

            return;
        }

        $assignments = [
            'b1' => ['svc1', 'svc2', 'svc3', 'svc4', 'svc5', 'svc6', 'svc11'],
            'b2' => ['svc1', 'svc2', 'svc3', 'svc5', 'svc7', 'svc8', 'svc11'],
            'b3' => ['svc1', 'svc2', 'svc3', 'svc5', 'svc9', 'svc10', 'svc11'],
        ];

        foreach ($assignments as $branchRef => $serviceRefs) {
            $branch = Branch::where('legacy_ref', $branchRef)->firstOrFail();

            foreach ($serviceRefs as $serviceRef) {
                $service = Service::where('legacy_ref', $serviceRef)->firstOrFail();

                BranchService::firstOrCreate(
                    ['branch_id' => $branch->id, 'service_id' => $service->id],
                    ['active' => true]
                );
            }
        }
    }
}
