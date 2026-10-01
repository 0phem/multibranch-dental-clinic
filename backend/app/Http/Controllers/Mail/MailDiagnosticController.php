<?php

namespace App\Http\Controllers\Mail;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Mail\ClinicTestMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class MailDiagnosticController extends Controller
{
    public function sendTest(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== Role::Owner) {
            return response()->json(['message' => 'Only clinic owners can run mail delivery diagnostics.'], 403);
        }

        $validated = $request->validate([
            'recipient_email' => ['nullable', 'email'],
        ]);

        $recipient = $validated['recipient_email'] ?? $user->email;

        try {
            Mail::to($recipient)->send(new ClinicTestMail());

            return response()->json([
                'ok' => true,
                'message' => "Test email successfully dispatched to {$recipient} using transport driver '" . config('mail.default') . "'.",
                'driver' => config('mail.default'),
                'recipient' => $recipient,
                'sent_at' => now()->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Failed to dispatch test email: ' . $e->getMessage(),
                'driver' => config('mail.default'),
            ], 500);
        }
    }
}
