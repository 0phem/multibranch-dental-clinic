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

class PayMongoController extends Controller
{
    public function __construct(private readonly PayMongoService $payMongoService)
    {
    }

    /**
     * Initiate a PayMongo checkout session for an issued invoice.
     * POST /api/invoices/{invoice}/paymongo-checkout
     */
    public function checkout(Request $request, Invoice $invoice): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Authorization check: Patient must own invoice; Staff must be scoped to branch; Owner allowed
        if ($user->role === Role::Patient) {
            $patient = $user->patient;
            if (!$patient || $patient->id !== $invoice->patient_id) {
                return response()->json(['message' => 'You are not authorized to pay for this invoice.'], 403);
            }
        } elseif ($user->role === Role::Staff) {
            $hasScope = UserBranchScope::where('user_id', $user->id)
                ->where('branch_id', $invoice->branch_id)
                ->exists();
            if (!$hasScope) {
                return response()->json(['message' => 'Staff branch authorization is required.'], 403);
            }
        } elseif ($user->role !== Role::Owner) {
            return response()->json(['message' => 'Unauthorized role.'], 403);
        }

        $validated = $request->validate([
            'success_url' => ['nullable', 'url'],
            'cancel_url' => ['nullable', 'url'],
        ]);

        $frontendUrl = rtrim((string)config('app.frontend_url', 'http://localhost:5173'), '/');
        $successUrl = $validated['success_url'] ?? "{$frontendUrl}/patient/billing?payment=success&ref={$invoice->public_id}";
        $cancelUrl = $validated['cancel_url'] ?? "{$frontendUrl}/patient/billing?payment=cancelled&ref={$invoice->public_id}";

        try {
            $result = $this->payMongoService->createCheckoutSession($invoice, $successUrl, $cancelUrl);
            return response()->json(['data' => $result]);
        } catch (BillingException $e) {
            return response()->json($e->responseBody(), $e->getStatusCode());
        }
    }

    /**
     * Public PayMongo Webhook receiver.
     * POST /api/webhooks/paymongo
     */
    public function webhook(Request $request): JsonResponse
    {
        $rawPayload = $request->getContent();
        $signatureHeader = $request->header('Paymongo-Signature');

        $isValid = $this->payMongoService->verifyWebhookSignature($rawPayload, $signatureHeader);
        if (!$isValid) {
            return response()->json(['message' => 'Invalid or missing webhook signature.'], 400);
        }

        try {
            $result = $this->payMongoService->processWebhook($request->all());
            return response()->json([
                'received' => true,
                'data' => $result,
            ]);
        } catch (BillingException $e) {
            return response()->json([
                'received' => false,
                'code' => $e->getCode(),
                'message' => $e->getMessage(),
            ], $e->getStatusCode());
        } catch (\Throwable $e) {
            return response()->json([
                'received' => false,
                'message' => 'Failed to process PayMongo webhook: ' . $e->getMessage(),
            ], 500);
        }
    }
}
