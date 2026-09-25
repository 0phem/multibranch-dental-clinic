<?php

namespace Database\Seeders;

use App\Models\DentistProfile;
use App\Models\DentistServiceAssignment;
use App\Models\Service;
use Illuminate\Database\Seeder;

// Phase 2A reference data. Values transcribed from src/data.js's INITIAL_DENTIST_SERVICE_ASSIGNMENTS.
// Depends on ServiceSeeder/DentistProfileSeeder. Refuses to run in production.
class DentistServiceAssignmentSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DentistServiceAssignmentSeeder refuses to run in production.');

            return;
        }

        $assignments = [
            'd1' => ['svc1', 'svc2', 'svc3', 'svc4', 'svc5', 'svc11'],
            'd2' => ['svc1', 'svc6', 'svc11'],
            'd3' => ['svc1', 'svc7', 'svc11'],
            'd4' => ['svc1', 'svc4', 'svc9', 'svc11'],
            'd5' => ['svc1', 'svc2', 'svc3', 'svc5', 'svc11'],
        ];

        foreach ($assignments as $dentistRef => $serviceRefs) {
            $dentist = DentistProfile::where('legacy_ref', $dentistRef)->first();

            if (! $dentist) {
                continue;
            }

            foreach ($serviceRefs as $serviceRef) {
                $service = Service::where('legacy_ref', $serviceRef)->firstOrFail();

                DentistServiceAssignment::firstOrCreate(
                    ['dentist_profile_id' => $dentist->id, 'service_id' => $service->id],
                    ['is_authorized' => true]
                );
            }
        }
    }
}
