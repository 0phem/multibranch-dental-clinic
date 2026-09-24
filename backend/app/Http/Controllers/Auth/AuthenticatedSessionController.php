<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request)
    {
        $email = strtolower(trim((string) $request->input('email')));
        $user = User::where('email', $email)->first();

        // One generic failure for unknown email or wrong password — never discloses which (anti-enumeration).
        // Inactive-account rejection is a distinct, explicit condition. Both keep Laravel's normal 422
        // {message, errors} validation shape, plus a machine-readable `code` (Backend Foundation 1B) so the
        // frontend can tell the two cases apart without string-matching the human-readable message.
        if (! $user || ! Hash::check((string) $request->input('password'), $user->password)) {
            return $this->credentialFailure('invalid_credentials', 'These credentials do not match our records.');
        }

        if ($user->account_status !== 'Active') {
            return $this->credentialFailure('inactive_account', 'This account is inactive. Contact the clinic for help.');
        }

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'data' => new UserResource($user->load(['person', 'patient'])),
        ]);
    }

    public function destroy(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    // A manually-built 422 in Laravel's normal validation-error shape ({message, errors}), plus a stable
    // `code` the frontend can switch on. Deliberately not a thrown ValidationException: that response has no
    // room for the extra `code` key without a custom exception-render hook, and this keeps the intent local
    // and obvious.
    private function credentialFailure(string $code, string $message)
    {
        return response()->json([
            'message' => $message,
            'errors' => ['email' => [$message]],
            'code' => $code,
        ], 422);
    }
}
