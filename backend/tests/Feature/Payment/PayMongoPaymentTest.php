<?php

namespace Tests\Feature\Payment;

use App\Enums\Role;
use App\Mail\PaymentReceiptMail;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Patient;
use App\Models\Person;
use App\Models\Service;
use App\Models\ServicePrice;
use App\Models\Treatment;
use App\Models\User;
use App\Models\UserBranchScope;
use App\Models\Visit;
use App\Services\Payment\PayMongoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PayMongoPaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $patientUser;
    private Patient $patient;
    private Branch $branch;
    private Invoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();

        // Seed basic reference models
        $this->owner = User::factory()->create([
            'role' => Role::Owner,
            'email' => 'owner@example.test',
        ]);

        $person = Person::create([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'date_of_birth' => '1995-05-15',
            'gender' => 'Female',
            'phone_number' => '+639171234567',
        ]);

        $this->patientUser = User::factory()->create([
            'role' => Role::Patient,
            'person_id' => $person->id,
            'email' => 'maria@example.test',
            'email_verified_at' => now(),
        ]);

        $this->patient = Patient::create([
            'person_id' => $person->id,
            'patient_code' => 'PAT-TEST-001',
            'consent' => true,
        ]);

        $this->branch = Branch::create([
            'legacy_ref' => 'b_qc',
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
            'code' => 'CLN',
            'name' => 'Dental Cleaning',
            'category' => 'Preventive',
            'duration_minutes' => 45,
            'status' => 'Active',
            'legacy_ref' => 'srv_cleaning',
        ]);

        $price = ServicePrice::create([
            'service_id' => $service->id,
            'branch_id' => null,
            'kind' => 'priced',
            'amount' => '1500.00',
            'effective_from' => now()->subDay()->toDateString(),
            'source' => 'owner_confirmed',
            'created_by_user_id' => $this->owner->id,
            'created_at' => now(),
        ]);

        $visit = Visit::create([
            'patient_id' => $this->patient->id,
            'branch_id' => $this->branch->id,
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
            'legacy_ref' => 'd_test',
            'person_id' => $dentistPerson->id,
            'license_no' => 'DENT-999',
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

        // Create an Issued invoice
        $this->invoice = Invoice::create([
            'treatment_id' => $treatment->id,
            'visit_id' => $visit->id,
            'patient_id' => $this->patient->id,
            'branch_id' => $this->branch->id,
            'invoice_number' => 'INV-2026-999901',
            'status' => 'Issued',
            'revision' => 2,
            'gross_amount' => 1500.00,
            'hmo_coverage_amount' => 0.00,
            'patient_responsibility_amount' => 1500.00,
            'paid_amount' => 0.00,
            'issued_at' => now(),
            'created_by_user_id' => $this->owner->id,
            'updated_by_user_id' => $this->owner->id,
        ]);

        InvoiceLine::create([
            'invoice_id' => $this->invoice->id,
            'service_id' => $service->id,
            'service_price_id' => $price->id,
            'line_no' => 1,
            'service_code' => 'CLN',
            'service_name' => 'Dental Cleaning',
            'quantity' => 1,
            'unit_price' => 1500.00,
            'line_total' => 1500.00,
        ]);
    }

    public function test_patient_can_create_checkout_session_for_their_issued_invoice(): void
    {
        Http::fake([
            'https://api.paymongo.com/v1/checkout_sessions' => Http::response([
                'data' => [
                    'id' => 'cs_test_mock_123',
                    'attributes' => [
                        'checkout_url' => 'https://checkout.paymongo.com/cs_test_mock_123',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($this->patientUser)
            ->postJson("/api/invoices/{$this->invoice->public_id}/paymongo-checkout", [
                'success_url' => 'http://localhost:5173/patient/billing?success=1',
                'cancel_url' => 'http://localhost:5173/patient/billing?cancel=1',
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.checkout_session_id', 'cs_test_mock_123');
        $response->assertJsonPath('data.checkout_url', 'https://checkout.paymongo.com/cs_test_mock_123');
        $response->assertJsonPath('data.reference_number', $this->invoice->public_id);
    }

    public function test_checkout_refused_for_another_patients_invoice(): void
    {
        $otherPerson = Person::create([
            'first_name' => 'Intruder',
            'last_name' => 'Patient',
            'date_of_birth' => '1990-01-01',
            'email' => 'intruder@example.test',
        ]);
        $otherUser = User::factory()->create([
            'role' => Role::Patient,
            'person_id' => $otherPerson->id,
            'email' => 'intruder@example.test',
        ]);
        $otherPatient = Patient::create([
            'person_id' => $otherPerson->id,
            'patient_code' => 'PAT-TEST-002',
            'consent' => true,
        ]);

        $response = $this->actingAs($otherUser)
            ->postJson("/api/invoices/{$this->invoice->public_id}/paymongo-checkout");

        $response->assertStatus(403);
    }

    public function test_checkout_refused_for_unissued_draft_invoice(): void
    {
        $this->invoice->update(['status' => 'Draft']);

        $response = $this->actingAs($this->patientUser)
            ->postJson("/api/invoices/{$this->invoice->public_id}/paymongo-checkout");

        $response->assertStatus(422);
        $response->assertJsonPath('code', 'invalid_invoice_state');
    }

    public function test_webhook_refuses_invalid_signature(): void
    {
        $payload = [
            'data' => [
                'attributes' => [
                    'type' => 'checkout_session.payment.paid',
                    'data' => [
                        'id' => 'cs_123',
                        'attributes' => [
                            'reference_number' => $this->invoice->public_id,
                        ],
                    ],
                ],
            ],
        ];

        $response = $this->postJson('/api/webhooks/paymongo', $payload, [
            'Paymongo-Signature' => 'invalid_signature_header',
        ]);

        $response->assertStatus(400);
        $this->assertEquals('Issued', $this->invoice->fresh()->status);
    }

    public function test_webhook_with_valid_signature_settles_invoice_and_creates_receipt(): void
    {
        $webhookSecret = 'whsec_sample_secret';
        config(['services.paymongo.webhook_secret' => $webhookSecret]);

        $rawPayload = json_encode([
            'data' => [
                'attributes' => [
                    'type' => 'checkout_session.payment.paid',
                    'data' => [
                        'id' => 'cs_test_session_456',
                        'attributes' => [
                            'reference_number' => $this->invoice->public_id,
                            'payment_method_used' => 'gcash',
                            'payments' => [
                                [
                                    'id' => 'pay_test_gcash_789',
                                    'attributes' => [
                                        'source' => [
                                            'type' => 'gcash',
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ]);

        $timestamp = (string)time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $rawPayload, $webhookSecret);
        $header = "t={$timestamp},te={$signature}";

        $response = $this->call(
            'POST',
            '/api/webhooks/paymongo',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_Paymongo_Signature' => $header,
            ],
            $rawPayload
        );

        $response->assertStatus(200);
        $response->assertJsonPath('received', true);
        $response->assertJsonPath('data.status', 'Paid');
        $response->assertJsonPath('data.method', 'PayMongo (GCASH)');

        $fresh = $this->invoice->fresh(['payment', 'receipt']);
        $this->assertEquals('Paid', $fresh->status);
        $this->assertEquals('1500.00', (string)$fresh->paid_amount);
        $this->assertNotNull($fresh->payment);
        $this->assertEquals('PayMongo (GCASH)', $fresh->payment->method);
        $this->assertEquals('pay_test_gcash_789', $fresh->payment->external_reference);
        $this->assertNotNull($fresh->receipt);
        $this->assertStringStartsWith('RCT-', $fresh->receipt->receipt_number);

        // Verify receipt email was dispatched to patient
        Mail::assertSent(PaymentReceiptMail::class, function ($mail) {
            return $mail->hasTo($this->patientUser->email);
        });
    }

    public function test_webhook_is_idempotent_on_replay(): void
    {
        // First pay the invoice online
        $service = app(PayMongoService::class);
        $service->processWebhook([
            'data' => [
                'attributes' => [
                    'type' => 'checkout_session.payment.paid',
                    'data' => [
                        'id' => 'cs_123',
                        'attributes' => [
                            'reference_number' => $this->invoice->public_id,
                            'payment_method_used' => 'card',
                            'payments' => [
                                ['id' => 'pay_card_001'],
                            ],
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertEquals('Paid', $this->invoice->fresh()->status);
        $receiptCountBefore = \App\Models\Receipt::count();

        // Replay same webhook payload
        $result = $service->processWebhook([
            'data' => [
                'attributes' => [
                    'type' => 'checkout_session.payment.paid',
                    'data' => [
                        'id' => 'cs_123',
                        'attributes' => [
                            'reference_number' => $this->invoice->public_id,
                            'payment_method_used' => 'card',
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertTrue($result['ok']);
        $this->assertEquals($receiptCountBefore, \App\Models\Receipt::count());
    }
}
