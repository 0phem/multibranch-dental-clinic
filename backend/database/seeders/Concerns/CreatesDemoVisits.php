<?php

namespace Database\Seeders\Concerns;

use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Service;
use App\Models\ServicePrice;
use App\Models\Treatment;
use App\Models\TreatmentProcedure;
use App\Models\User;
use App\Models\Visit;
use App\Services\Billing\BillingService;
use App\Services\Pricing\PricingService;
use App\Support\ClinicClock;
use Illuminate\Support\Facades\DB;

/**
 * DEMO DATA ONLY. Completed visits and invoices made the way the clinic makes them: check in → start (visit and Treatment
 * In Treatment together) → record the performed procedures → complete (both Completed together) → M11 Draft → Review → Issue.
 * The database checks visit/Treatment consistency at each commit and keeps a Completed Treatment's procedures read-only.
 */
trait CreatesDemoVisits
{
    /**
     * DEMO PRICES from interview Q12 (the lower end of each range the clinic gave): cleaning (Oral Prophylaxis) PHP 1,000, filling
     * (Composite Restoration) PHP 800, extraction (Tooth Extraction) PHP 10,000. They are demo values, not the clinic's price list;
     * no price is invented for any other service. Created through the real M13 command, only where the service has no price yet.
     */
    protected const DEMO_PRICES = ['svc2' => '1000.00', 'svc3' => '800.00', 'svc4' => '10000.00'];

    protected function ensureDemoPrices(User $owner, array $refs): void
    {
        foreach ($refs as $ref) {
            $service = Service::where('legacy_ref', $ref)->firstOrFail();
            if (! ServicePrice::where('service_id', $service->id)->whereNull('branch_id')->whereNull('retracted_at')->exists()) {
                app(PricingService::class)->create($owner, $service, null, 'priced', self::DEMO_PRICES[$ref], ClinicClock::today(), "demo-price-{$ref}");
                $this->command?->line("  demo price (interview Q12, lower end): {$service->name} PHP ".self::DEMO_PRICES[$ref]);
            }
        }
    }

    /** A completed walk-in visit today at $branch by $dentist with the given services performed (one each). */
    protected function completedTreatment(Patient $patient, Branch $branch, DentistProfile $dentist, User $by, array $serviceRefs): Treatment
    {
        $now = ClinicClock::now();
        $visit = Visit::create(['patient_id' => $patient->id, 'branch_id' => $branch->id, 'source' => 'walk_in', 'status' => 'Checked In',
            'arrived_at' => $now->subHour(), 'clinic_date' => ClinicClock::today()]);
        $treatment = DB::transaction(function () use ($visit, $dentist, $now, $by) {
            $treatment = Treatment::create(['visit_id' => $visit->id, 'dentist_profile_id' => $dentist->id, 'status' => 'In Treatment',
                'started_at' => $now->subMinutes(50), 'created_by_user_id' => $by->id, 'updated_by_user_id' => $by->id]);
            $visit->update(['status' => 'In Treatment']);

            return $treatment;
        });
        foreach (array_values($serviceRefs) as $i => $ref) {
            $service = Service::where('legacy_ref', $ref)->firstOrFail();
            TreatmentProcedure::create(['treatment_id' => $treatment->id, 'line_no' => $i + 1, 'service_id' => $service->id, 'quantity' => 1,
                'service_code' => $service->code, 'service_name' => $service->name]);
        }
        DB::transaction(function () use ($visit, $treatment) {
            $treatment->update(['status' => 'Completed', 'completed_at' => ClinicClock::now()]);
            $visit->update(['status' => 'Completed', 'closed_at' => ClinicClock::now()]);
        });

        return $treatment;
    }

    /** Draft → Review → Issue, as the branch's Staff member. */
    protected function issueInvoice(User $staff, Treatment $treatment): Invoice
    {
        $billing = app(BillingService::class);
        $invoice = $billing->createDraft($staff, $treatment);
        $invoice = $billing->transition($staff, $invoice, 'Review', $invoice->revision);

        return $billing->transition($staff, $invoice, 'Issued', $invoice->revision);
    }
}
