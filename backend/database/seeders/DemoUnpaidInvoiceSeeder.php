<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\User;
use Illuminate\Database\Seeder;

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
    use Concerns\CreatesDemoVisits;

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

        $this->ensureDemoPrices($owner, ['svc2', 'svc3']);
        $treatment = $this->completedTreatment($patientUser->patient, $branch, $dentist, $dentistUser ?? $owner, ['svc2', 'svc3']);
        $invoice = $this->issueInvoice($staff, $treatment);

        $this->command?->info("Demo invoice {$invoice->invoice_number} ({$invoice->public_id}) issued to {$patientEmail}: PHP {$invoice->patient_responsibility_amount}, status {$invoice->status}.");
    }
}
