<?php

namespace App\Http\Controllers\Mail;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Mail\ClinicTestMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\Mail\MailDispatcher;

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

        // M18 (TD-25): report only what is known. A log/array mailer sends nothing; a real transport's acceptance is not
        // proof of inbox delivery.
        $result = app(MailDispatcher::class)->send($recipient, new ClinicTestMail(), 'mail_diagnostic', $user);

        return response()->json([
            'ok' => $result['status'] !== 'failed',
            'status' => $result['status'],
            'message' => $result['message'],
            'driver' => $result['mailer'],
            'transport_kind' => $result['transport_kind'],
            'recipient' => $recipient,
            'attempted_at' => now()->toIso8601String(),
        ], $result['status'] === 'failed' ? 502 : 200);
    }
}
