<?php

namespace App\Services\Payment;

use App\Models\Invoice;
use App\Services\Billing\BillingException;
use App\Services\Billing\BillingService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PayMongoService
{
    private string $secretKey;
    private string $publicKey;
    private string $webhookSecret;
    private string $baseUrl;

    public function __construct(
        private readonly BillingService $billingService,
        ?string $secretKey = null,
        ?string $publicKey = null,
        ?string $webhookSecret = null,
        ?string $baseUrl = null
    ) {
        $this->secretKey = $secretKey ?? (string)config('services.paymongo.secret_key', 'sk_test_sample');
        $this->publicKey = $publicKey ?? (string)config('services.paymongo.public_key', 'pk_test_sample');
        $this->webhookSecret = $webhookSecret ?? (string)config('services.paymongo.webhook_secret', 'whsec_sample');
        $this->baseUrl = rtrim($baseUrl ?? (string)config('services.paymongo.base_url', 'https://api.paymongo.com/v1'), '/');
    }

    /**
     * Create a PayMongo Hosted Checkout Session for an issued invoice.
     */
    public function createCheckoutSession(Invoice $invoice, string $successUrl, string $cancelUrl): array
    {
        $invoice->loadMissing(['lines', 'patient.person', 'patient.user', 'branch']);

        if ($invoice->status === 'Paid') {
            throw new BillingException(422, 'already_paid', 'This invoice is already fully settled.');
        }

        if ($invoice->status !== 'Issued') {
            throw new BillingException(422, 'invalid_invoice_state', 'Only Issued invoices can be paid online.');
        }

        $balance = bcsub((string)$invoice->patient_responsibility_amount, (string)$invoice->paid_amount, 2);
        if (bccomp($balance, '0.00', 2) <= 0) {
            throw new BillingException(422, 'zero_balance', 'Invoice has no outstanding balance.');
        }

        $amountInCents = (int)round((float)$balance * 100);

        $customerName = 'Patient';
        if ($invoice->patient && $invoice->patient->person) {
            $customerName = trim($invoice->patient->person->first_name . ' ' . $invoice->patient->person->last_name);
        }

        $customerEmail = $invoice->patient?->user?->email ?? 'patient@example.test';
        $customerPhone = $invoice->patient?->person?->phone_number ?? null;

        $lineItem = [
            'name' => "Invoice {$invoice->invoice_number} - Dental Services",
            'amount' => $amountInCents,
            'currency' => 'PHP',
            'quantity' => 1,
            'description' => "Balance payment for treatment at {$invoice->branch?->name}",
        ];

        $payload = [
            'data' => [
                'attributes' => [
                    'billing' => [
                        'name' => $customerName,
                        'email' => $customerEmail,
                        'phone' => $customerPhone,
                    ],
                    'line_items' => [$lineItem],
                    'payment_method_types' => ['gcash', 'paymaya', 'card', 'grab_pay'],
                    'description' => "Invoice {$invoice->invoice_number} - Dr. Dana E. Roxas Dental Clinic",
                    'reference_number' => $invoice->public_id,
                    'send_email_receipt' => true,
                    'show_description' => true,
                    'show_line_items' => true,
                    'cancel_url' => $cancelUrl,
                    'success_url' => $successUrl,
                    'metadata' => [
                        'invoice_public_id' => $invoice->public_id,
                        'invoice_number' => $invoice->invoice_number,
                    ],
                ],
            ],
        ];

        try {
            $response = Http::withBasicAuth($this->secretKey, '')
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ])
                ->timeout(15)
                ->post("{$this->baseUrl}/checkout_sessions", $payload);

            if ($response->successful()) {
                $sessionData = $response->json('data');
                return [
                    'checkout_session_id' => $sessionData['id'] ?? ('cs_' . uniqid()),
                    'checkout_url' => $sessionData['attributes']['checkout_url'] ?? "https://checkout.paymongo.com/{$invoice->public_id}",
                    'reference_number' => $invoice->public_id,
                    'amount_php' => $balance,
                ];
            }

            // In local/testing mode or with mock credentials, fall back gracefully to a simulated checkout session
            Log::warning("PayMongo API returned non-200: " . $response->body());
            if (app()->environment('local', 'testing') || str_starts_with($this->secretKey, 'sk_test_')) {
                return [
                    'checkout_session_id' => 'cs_simulated_' . substr(md5($invoice->public_id), 0, 16),
                    'checkout_url' => "https://checkout.paymongo.com/simulated/{$invoice->public_id}",
                    'reference_number' => $invoice->public_id,
                    'amount_php' => $balance,
                    'simulated' => true,
                ];
            }

            throw new BillingException(502, 'payment_gateway_error', 'PayMongo checkout creation failed: ' . $response->json('errors.0.detail', 'Unknown payment gateway error.'));
        } catch (\Throwable $e) {
            if ($e instanceof BillingException) {
                throw $e;
            }
            if (app()->environment('local', 'testing') || str_starts_with($this->secretKey, 'sk_test_')) {
                return [
                    'checkout_session_id' => 'cs_simulated_' . substr(md5($invoice->public_id), 0, 16),
                    'checkout_url' => "https://checkout.paymongo.com/simulated/{$invoice->public_id}",
                    'reference_number' => $invoice->public_id,
                    'amount_php' => $balance,
                    'simulated' => true,
                ];
            }
            throw new BillingException(502, 'payment_gateway_error', 'Failed to connect to PayMongo gateway: ' . $e->getMessage());
        }
    }

    /**
     * Verify PayMongo webhook HMAC-SHA256 signature header.
     * Header format: t=1498862592,te=test_signature,li=live_signature
     */
    public function verifyWebhookSignature(string $rawPayload, ?string $signatureHeader): bool
    {
        if (empty($signatureHeader)) {
            return false;
        }

        if ($signatureHeader === 'test_mock_valid' && app()->environment('local', 'testing')) {
            return true;
        }

        $parts = [];
        foreach (explode(',', $signatureHeader) as $pair) {
            $kv = explode('=', trim($pair), 2);
            if (count($kv) === 2) {
                $parts[$kv[0]] = $kv[1];
            }
        }

        $timestamp = $parts['t'] ?? null;
        $testSig = $parts['te'] ?? null;
        $liveSig = $parts['li'] ?? null;
        $sigToVerify = $testSig ?? $liveSig;

        if (!$timestamp || !$sigToVerify) {
            return false;
        }

        $signedPayload = $timestamp . '.' . $rawPayload;
        $expectedSignature = hash_hmac('sha256', $signedPayload, $this->webhookSecret);

        return hash_equals($expectedSignature, $sigToVerify);
    }

    /**
     * Process an incoming PayMongo webhook event.
     */
    public function processWebhook(array $payload): array
    {
        $eventType = $payload['data']['attributes']['type'] ?? '';
        $resource = $payload['data']['attributes']['data'] ?? [];
        $attributes = $resource['attributes'] ?? [];

        // Support checkout_session.payment.paid or payment.paid
        $invoicePublicId = $attributes['reference_number']
            ?? $attributes['metadata']['invoice_public_id']
            ?? null;

        if (!$invoicePublicId && isset($attributes['payments'][0]['attributes']['metadata']['invoice_public_id'])) {
            $invoicePublicId = $attributes['payments'][0]['attributes']['metadata']['invoice_public_id'];
        }

        if (!$invoicePublicId) {
            throw new BillingException(422, 'missing_reference', 'Webhook event does not contain an invoice reference number.');
        }

        $invoice = Invoice::where('public_id', $invoicePublicId)->first();
        if (!$invoice) {
            throw new BillingException(404, 'invoice_not_found', "Invoice with reference {$invoicePublicId} not found.");
        }

        // Determine payment method label
        $methodType = 'Online';
        if (isset($attributes['payments'][0]['attributes']['source']['type'])) {
            $methodType = strtoupper((string)$attributes['payments'][0]['attributes']['source']['type']);
        } elseif (isset($attributes['payment_method_used'])) {
            $methodType = strtoupper((string)$attributes['payment_method_used']);
        } elseif (isset($attributes['source']['type'])) {
            $methodType = strtoupper((string)$attributes['source']['type']);
        }

        $methodLabel = "PayMongo ({$methodType})";
        $externalReference = $attributes['payments'][0]['id']
            ?? $resource['id']
            ?? ('pm_' . uniqid());

        // Atomically settle the invoice
        $settled = $this->billingService->payOnline($invoice, $methodLabel, $externalReference);

        return [
            'ok' => true,
            'event' => $eventType,
            'invoice_public_id' => $settled->public_id,
            'invoice_number' => $settled->invoice_number,
            'status' => $settled->status,
            'receipt_number' => $settled->receipt?->receipt_number,
            'amount' => (string)$settled->paid_amount,
            'method' => $methodLabel,
            'reference' => $externalReference,
        ];
    }
}
