<?php

namespace App\Http\Controllers\Payment;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\UserBranchScope;
use App\Services\Billing\BillingException;
use App\Services\Payment\PayMongoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Online payment endpoints (M11). Initiation: the Patient who owns the invoice, or Staff within the invoice's authorization branch
// scope; the Owner and Dentist have no payment initiation. The webhook never trusts its caller: it needs a valid signature over the
// raw body, and what it can do is decided by PayMongoService (session binding, provider confirmation, exact amount).
class PayMongoController extends Controller
{
    private const FORBIDDEN_BODY = [
        'success_url', 'cancel_url', 'amount', 'amount_php', 'currency', 'status', 'paid_amount', 'settlement_type', 'provider_status',
        'provider_transaction_id', 'checkout_session_id', 'checkout_url', 'patient_id', 'branch_id', 'invoice_id', 'created_by', 'paid_by',
    ];

    public function __construct(private readonly PayMongoService $payMongoService) {}

    /** POST /api/invoices/{invoice}/paymongo-checkout */
    public function checkout(Request $request, Invoice $invoice): JsonResponse
    {
        $user = $request->user();
        $allowed = match ($user->role) {
            Role::Patient => $user->patient !== null && $user->patient->id === $invoice->patient_id,
            Role::Staff => UserBranchScope::where('user_id', $user->id)->where('branch_id', $invoice->branch_id)->exists(),
            default => false, // Owner and Dentist: no payment initiation
        };
        if (! $allowed) {
            return response()->json(['message' => 'You are not authorized to pay for this invoice.'], 403);
        }
        // The return URLs and every money field are chosen by the server; supplying one is refused, not ignored.
        $request->validate(array_fill_keys(self::FORBIDDEN_BODY, ['prohibited']));

        try {
            return response()->json(['data' => $this->payMongoService->createCheckoutSession($invoice, $user)]);
        } catch (BillingException $e) {
            return response()->json($e->responseBody(), $e->getStatusCode());
        }
    }

    /** POST /api/webhooks/paymongo — public; signature-verified. */
    public function webhook(Request $request): JsonResponse
    {
        try {
            if (! $this->payMongoService->verifyWebhookSignature($request->getContent(), $request->header('Paymongo-Signature'))) {
                return response()->json(['message' => 'Invalid or missing webhook signature.'], 400);
            }
            $payload = json_decode($request->getContent(), true);
            if (! is_array($payload)) {
                return response()->json(['message' => 'Malformed event.'], 400);
            }
            if (! $this->payMongoService->eventMatchesMode($payload)) {
                // A correctly signed event for the other mode (test vs live) is never processed by this endpoint.
                return response()->json(['message' => 'Event mode does not match this endpoint.'], 400);
            }
            $result = $this->payMongoService->handleEvent($payload);

            return response()->json(['received' => $result['http'] < 300, 'status' => $result['status']], $result['http']);
        } catch (BillingException $e) {
            // 503 (not configured) must be visible to the operator and retried by the provider; other refusals are permanent.
            return response()->json(['received' => false, 'code' => $e->getCode(), 'message' => $e->getMessage()], $e->getStatusCode());
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['received' => false, 'message' => 'The event could not be processed. It will be retried.'], 500);
        }
    }
}
