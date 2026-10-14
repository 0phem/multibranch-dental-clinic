<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\Service;
use App\Models\ServicePrice;
use App\Models\Treatment;
use App\Models\TreatmentProcedure;
use App\Models\User;
use App\Models\Visit;
use App\Services\Billing\BillingService;
use App\Services\Pricing\PricingService;
use App\Support\ClinicClock;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

// DEMO DATA ONLY (refuses to run in production; intended for a separate demo database, never the clinic's records).
// Creates ONE unpaid, Issued invoice for the demo Patient so a PayMongo test checkout has something to pay. Every run adds a new one.
//
// It follows the approved billing flow instead of inserting an invoice: a completed walk-in visit and Treatment at Branch A by the
// demo Dentist (d1) with two performed procedures, then the real M11 commands as the demo Branch A Staff member:
// createDraft -> Review -> Issue. Prices come from the real M13 command as the demo Owner, only if the service has no price yet.
// DEMO PRICES from interview Q12 (lower end of each range): cleaning (Oral Prophylaxis) PHP 1,000; filling (Composite
// Restoration) PHP 800. They are demo values, not the clinic's approved price list.
class DemoUnpaidInvoiceSeeder extends Seeder
{
    private const DEMO_PRICES = ['svc2' => '1000.00', 'svc3' => '800.00'];

    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DemoUnpaidInvoiceSeeder refuses to run in production.');

            return;
        }
        $owner = User::where('email', 'owner@example.test')->first();
        $staff = User::where('email', 'staff.reception@example.test')->first();
        // The demo Patient, or the address it was moved to with `scripts/payment-test.sh patient-email` (DEMO_PATIENT_EMAIL).
        $patientEmail = strtolower(trim((string) (env('DEMO_PATIENT_EMAIL') ?: 'patient@example.test')));
        $patientUser = User::where('email', $patientEmail)->where('role', 'patient')->with('patient')->first();
        $branch = Branch::where('legacy_ref', 'b1')->first();
        $dentist = DentistProfile::where('legacy_ref', 'd1')->first();
        $dentistUser = $dentist ? User::where('person_id', $dentist->person_id)->first() : null;
        if (! $owner || ! $staff || ! $patientUser?->patient || ! $branch || ! $dentist) {
            $this->command?->error("DemoUnpaidInvoiceSeeder needs the demo accounts, the demo Patient ({$patientEmail}), branch b1 and dentist d1: run `php artisan db:seed` first, or set DEMO_PATIENT_EMAIL.");

            return;
        }

        $today = ClinicClock::today();
        foreach (self::DEMO_PRICES as $ref => $amount) {
            $service = Service::where('legacy_ref', $ref)->firstOrFail();
            if (! ServicePrice::where('service_id', $service->id)->whereNull('branch_id')->whereNull('retracted_at')->exists()) {
                app(PricingService::class)->create($owner, $service, null, 'priced', $amount, $today, "demo-price-{$ref}");
            }
        }

        $now = ClinicClock::now();
        // The same steps, committed in the same order, as a real visit (the database checks visit/Treatment consistency at each commit
        // and keeps a Completed Treatment's procedures read-only): check in -> start (visit and Treatment In Treatment together) ->
        // record the performed procedures -> complete (both Completed together).
        $by = $dentistUser?->id ?? $owner->id;
        $visit = Visit::create(['patient_id' => $patientUser->patient->id, 'branch_id' => $branch->id, 'source' => 'walk_in', 'status' => 'Checked In',
            'arrived_at' => $now->subHour(), 'clinic_date' => $today]);
        $treatment = DB::transaction(function () use ($visit, $dentist, $now, $by) {
            $treatment = Treatment::create(['visit_id' => $visit->id, 'dentist_profile_id' => $dentist->id, 'status' => 'In Treatment',
                'started_at' => $now->subMinutes(50), 'created_by_user_id' => $by, 'updated_by_user_id' => $by]);
            $visit->update(['status' => 'In Treatment']);

            return $treatment;
        });
        foreach (array_keys(self::DEMO_PRICES) as $i => $ref) {
            $service = Service::where('legacy_ref', $ref)->firstOrFail();
            TreatmentProcedure::create(['treatment_id' => $treatment->id, 'line_no' => $i + 1, 'service_id' => $service->id, 'quantity' => 1,
                'service_code' => $service->code, 'service_name' => $service->name]);
        }
        DB::transaction(function () use ($visit, $treatment) {
            $treatment->update(['status' => 'Completed', 'completed_at' => ClinicClock::now()]);
            $visit->update(['status' => 'Completed', 'closed_at' => ClinicClock::now()]);
        });

        $billing = app(BillingService::class);
        $invoice = $billing->createDraft($staff, $treatment);
        $invoice = $billing->transition($staff, $invoice, 'Review', $invoice->revision);
        $invoice = $billing->transition($staff, $invoice, 'Issued', $invoice->revision);

        $this->command?->info("Demo invoice {$invoice->invoice_number} ({$invoice->public_id}) issued to {$patientEmail}: PHP {$invoice->patient_responsibility_amount}, status {$invoice->status}.");
    }
}
