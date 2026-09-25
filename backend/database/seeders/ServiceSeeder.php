<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;

// Phase 2A reference data. Values transcribed from src/data.js's INITIAL_SERVICES. reference_fee_php is
// project/demo/reference configuration only — NEVER clinic-confirmed pricing, even where the value falls
// inside an interview-quoted range (CLAUDE_OPERATING_MODE.md §8 supports ranges for Cleaning/Extraction/
// Filling only; see the Phase 2A plan, section F). duration_minutes/category are likewise project/technical
// configuration, not clinic-interview facts. Refuses to run in production.
class ServiceSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('ServiceSeeder refuses to run in production.');

            return;
        }

        $services = [
            ['legacy_ref' => 'svc1', 'code' => 'CONSULT', 'name' => 'Dental Consultation', 'duration_minutes' => 30, 'reference_fee_php' => 600, 'category' => 'General Dentistry'],
            ['legacy_ref' => 'svc2', 'code' => 'PROPHY', 'name' => 'Oral Prophylaxis', 'duration_minutes' => 45, 'reference_fee_php' => 1200, 'category' => 'General Dentistry'],
            ['legacy_ref' => 'svc3', 'code' => 'RESTORE', 'name' => 'Composite Restoration', 'duration_minutes' => 60, 'reference_fee_php' => 2500, 'category' => 'General Dentistry'],
            ['legacy_ref' => 'svc4', 'code' => 'EXTRACT', 'name' => 'Tooth Extraction', 'duration_minutes' => 60, 'reference_fee_php' => 4500, 'category' => 'Oral Surgery'],
            ['legacy_ref' => 'svc5', 'code' => 'RCT', 'name' => 'Root Canal Treatment', 'duration_minutes' => 90, 'reference_fee_php' => 8000, 'category' => 'General Dentistry'],
            ['legacy_ref' => 'svc6', 'code' => 'ORTHO-ADJ', 'name' => 'Orthodontic Adjustment', 'duration_minutes' => 45, 'reference_fee_php' => 1500, 'category' => 'Orthodontics'],
            ['legacy_ref' => 'svc7', 'code' => 'PEDIA-CONSULT', 'name' => 'Pediatric Consultation', 'duration_minutes' => 30, 'reference_fee_php' => 800, 'category' => 'Pediatric Dentistry'],
            ['legacy_ref' => 'svc8', 'code' => 'WHITEN', 'name' => 'Teeth Whitening', 'duration_minutes' => 75, 'reference_fee_php' => 6500, 'category' => 'Teeth Whitening'],
            ['legacy_ref' => 'svc9', 'code' => 'IMPLANT-CONSULT', 'name' => 'Dental Implant Consultation', 'duration_minutes' => 45, 'reference_fee_php' => 1000, 'category' => 'Dental Implant'],
            ['legacy_ref' => 'svc10', 'code' => 'TMD-CONSULT', 'name' => 'TMD / Orofacial Pain Consultation', 'duration_minutes' => 45, 'reference_fee_php' => 1200, 'category' => 'TMD / Orofacial Pain'],
            ['legacy_ref' => 'svc11', 'code' => 'FOLLOWUP', 'name' => 'Follow-Up', 'duration_minutes' => 30, 'reference_fee_php' => 600, 'category' => 'General Dentistry'],
        ];

        foreach ($services as $service) {
            Service::firstOrCreate(['legacy_ref' => $service['legacy_ref']], ['status' => 'Active', ...$service]);
        }
    }
}
