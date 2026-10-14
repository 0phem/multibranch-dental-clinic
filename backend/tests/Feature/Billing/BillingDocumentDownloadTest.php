<?php

namespace Tests\Feature\Billing;

use App\Enums\Role;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoUnpaidInvoiceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** The patient portal's PDF downloads: the same documents that are emailed, and only the Patient's own. */
class BillingDocumentDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_patient_downloads_only_their_own_invoice_and_receipt_pdfs(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoUnpaidInvoiceSeeder::class);
        $invoice = Invoice::sole();
        $patient = User::where('email', 'patient@example.test')->firstOrFail();

        $this->actingAs($patient);
        $pdf = $this->get("/api/invoices/{$invoice->public_id}/pdf")->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
        $this->assertStringContainsString('attachment; filename="Invoice-', $pdf->headers->get('Content-Disposition'));
        $this->assertStringContainsString('no-store', $pdf->headers->get('Cache-Control'));
        $this->get("/api/invoices/{$invoice->public_id}/receipt-pdf")->assertNotFound(); // not paid yet

        // Another Patient cannot tell that the invoice exists.
        $person = Person::create(['first_name' => 'Other', 'last_name' => 'Patient', 'email' => 'other.patient@example.test', 'phone' => '09170000098']);
        Patient::create(['person_id' => $person->id, 'patient_code' => 'PAT-0998', 'consent' => true]);
        $other = User::create(['email' => 'other.patient@example.test', 'person_id' => $person->id, 'password' => 'Passw0rd!', 'role' => Role::Patient, 'account_status' => 'Active']);
        $other->forceFill(['email_verified_at' => now()])->save();
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs($other->fresh());
        $this->get("/api/invoices/{$invoice->public_id}/pdf")->assertNotFound();

        // Paid at the front desk: the receipt PDF can be downloaded by its Patient.
        $staff = User::where('email', 'staff.reception@example.test')->firstOrFail();
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs($staff);
        $this->postJson("/api/invoices/{$invoice->public_id}/payment", ['expected_revision' => $invoice->fresh()->revision, 'method' => 'Cash'], ['Idempotency-Key' => (string) Str::uuid()])->assertOk();
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs($patient->fresh());
        $receipt = $this->get("/api/invoices/{$invoice->public_id}/receipt-pdf")->assertOk();
        $this->assertStringStartsWith('%PDF', $receipt->getContent());
        $this->assertStringContainsString('filename="Payment-Receipt-', $receipt->headers->get('Content-Disposition'));
    }
}
