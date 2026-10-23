<?php

namespace Tests\Feature\Billing;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoUnpaidInvoiceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
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

    /**
     * @return array{0: Invoice, 1: User, 2: User}
     */
    private function seedPaidInvoiceWorld(): array
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoUnpaidInvoiceSeeder::class);
        $invoice = Invoice::sole();
        $patient = User::where('email', 'patient@example.test')->firstOrFail();

        $person = Person::create(['first_name' => 'Other', 'last_name' => 'Patient', 'email' => 'other.patient@example.test', 'phone' => '09170000098']);
        Patient::create(['person_id' => $person->id, 'patient_code' => 'PAT-0998', 'consent' => true]);
        $other = User::create(['email' => 'other.patient@example.test', 'person_id' => $person->id, 'password' => 'Passw0rd!', 'role' => Role::Patient, 'account_status' => 'Active']);
        $other->forceFill(['email_verified_at' => now()])->save();

        $staff = User::where('email', 'staff.reception@example.test')->firstOrFail();
        $this->actingAs($staff);
        $this->postJson(
            "/api/invoices/{$invoice->public_id}/payment",
            ['expected_revision' => $invoice->fresh()->revision, 'method' => 'Cash'],
            ['Idempotency-Key' => (string) Str::uuid()]
        )->assertOk();
        $this->flushSession();
        $this->app['auth']->forgetGuards();

        return [$invoice->fresh(), $patient->fresh(), $other->fresh()];
    }

    public function test_resend_receipt_returns_404_for_another_patients_invoice(): void
    {
        [$invoice, , $other] = $this->seedPaidInvoiceWorld();

        $this->actingAs($other);
        $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")->assertNotFound();
    }

    public function test_resend_receipt_returns_422_when_unpaid_or_missing_receipt(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoUnpaidInvoiceSeeder::class);
        $invoice = Invoice::sole();
        $patient = User::where('email', 'patient@example.test')->firstOrFail();

        $this->actingAs($patient);
        $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")
            ->assertStatus(422)
            ->assertJsonPath('code', 'receipt_not_available');
    }

    public function test_resend_receipt_refuses_client_supplied_recipient_and_logs_audit_row(): void
    {
        [$invoice, $patient] = $this->seedPaidInvoiceWorld();

        $this->actingAs($patient);
        foreach (['email', 'recipient', 'recipient_email', 'to'] as $field) {
            $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt", [$field => 'attacker@example.test'])
                ->assertStatus(422)
                ->assertJsonValidationErrors($field);
        }

        $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")->assertOk();
        $audit = AuditLog::where('action', 'billing.receipt_resent')->latest('id')->first();
        $this->assertNotNull($audit);
        $this->assertSame('financial', $audit->category);
        $this->assertSame($patient->id, $audit->actor_user_id);
        $this->assertSame($invoice->invoice_number, $audit->payload['invoice_number'] ?? null);
        $this->assertSame($invoice->fresh()->receipt->receipt_number, $audit->payload['receipt_number'] ?? null);
    }

    public function test_resend_receipt_enforces_rate_limit_with_retry_after_header(): void
    {
        [$invoice, $patient] = $this->seedPaidInvoiceWorld();

        $this->actingAs($patient);
        $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")->assertOk();
        $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")->assertOk();
        $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")->assertOk();

        $res = $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")
            ->assertStatus(429)
            ->assertJsonPath('code', 'rate_limited');
        $this->assertNotNull($res->headers->get('Retry-After'));
        $this->assertGreaterThan(0, (int) $res->headers->get('Retry-After'));
    }

    public function test_resend_receipt_returns_502_when_mail_transport_fails(): void
    {
        [$invoice, $patient] = $this->seedPaidInvoiceWorld();

        $this->actingAs($patient);
        RateLimiter::clear('resend-receipt:'.$patient->id.':'.$invoice->id);
        Mail::shouldReceive('to')->once()->andThrow(new \RuntimeException('Simulated SMTP transport failure'));
        $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")
            ->assertStatus(502)
            ->assertJsonPath('code', 'mail_send_failed')
            ->assertJsonPath('status', 'failed');

        $failedAudit = AuditLog::where('action', 'billing.receipt_resent')->latest('id')->first();
        $this->assertSame('warning', $failedAudit->severity);
        $this->assertSame('failed', $failedAudit->payload['mail_status'] ?? null);
    }

    public function test_resend_receipt_succeeds_for_owning_patient(): void
    {
        [$invoice, $patient] = $this->seedPaidInvoiceWorld();

        $this->actingAs($patient);
        $res = $this->postJson("/api/invoices/{$invoice->public_id}/resend-receipt")
            ->assertOk()
            ->assertJsonPath('data.invoice_id', $invoice->public_id)
            ->assertJsonPath('data.receipt_number', $invoice->receipt->receipt_number);
        $this->assertContains($res->json('data.status'), ['logged_only', 'suppressed', 'transport_accepted']);
    }
}
