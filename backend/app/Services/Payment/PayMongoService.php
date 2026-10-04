<?php

namespace App\Services\Payment;

use App\Models\Invoice;
use App\Models\PaymentCheckoutSession;
use App\Models\PaymentProviderEvent;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Services\Billing\BillingException;
use App\Services\Billing\BillingService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

// PayMongo hosted-checkout integration for M11.
//
// What this class guarantees (technical, and covered by tests):
//   * credentials come only from server configuration; a missing key or webhook secret fails closed — there is no simulated or
//     "test" fallback, no placeholder secret and no signature bypass;
//   * the browser is never proof of payment: only a signature-verified provider event, bound to a checkout session THIS server
//     created for THAT invoice, and confirmed by asking the provider directly, can settle an invoice;
//   * the amount captured must equal the server's current balance exactly (integer centavos, never a float);
//   * every verified event is stored by its provider event id before it is acted on, so a duplicate delivery is harmless and a
//     captured payment that cannot be applied stays on record as "Needs review" instead of vanishing.
//
// DOCUMENTATION COMPATIBILITY (checked against docs.paymongo.com): Hosted Checkout is created with POST /v2/checkout_sessions (the
// recommended version for new integrations) using HTTP Basic auth with the secret key and integer-centavo PHP line items;
// the paid event is checkout_session.payment.paid; a session is read back with GET /v1/checkout_sessions/{id}, whose
// data.attributes.payments[] carry id, status, amount and currency; the webhook header is `t=<timestamp>,te=<test>,li=<live>` and
// the signature is HMAC-SHA256 over "<t>.<raw request body>" with the endpoint secret, `te` for test mode and `li` for live mode,
// compared in constant time.
// LIVE PROVIDER VERIFICATION REQUIRED: none of this has run against a real PayMongo test or live account. In particular the
// documentation shows a v1 path for retrieving a session while creation is v2; if a v2 session cannot be read back that way the
// integration fails SAFE (every capture is kept as "Needs review"), it never settles on an unconfirmed payment. The payment methods
// a merchant may offer depend on its PayMongo account, so they are configured explicitly (no default list).
class PayMongoService
{
    public const PAID_EVENT = 'checkout_session.payment.paid';

    public const CURRENCY = 'PHP';

    private const METHOD_LABELS = ['gcash' => 'GCASH', 'paymaya' => 'MAYA', 'card' => 'CARD', 'grab_pay' => 'GRABPAY', 'dob' => 'ONLINE BANKING', 'brankas_bdo' => 'ONLINE BANKING', 'qrph' => 'QR PH'];

    public function __construct(private readonly BillingService $billing, private readonly AuditService $audit) {}

    private function secretKey(): string
    {
        return $this->required('services.paymongo.secret_key');
    }

    private function webhookSecret(): string
    {
        return $this->required('services.paymongo.webhook_secret');
    }

    private function host(): string
    {
        // PAYMONGO_BASE_URL is the API host; a trailing /v1 or /v2 left over from older configuration is ignored.
        return preg_replace('#/v\d+$#', '', rtrim((string) config('services.paymongo.base_url', 'https://api.paymongo.com'), '/'));
    }

    /** True for a live-mode endpoint. The mode is configured explicitly and must agree with the key's own prefix. */
    private function live(): bool
    {
        $mode = $this->required('services.paymongo.mode');
        $key = $this->secretKey();
        if (! in_array($mode, ['test', 'live'], true) || ($mode === 'live') === str_starts_with($key, 'sk_test_') || ($mode === 'test') === str_starts_with($key, 'sk_live_')) {
            throw new BillingException(503, 'payment_not_configured', 'Online payment is not configured on this server.');
        }

        return $mode === 'live';
    }

