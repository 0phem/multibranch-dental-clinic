<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request)
    {
        $email = strtolower(trim((string) $request->input('email')));
        $user = User::where('email', $email)->first();

        // One generic failure for unknown email or wrong password — never discloses which (anti-enumeration).
        // Inactive-account rejection is a distinct, explicit condition.
        if (! $user || ! Hash::check((string) $request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        if ($user->account_status !== 'Active') {
            throw ValidationException::withMessages([
                'email' => 'This account is inactive. Contact the clinic for help.',
            ]);
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
}
