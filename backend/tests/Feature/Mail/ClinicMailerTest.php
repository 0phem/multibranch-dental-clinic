<?php

namespace Tests\Feature\Mail;

use App\Enums\Role;
use App\Mail\AppointmentConfirmationMail;
use App\Mail\ClinicTestMail;
use App\Mail\PaymentReceiptMail;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Person;
use App\Models\Receipt;
use App\Models\Service;
use App\Models\Treatment;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ClinicMailerTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $patientUser;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        $this->owner = User::factory()->create([
            'role' => Role::Owner,
            'email' => 'owner@example.test',
        ]);

        $this->patientUser = User::factory()->create([
            'role' => Role::Patient,
            'email' => 'patient@example.test',
        ]);
    }

    public function test_owner_can_dispatch_smtp_diagnostic_test_email(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson('/api/mail/test', [
                'recipient_email' => 'admin-test@example.test',
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('recipient', 'admin-test@example.test');

        Mail::assertSent(ClinicTestMail::class, function ($mail) {
            return $mail->hasTo('admin-test@example.test');
        });
    }

    public function test_non_owner_cannot_run_mail_diagnostics(): void
    {
        $response = $this->actingAs($this->patientUser)
            ->postJson('/api/mail/test');

        $response->assertStatus(403);
        Mail::assertNothingSent();
    }

    public function test_unauthenticated_request_cannot_run_mail_diagnostics(): void
    {
        $response = $this->postJson('/api/mail/test');

        $response->assertStatus(401);
        Mail::assertNothingSent();
    }

    public function test_payment_receipt_mail_renders_proper_clinic_data(): void
    {
        $person = Person::create([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'date_of_birth' => '1995-05-15',
            'gender' => 'Female',
        ]);
        $this->patientUser->update(['person_id' => $person->id]);
        $patient = Patient::create([
            'person_id' => $person->id,
            'patient_code' => 'PAT-MAIL-001',
            'consent' => true,
        ]);
        $branch = Branch::create([
            'legacy_ref' => 'b_qc_mail',
            'name' => 'QC Branch',
            'branch_code' => 'QC-01',
            'city' => 'Quezon City',
            'address' => '123 West Ave, Quezon City',
            'phone' => '02-8123-4567',
            'status' => 'Open',
            'open_time' => '09:00',
            'close_time' => '18:00',
        ]);
        $service = Service::create([
            'code' => 'RST',
            'name' => 'Tooth Restoration',
            'category' => 'Restorative',
            'duration_minutes' => 60,
            'status' => 'Active',
            'legacy_ref' => 'srv_restoration',
        ]);
        $visit = Visit::create([
            'patient_id' => $patient->id,
            'branch_id' => $branch->id,
            'clinic_date' => now()->toDateString(),
            'source' => 'walk_in',
            'status' => 'In Treatment',
            'arrived_at' => now(),
        ]);
        $dentistPerson = Person::create([
            'first_name' => 'Dana',
            'last_name' => 'Roxas',
            'date_of_birth' => '1980-01-01',
            'gender' => 'Female',
        ]);
        $dentist = \App\Models\DentistProfile::create([
            'legacy_ref' => 'd_test_mail',
            'person_id' => $dentistPerson->id,
            'license_no' => 'DENT-888',
            'specialty' => 'General Dentistry',
            'shift_start' => '09:00',
            'shift_end' => '18:00',
        ]);
        $treatment = Treatment::create([
            'visit_id' => $visit->id,
            'dentist_profile_id' => $dentist->id,
            'status' => 'Completed',
            'started_at' => now()->subMinutes(30),
            'completed_at' => now(),
            'created_by_user_id' => $this->owner->id,
            'updated_by_user_id' => $this->owner->id,
        ]);
        $invoice = Invoice::create([
            'treatment_id' => $treatment->id,
            'visit_id' => $visit->id,
            'patient_id' => $patient->id,
            'branch_id' => $branch->id,
            'invoice_number' => 'INV-2026-000888',
            'status' => 'Paid',
            'gross_amount' => 2000.00,
            'patient_responsibility_amount' => 2000.00,
            'paid_amount' => 2000.00,
            'created_by_user_id' => $this->owner->id,
            'updated_by_user_id' => $this->owner->id,
        ]);
        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 2000.00,
            'method' => 'PayMongo (GCASH)',
            'external_reference' => 'pay_mock_123',
            'recorded_by_user_id' => $this->owner->id,
            'recorded_at' => now(),
        ]);
        $receipt = Receipt::create([
            'payment_id' => $payment->id,
            'invoice_id' => $invoice->id,
            'receipt_number' => 'RCT-2026-000888',
            'amount' => 2000.00,
            'method' => 'PayMongo (GCASH)',
            'external_reference' => 'pay_mock_123',
            'issued_at' => now(),
        ]);

        $mailable = new PaymentReceiptMail($invoice->loadMissing(['patient.person', 'branch', 'lines']), $receipt);
        $rendered = $mailable->render();

        $this->assertStringContainsString('RCT-2026-000888', $rendered);
        $this->assertStringContainsString('INV-2026-000888', $rendered);
        $this->assertStringContainsString('PayMongo (GCASH)', $rendered);
        $this->assertStringContainsString('2,000.00', $rendered);
        $this->assertStringContainsString('Dr. Dana E. Roxas Dental Clinic', $rendered);
    }
}