    /** @return list<string> */
    private function paymentMethodTypes(): array
    {
        $configured = config('services.paymongo.payment_method_types');
        $types = is_array($configured) ? $configured : (is_string($configured) ? explode(',', $configured) : []);
        $types = array_values(array_filter(array_map(fn ($t) => strtolower(trim((string) $t)), $types), fn ($t) => preg_match('/^[a-z0-9_]{2,30}$/', $t)));
        if (! $types) {
            // The methods a merchant may accept depend on its PayMongo account; none are assumed.
            throw new BillingException(503, 'payment_not_configured', 'Online payment methods are not configured on this server.');
        }

        return $types;
    }

    /** A missing credential is an explicit configuration error, never a silent default. */
    private function required(string $key): string
    {
        $value = config($key);
        if (! is_string($value) || trim($value) === '') {
            throw new BillingException(503, 'payment_not_configured', 'Online payment is not configured on this server.');
        }

        return $value;
    }

    // ---- checkout ---------------------------------------------------------------------------------------------------

    /**
     * Creates a hosted checkout session for the invoice's exact current balance and records it. The return URLs are built by the
     * server from the configured SPA origin; a client cannot choose where the provider sends the browser. A provider failure is an
     * explicit error — never a simulated session.
     */
    public function createCheckoutSession(Invoice $invoice, User $actor): array
    {
        $secret = $this->secretKey();
        $this->live(); // mode/key consistency is checked before anything is sent
        $methods = $this->paymentMethodTypes();
        // Serialized per invoice: a second initiation (double click, retry, two tabs) waits here and then sees the first one's session.
        return DB::transaction(function () use ($invoice, $actor, $secret, $methods) {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            $invoice->loadMissing(['patient.person', 'patient.user', 'branch']);
            $balance = $this->billing->payableBalance($invoice); // refuses Paid, non-Issued and HMO-held invoices
            $existing = PaymentCheckoutSession::where('invoice_id', $invoice->id)->where('status', 'Open')->first();
            if ($existing && $existing->checkout_url && (string) $existing->amount === (string) $balance) {
                // Same invoice, same exact balance: the same hosted page is returned; no second payable opportunity is created.
                return ['checkout_session_id' => $existing->provider_session_id, 'checkout_url' => $existing->checkout_url, 'reference_number' => $invoice->public_id, 'amount_php' => $balance];
            }
            if ($existing) {
                // The balance changed since that session was created; it can no longer settle this invoice. The provider documents
                // no expiry for a session, so it may still be open on the provider's side (see the M11 report).
                $existing->update(['status' => 'Superseded']);
            }
            $centavos = $this->billing->centavos($balance);

        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $billing = array_filter([
            'name' => trim(($invoice->patient?->person?->first_name ?? '').' '.($invoice->patient?->person?->last_name ?? '')) ?: null,
            // Only a real address: a placeholder would send the provider's receipt e-mail to a stranger.
            'email' => $invoice->patient?->user?->email ?? $invoice->patient?->person?->email,
            'phone' => $invoice->patient?->person?->phone,
        ]);
        $attributes = [
            'line_items' => [[
                'name' => "Invoice {$invoice->invoice_number} - Dental Services",
                'amount' => $centavos, 'currency' => self::CURRENCY, 'quantity' => 1,
                'description' => "Balance payment for treatment at {$invoice->branch?->name}",
            ]],
            'payment_method_types' => $methods,
            'description' => "Invoice {$invoice->invoice_number} - Dr. Dana E. Roxas Dental Clinic",
            'reference_number' => $invoice->public_id,
            'send_email_receipt' => (bool) ($billing['email'] ?? false),
            'show_description' => true, 'show_line_items' => true,
            'success_url' => "{$frontend}/?payment=success&ref={$invoice->public_id}",
            'cancel_url' => "{$frontend}/?payment=cancelled&ref={$invoice->public_id}",
            'metadata' => ['invoice_public_id' => $invoice->public_id, 'invoice_number' => $invoice->invoice_number],
        ];
        if ($billing) {
            $attributes['billing'] = $billing;
        }

        try {
            $response = Http::withBasicAuth($secret, '')->acceptJson()->asJson()->timeout(15)->post($this->host().'/v2/checkout_sessions', ['data' => ['attributes' => $attributes]]);
        } catch (ConnectionException) {
            throw new BillingException(502, 'payment_gateway_unavailable', 'The payment provider could not be reached. No payment was started.');
        }
        if (! $response->successful()) {
            report(new \RuntimeException('PayMongo checkout creation refused with HTTP '.$response->status()));
            throw new BillingException(502, 'payment_gateway_error', 'The payment provider could not start this payment. No payment was started.');
        }
        $sessionId = $response->json('data.id');
        $checkoutUrl = $response->json('data.attributes.checkout_url');
        $reportedLive = $response->json('data.attributes.livemode');
        if (is_bool($reportedLive) && $reportedLive !== $this->live()) {
            throw new BillingException(502, 'payment_gateway_invalid_response', 'The payment provider answered for a different mode than this server is configured for. No payment was started.');
        }
        if (! is_string($sessionId) || $sessionId === '' || ! is_string($checkoutUrl) || ! str_starts_with($checkoutUrl, 'https://')) {
            throw new BillingException(502, 'payment_gateway_invalid_response', 'The payment provider returned an unusable response. No payment was started.');
        }

        PaymentCheckoutSession::create([
            'invoice_id' => $invoice->id, 'provider_session_id' => $sessionId, 'checkout_url' => $checkoutUrl, 'amount' => $balance, 'currency' => self::CURRENCY,
            'status' => 'Open', 'initiated_by_user_id' => $actor->id,
        ]);

        return ['checkout_session_id' => $sessionId, 'checkout_url' => $checkoutUrl, 'reference_number' => $invoice->public_id, 'amount_php' => $balance];
        });
    }

