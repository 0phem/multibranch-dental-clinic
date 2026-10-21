<?php

namespace Tests\Feature\Payment;

use App\Enums\Role;
use App\Mail\AppointmentConfirmationMail;
use App\Mail\PaymentReceiptMail;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Payment;
use App\Models\PaymentCheckoutSession;
use App\Models\Receipt;
use App\Models\ServicePrice;
use App\Models\Treatment;
use App\Models\User;
use App\Models\Visit;
use App\Services\Appointments\AppointmentService;
use App\Services\Billing\BillingService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

class AppointmentBookingPaymentTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private const SECRET = 'whsec_unit_test_secret';

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        // Configure PayMongo for booking payment tests
        config([
            'services.paymongo.secret_key' => 'sk_test_unit_secret',
            'services.paymongo.webhook_secret' => self::SECRET,
            'services.paymongo.mode' => 'test',
            'services.paymongo.payment_method_types' => 'gcash, card',
            'services.paymongo.base_url' => 'https://api.paymongo.com',
            'app.frontend_url' => 'http://localhost:5173',
        ]);

        $this->setUpSchedulingWorld();
    }

    private function freshHttp(): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory());
    }

    private function fakePayMongoCheckout(string $sessionId = 'cs_apt_unit_1'): void
    {
        $this->freshHttp();
        Http::fake([
            'https://api.paymongo.com/v2/checkout_sessions' => Http::response([
                'data' => [
                    'id' => $sessionId,
                    'attributes' => [
                        'checkout_url' => "https://checkout.paymongo.com/{$sessionId}",
                        'livemode' => false,
                    ],
                ],
            ], 200),
        ]);
    }

    private function fakePayMongoRefund(string $refundId = 'ref_unit_1'): void
    {
        Http::fake([
            'https://api.paymongo.com/v1/refunds' => Http::response([
                'data' => [
                    'id' => $refundId,
                    'attributes' => [
                        'amount' => 60000,
                        'status' => 'succeeded',
                    ],
                ],
            ], 200),
        ]);
    }

    private function fakePayMongoProvider(string $sessionId, string $paymentId, Appointment $appointment, int $centavos = 60000, ?string $refundId = null): void
    {
        $fakes = [
            "https://api.paymongo.com/v1/checkout_sessions/{$sessionId}" => Http::response([
                'data' => [
                    'id' => $sessionId,
                    'attributes' => [
                        'status' => 'active',
                        'reference_number' => $appointment->public_id,
                        'livemode' => false,
                        'payments' => [
                            [
                                'id' => $paymentId,
                                'type' => 'payment',
                                'attributes' => [
                                    'status' => 'paid',
                                    'amount' => $centavos,
                                    'currency' => 'PHP',
                                    'source' => ['type' => 'gcash'],
                                ],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ];

        if ($refundId !== null) {
            $fakes['https://api.paymongo.com/v1/refunds'] = Http::response([
                'data' => [
                    'id' => $refundId,
                    'attributes' => [
                        'amount' => $centavos,
                        'status' => 'succeeded',
                    ],
                ],
            ], 200);
        }

        Http::fake($fakes);
    }

    private function deliverWebhook(array $payload): \Illuminate\Testing\TestResponse
    {
        $raw = json_encode($payload);
        $t = (string) time();
        $signature = hash_hmac('sha256', $t.'.'.$raw, self::SECRET);
        $header = "t={$t},te={$signature},li=";

        return $this->call('POST', '/api/webhooks/paymongo', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_Paymongo_Signature' => $header,
        ], $raw);
    }

    private function appointmentPaidWebhook(string $eventId, string $sessionId, string $paymentId, Appointment $appointment, int $centavos = 60000): array
    {
        return [
            'data' => [
                'id' => $eventId,
                'attributes' => [
                    'type' => 'checkout_session.payment.paid',
                    'livemode' => false,
                    'data' => [
                        'id' => $sessionId,
                        'attributes' => [
                            'reference_number' => $appointment->public_id,
                            'status' => 'active',
                            'livemode' => false,
                            'payments' => [
                                [
                                    'id' => $paymentId,
                                    'type' => 'payment',
                                    'attributes' => [
                                        'amount' => $centavos,
                                        'status' => 'paid',
                                        'source' => ['type' => 'gcash'],
                                        'paid_at' => time(),
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function test_patient_booking_creates_pending_held_appointment_and_paymongo_checkout_session(): void
    {
        $this->fakePayMongoCheckout('cs_booking_test_1');
        $this->actingAsUser('patientA');

        $response = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.booking_payment_status', 'held')
            ->assertJsonPath('data.booking_fee_php', '600.00')
            ->assertJsonPath('data.checkout_url', 'https://checkout.paymongo.com/cs_booking_test_1')
            ->assertJsonPath('data.checkout_session_id', 'cs_booking_test_1');

        $appointment = Appointment::where('public_id', $response->json('data.id'))->firstOrFail();
        $this->assertSame('Pending', $appointment->status);
        $this->assertSame('held', $appointment->booking_payment_status);
        $this->assertNotNull($appointment->booking_hold_expires_at);

        // Never sends confirmation at initial slot hold (held state)
        Mail::assertNotSent(AppointmentConfirmationMail::class);

        $session = PaymentCheckoutSession::where('appointment_id', $appointment->id)->firstOrFail();
        $this->assertSame('cs_booking_test_1', $session->provider_session_id);
        $this->assertSame('600.00', (string) $session->amount);
        $this->assertSame('Open', $session->status);
    }

    public function test_pending_held_appointment_locks_slot_against_double_booking(): void
    {
        $this->fakePayMongoCheckout('cs_lock_1');
        $this->actingAsUser('patientA');

        $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertCreated();

        // Second patient tries to book the same slot
        $this->actingAsUser('patientB');
        $this->fakePayMongoCheckout('cs_lock_2');

        // d1 is held by patientA; d2 can take svc1 at b1, so d2 is assigned
        $res2 = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertCreated();

        // Now both d1 and d2 are held for b1 09:00. Third attempt must fail with no dentist available.
        $userC = $this->patient('PAT-0003')[0];
        $this->actingAs($userC);
        $this->fakePayMongoCheckout('cs_lock_3');

        $res3 = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertStatus(422);

        $this->assertContains('dentist-assignment', $res3->json('failed_checks'));
    }

    public function test_webhook_payment_paid_confirms_appointment_and_settles_session(): void
    {
        $this->fakePayMongoCheckout('cs_webhook_1');
        $this->actingAsUser('patientA');

        $response = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertCreated();

        $appointment = Appointment::where('public_id', $response->json('data.id'))->firstOrFail();

        // Deliver webhook from PayMongo
        $this->fakePayMongoProvider('cs_webhook_1', 'pay_apt_1', $appointment, 60000);
        $payload = $this->appointmentPaidWebhook('evt_booking_1', 'cs_webhook_1', 'pay_apt_1', $appointment, 60000);
        $this->deliverWebhook($payload)->assertOk();

        $fresh = $appointment->fresh();
        $this->assertSame('Confirmed', $fresh->status);
        $this->assertSame('paid', $fresh->booking_payment_status);
        $this->assertSame('pay_apt_1', $fresh->booking_payment_ref);
        $this->assertSame('PayMongo (GCASH)', $fresh->booking_payment_method);
        $this->assertNotNull($fresh->booking_paid_at);

        $session = PaymentCheckoutSession::where('appointment_id', $appointment->id)->first();
        $this->assertSame('Settled', $session->status);

        // Triggers appointment confirmation email with .ics calendar file
        Mail::assertSent(AppointmentConfirmationMail::class, function (AppointmentConfirmationMail $mail) use ($fresh) {
            $hasIcs = collect($mail->attachments())->contains(function ($attachment) {
                return $attachment->as === 'appointment.ics' && $attachment->mime === 'text/calendar';
            });

            return $mail->appointment->id === $fresh->id && $hasIcs;
        });
    }

    public function test_expired_hold_is_released_and_frees_slot(): void
    {
        $this->fakePayMongoCheckout('cs_expire_1');
        $this->actingAsUser('patientA');

        $response = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertCreated();

        $appointment = Appointment::where('public_id', $response->json('data.id'))->firstOrFail();

        // Travel 16 minutes into the future
        $this->travel(16)->minutes();

        $service = app(AppointmentService::class);
        $releasedCount = $service->releaseExpiredHolds();

        $this->assertSame(1, $releasedCount);
        $fresh = $appointment->fresh();
        $this->assertSame('Cancelled', $fresh->status);
        $this->assertSame('unpaid', $fresh->booking_payment_status);
    }

    public function test_cancellation_at_least_24h_before_appointment_triggers_paymongo_refund(): void
    {
        $this->fakePayMongoCheckout('cs_refund_1');
        $this->actingAsUser('patientA');

        $response = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-30', // 2 days ahead (> 24h)
            'start_time' => '09:00',
        ])->assertCreated();

        $appointment = Appointment::where('public_id', $response->json('data.id'))->firstOrFail();

        // Webhook arrives to mark paid
        $this->fakePayMongoProvider('cs_refund_1', 'pay_ref_1', $appointment, 60000, 'ref_booking_123');
        $payload = $this->appointmentPaidWebhook('evt_ref_1', 'cs_refund_1', 'pay_ref_1', $appointment, 60000);
        $this->deliverWebhook($payload)->assertOk();

        // Set up fake refund response
        $this->fakePayMongoRefund('ref_booking_123');

        // Patient cancels
        $this->actingAsUser('patientA');
        $this->postJson("/api/appointments/{$appointment->public_id}/cancel", [
            'expected_revision' => $appointment->fresh()->revision,
        ])->assertOk();

        $fresh = $appointment->fresh();
        $this->assertSame('Cancelled', $fresh->status);
        $this->assertSame('refunded', $fresh->booking_payment_status);
        $this->assertSame('ref_booking_123', $fresh->booking_refund_ref);
        $this->assertNotNull($fresh->booking_refunded_at);

        Http::assertSent(fn ($r) => $r->url() === 'https://api.paymongo.com/v1/refunds'
            && $r->data()['data']['attributes']['payment_id'] === 'pay_ref_1'
            && $r->data()['data']['attributes']['amount'] === 60000);
    }

    public function test_cancellation_less_than_24h_before_appointment_withholds_refund_and_marks_forfeited(): void
    {
        $this->fakePayMongoCheckout('cs_forfeit_1');
        $this->actingAsUser('patientA');

        // Current frozen time is 2026-09-28 10:00 Asia/Manila. Appointment on 2026-09-29 09:00 is 23 hours away (< 24h).
        $response = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertCreated();

        $appointment = Appointment::where('public_id', $response->json('data.id'))->firstOrFail();

        // Webhook arrives to mark paid
        $this->fakePayMongoProvider('cs_forfeit_1', 'pay_forf_1', $appointment, 60000);
        $payload = $this->appointmentPaidWebhook('evt_forf_1', 'cs_forfeit_1', 'pay_forf_1', $appointment, 60000);
        $this->deliverWebhook($payload)->assertOk();

        $this->freshHttp();

        // Patient cancels < 24h
        $this->actingAsUser('patientA');
        $this->postJson("/api/appointments/{$appointment->public_id}/cancel", [
            'expected_revision' => $appointment->fresh()->revision,
        ])->assertOk();

        $fresh = $appointment->fresh();
        $this->assertSame('Cancelled', $fresh->status);
        $this->assertSame('forfeited', $fresh->booking_payment_status);
        $this->assertNull($fresh->booking_refund_ref);

        // PayMongo refund endpoint was NOT called
        Http::assertNotSent(fn ($r) => $r->url() === 'https://api.paymongo.com/v1/refunds');

        // Audit log created for late cancellation refund decision
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'billing.booking_refund_withheld_late_cancellation',
            'auditable_type' => 'Appointment',
            'auditable_public_id' => $appointment->public_id,
        ]);
    }

    public function test_front_desk_can_manually_refund_a_forfeited_booking_payment(): void
    {
        $this->fakePayMongoCheckout('cs_manual_ref');
        $this->actingAsUser('patientA');

        $response = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertCreated();

        $appointment = Appointment::where('public_id', $response->json('data.id'))->firstOrFail();
        $this->fakePayMongoProvider('cs_manual_ref', 'pay_man_1', $appointment, 60000);
        $payload = $this->appointmentPaidWebhook('evt_man_1', 'cs_manual_ref', 'pay_man_1', $appointment, 60000);
        $this->deliverWebhook($payload)->assertOk();

        // Mark forfeited
        $appointment->fresh()->update(['status' => 'Cancelled', 'booking_payment_status' => 'forfeited']);

        $this->fakePayMongoRefund('ref_manual_789');

        // Owner/Staff decides to refund
        $service = app(AppointmentService::class);
        $result = $service->refundBookingPayment($this->u['owner'], $appointment->fresh(), 'customer_courtesy');

        $this->assertSame('ref_manual_789', $result['refund_id']);
        $fresh = $appointment->fresh();
        $this->assertSame('refunded', $fresh->booking_payment_status);
        $this->assertSame('ref_manual_789', $fresh->booking_refund_ref);
    }

    public function test_booking_payment_credits_invoice_patient_responsibility_at_issuance(): void
    {
        $this->fakePayMongoCheckout('cs_invoice_credit');
        $this->actingAsUser('patientA');

        $response = $this->postJson('/api/appointments', [
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'date' => '2026-09-29',
            'start_time' => '09:00',
        ])->assertCreated();

        $appointment = Appointment::where('public_id', $response->json('data.id'))->firstOrFail();
        $this->fakePayMongoProvider('cs_invoice_credit', 'pay_inv_1', $appointment, 60000);
        $payload = $this->appointmentPaidWebhook('evt_inv_1', 'cs_invoice_credit', 'pay_inv_1', $appointment, 60000);
        $this->deliverWebhook($payload)->assertOk();

        // Create visit linked to this appointment
        $visit = Visit::create([
            'patient_id' => $appointment->patient_id,
            'branch_id' => $appointment->branch_id,
            'appointment_id' => $appointment->id,
            'clinic_date' => '2026-09-29',
            'source' => 'appointment',
            'status' => 'In Treatment',
            'arrived_at' => now(),
        ]);

        $treatment = Treatment::create([
            'visit_id' => $visit->id,
            'dentist_profile_id' => $appointment->dentist_profile_id,
            'status' => 'Completed',
            'started_at' => now()->subMinutes(30),
            'completed_at' => now(),
            'created_by_user_id' => $this->u['staffB1']->id,
            'updated_by_user_id' => $this->u['staffB1']->id,
        ]);

        // Create invoice in Review state with gross amount 600.00 (same as booking fee)
        $invoice = Invoice::create([
            'treatment_id' => $treatment->id,
            'visit_id' => $visit->id,
            'patient_id' => $appointment->patient_id,
            'branch_id' => $appointment->branch_id,
            'invoice_number' => 'INV-CREDIT-001',
            'status' => 'Review',
            'revision' => 1,
            'gross_amount' => 600.00,
            'hmo_coverage_amount' => 0.00,
            'patient_responsibility_amount' => 600.00,
            'paid_amount' => 0.00,
            'created_by_user_id' => $this->u['staffB1']->id,
            'updated_by_user_id' => $this->u['staffB1']->id,
        ]);

        $price = ServicePrice::create([
            'service_id' => $this->svc['svc1']->id,
            'branch_id' => null,
            'kind' => 'priced',
            'amount' => '600.00',
            'effective_from' => now()->subDay()->toDateString(),
            'source' => 'owner_confirmed',
            'created_by_user_id' => $this->u['owner']->id,
            'created_at' => now(),
        ]);

        InvoiceLine::create([
            'invoice_id' => $invoice->id,
            'service_id' => $this->svc['svc1']->id,
            'service_price_id' => $price->id,
            'line_no' => 1,
            'service_code' => 'SVC1',
            'service_name' => 'Service svc1',
            'quantity' => 1,
            'unit_price' => 600.00,
            'line_total' => 600.00,
        ]);

        $billing = app(BillingService::class);
        $issued = $billing->transition($this->u['staffB1'], $invoice, 'Issued', 1);

        // Fully covered by the booking deposit: status is Paid, settlement is booking_deposit
        $this->assertSame('Paid', $issued->status);
        $this->assertSame('600.00', (string) $issued->paid_amount);
        $this->assertSame('booking_deposit', $issued->settlement_type);

        // Payment and Receipt were generated
        $payment = Payment::where('invoice_id', $invoice->id)->first();
        $this->assertNotNull($payment);
        $this->assertSame('600.00', (string) $payment->amount);
        $this->assertSame('pay_inv_1', $payment->external_reference);

        $receipt = Receipt::where('invoice_id', $invoice->id)->first();
        $this->assertNotNull($receipt);
        $this->assertSame('600.00', (string) $receipt->amount);

        // When the invoice is issued and settled by the deposit, PaymentReceiptMail is queued/sent
        Mail::assertSent(PaymentReceiptMail::class, function (PaymentReceiptMail $mail) use ($invoice, $receipt) {
            return $mail->invoice->id === $invoice->id && $mail->receipt->id === $receipt->id;
        });
    }

    public function test_release_expired_holds_command_is_registered_in_scheduler_every_minute(): void
    {
        $schedule = app(\Illuminate\Console\Scheduling\Schedule::class);
        $event = collect($schedule->events())->first(fn ($e) => str_contains((string) $e->command, 'appointments:release-expired-holds'));

        $this->assertNotNull($event, 'appointments:release-expired-holds must be registered in the Laravel scheduler');
        $this->assertSame('* * * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
    }
}