    // ---- webhook ----------------------------------------------------------------------------------------------------

    /**
     * Verifies the `Paymongo-Signature` header exactly as documented: `t=<timestamp>,te=<test signature>,li=<live signature>`;
     * the signed string is `<t>.<raw request body>`; HMAC-SHA256 with the endpoint's webhook secret; `te` is compared for a
     * test-mode endpoint and `li` for a live-mode endpoint (the configured mode — never anything read from the body); the
     * comparison is constant-time. It must be called with the UNMODIFIED raw body, before anything is parsed. A header that is
     * malformed, repeats a component, lacks `t`, lacks the component for this mode, or whose signature is not 64 hex characters
     * is refused. The provider documents no timestamp tolerance, so none is invented; replay is handled by event-id
     * de-duplication. A missing secret or mode fails closed.
     */
    public function verifyWebhookSignature(string $rawPayload, ?string $signatureHeader): bool
    {
        $secret = $this->webhookSecret();
        $live = $this->live();
        $header = trim((string) $signatureHeader);
        if ($header === '' || $rawPayload === '') {
            return false;
        }
        $parts = [];
        foreach (explode(',', $header) as $pair) {
            $pair = trim($pair);
            if ($pair === '' || ! str_contains($pair, '=')) {
                return false; // malformed component
            }
            [$name, $value] = explode('=', $pair, 2);
            $name = trim($name);
            if (! in_array($name, ['t', 'te', 'li'], true) || array_key_exists($name, $parts)) {
                return false; // unknown or repeated component
            }
            $parts[$name] = trim($value);
        }
        $timestamp = $parts['t'] ?? '';
        $given = $parts[$live ? 'li' : 'te'] ?? '';
        if (! preg_match('/^\d{1,20}$/', $timestamp) || ! preg_match('/^[0-9a-fA-F]{64}$/', $given)) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $timestamp.'.'.$rawPayload, $secret), strtolower($given));
    }

    /** True when the verified event's own `livemode` flag equals this endpoint's configured mode. */
    public function eventMatchesMode(array $payload): bool
    {
        return ($payload['data']['attributes']['livemode'] ?? null) === $this->live();
    }

    /**
     * Handles one signature-verified event. Returns ['http' => status, 'status' => event status, 'invoice' => public id|null].
     * 200 means "stop retrying" (settled, duplicate, ignored, or recorded for review); 503 asks the provider to retry because the
     * provider could not be asked to confirm right now.
     */
    public function handleEvent(array $payload): array
    {
        $eventId = $payload['data']['id'] ?? null;
        $type = $payload['data']['attributes']['type'] ?? null;
        if (! is_string($eventId) || $eventId === '' || strlen($eventId) > 120 || ! is_string($type) || $type === '') {
            throw new BillingException(422, 'malformed_event', 'The event is missing its identifier or type.');
        }

        $event = PaymentProviderEvent::where('provider_event_id', $eventId)->first();
        if ($event && $event->status !== 'Received') {
            return $this->outcome($event, 200); // a duplicate delivery: never act twice
        }
        if (! $event) {
            try {
                $event = PaymentProviderEvent::create([
                    'provider_event_id' => $eventId, 'event_type' => substr($type, 0, 100), 'status' => 'Received', 'received_at' => now(),
                    'provider_session_id' => is_string($payload['data']['attributes']['data']['id'] ?? null) ? substr($payload['data']['attributes']['data']['id'], 0, 120) : null,
                ]);
            } catch (UniqueConstraintViolationException) {
                $event = PaymentProviderEvent::where('provider_event_id', $eventId)->firstOrFail(); // a concurrent delivery stored it first
            }
        }

        if ($type !== self::PAID_EVENT) {
            return $this->finish($event, 'Ignored', 'event_type_not_handled', 200);
        }

        return DB::transaction(function () use ($event, $payload) {
            $event = PaymentProviderEvent::whereKey($event->id)->lockForUpdate()->firstOrFail();
            if ($event->status !== 'Received') {
                return $this->outcome($event, 200);
            }
            $session = PaymentCheckoutSession::where('provider_session_id', $event->provider_session_id)->with('invoice')->first();
            if (! $session) {
                return $this->review($event, null, 'unknown_checkout_session');
            }
            $event->invoice_id = $session->invoice_id;

            try {
                $paid = $this->confirmWithProvider($session, (array) ($payload['data']['attributes']['data']['attributes'] ?? []));
            } catch (ConnectionException) {
                return ['http' => 503, 'status' => 'Received', 'invoice' => $session->invoice->public_id]; // retry later; the event stays stored
            }
            if (is_string($paid)) {
                return $this->review($event, $session, $paid);
            }
            $event->provider_payment_id = $paid['id'];
            $event->amount_centavos = $paid['centavos'];
            $event->currency = $paid['currency'];

            if ($paid['currency'] !== self::CURRENCY || $paid['centavos'] !== $this->billing->centavos((string) $session->amount)) {
                return $this->review($event, $session, 'amount_mismatch');
            }

            try {
                $settled = $this->billing->payOnline($session->invoice, 'PayMongo ('.(self::METHOD_LABELS[$paid['method']] ?? 'ONLINE').')', $paid['id'], $session->initiatedBy()->firstOrFail(), (string) $session->amount);
            } catch (BillingException $e) {
                // The provider captured funds the invoice can no longer take: keep the event, flag it, never drop it.
                return $this->review($event, $session, $e->getCode(), $e->getCode() === 'already_paid' ? 'Duplicate' : 'Needs review');
            }
            $session->update(['status' => 'Settled']);

            return $this->finish($event, 'Settled', null, 200, $settled->public_id);
        }, 3);
    }

    /**
     * Asks the provider directly (server to server, with the secret key) what it captured for this session, so the settlement
     * never rests on the contents of an inbound request. The session read back must be in this endpoint's mode, carry OUR invoice
     * reference, and hold a paid payment with an id, an integer amount and a currency; when the event itself names a payment or a
     * reference it must agree. Returns the paid payment, or a review reason string; throws ConnectionException when the provider
     * cannot be asked (the provider then retries the event).
     *
     * @return array{id:string,centavos:int,currency:string,method:string}|string
     */
    private function confirmWithProvider(PaymentCheckoutSession $session, array $eventSession): array|string
    {
        $response = Http::withBasicAuth($this->secretKey(), '')->acceptJson()->timeout(10)->get($this->host().'/v1/checkout_sessions/'.rawurlencode($session->provider_session_id));
        if ($response->serverError() || $response->status() === 429) {
            throw new ConnectionException('provider temporarily unavailable');
        }
        if (! $response->successful()) {
            return 'provider_confirmation_refused';
        }
        if (($response->json('data.attributes.livemode')) !== $this->live()) {
            return 'livemode_mismatch';
        }
        $invoicePublicId = $session->invoice->public_id;
        if ($response->json('data.attributes.reference_number') !== $invoicePublicId
            || (isset($eventSession['reference_number']) && $eventSession['reference_number'] !== $invoicePublicId)) {
            return 'reference_mismatch';
        }
        $payments = $response->json('data.attributes.payments');
        if (! is_array($payments)) {
            return 'provider_reports_no_payment';
        }
        foreach ($payments as $payment) {
            $attributes = $payment['attributes'] ?? [];
            if (($attributes['status'] ?? null) !== 'paid') {
                continue;
            }
            $id = $payment['id'] ?? null;
            $amount = $attributes['amount'] ?? null;
            $currency = $attributes['currency'] ?? null;
            if (! is_string($id) || $id === '' || ! (is_int($amount) || (is_string($amount) && ctype_digit($amount))) || ! is_string($currency) || $currency === '') {
                return 'unverifiable_payment';
            }
            // If the event names payments, the paid payment it reports must be the same one the provider reports.
            foreach ((array) ($eventSession['payments'] ?? []) as $eventPayment) {
                if (($eventPayment['attributes']['status'] ?? null) === 'paid' && ($eventPayment['id'] ?? $id) !== $id) {
                    return 'event_provider_payment_disagree';
                }
            }

            return ['id' => $id, 'centavos' => (int) $amount, 'currency' => strtoupper($currency), 'method' => (string) ($attributes['source']['type'] ?? '')];
        }

        return 'provider_reports_not_paid';
    }

    private function review(PaymentProviderEvent $event, ?PaymentCheckoutSession $session, string $reason, string $status = 'Needs review'): array
    {
        $this->audit->record([
            'action' => 'billing.provider_payment_unreconciled', 'category' => 'financial', 'severity' => 'critical', 'actor' => null, 'actor_name' => 'Payment provider event',
            'actor_role' => 'system', 'target' => $session?->invoice, 'branch_id' => $session?->invoice?->branch_id,
            // The captured payment is on record and needs a person: identifiers, a reason and a decimal-safe amount only.
            'payload' => ['reason' => $reason, 'status' => $status, 'provider_event_id' => $event->provider_event_id, 'provider_payment_id' => $event->provider_payment_id,
                'amount' => $event->amount_centavos === null ? null : number_format($event->amount_centavos / 100, 2, '.', '')],
        ]);

        return $this->finish($event, $status, $reason, 200, $session?->invoice?->public_id);
    }

    private function finish(PaymentProviderEvent $event, string $status, ?string $reason, int $http, ?string $invoicePublicId = null): array
    {
        $event->forceFill(['status' => $status, 'reason' => $reason, 'processed_at' => now()])->save();

        return ['http' => $http, 'status' => $status, 'invoice' => $invoicePublicId ?? $event->invoice?->public_id];
    }

    private function outcome(PaymentProviderEvent $event, int $http): array
    {
        return ['http' => $http, 'status' => $event->status, 'invoice' => $event->invoice?->public_id];
    }
}
