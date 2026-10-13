<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\EmailVerificationOtp;
use App\Models\User;
use App\Services\Auth\OneTimeCodes;
use App\Services\Auth\OtpThrottle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class EmailVerificationController extends Controller
{
    public function __construct(private readonly OneTimeCodes $codes) {}

    public function verify(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'otp' => ['required', 'digits:6'],
        ]);
        $email = strtolower(trim($data['email']));

        $result = DB::transaction(function () use ($email, $data) {
            // Serialize verification with resend and with another verification attempt for this account.
            $user = User::where('email', $email)
                ->where('role', Role::Patient->value)
                ->lockForUpdate()
                ->first();
            if (! $user || $user->account_status !== 'Active') return ['failure' => ['invalid_otp', 'That code is not valid.']];
            if ($user->email_verified_at) return ['failure' => ['already_verified', 'This email address is already verified.']];

            $check = $this->codes->check($user, EmailVerificationOtp::REGISTRATION, $data['otp']);
            if (isset($check['failure'])) return $check;

            $user->forceFill(['email_verified_at' => now()])->save();
            app(\App\Services\Audit\AuditService::class)->recordAuth('account.email_verified', $user);
            return ['user' => $user];
        });

        if (isset($result['failure'])) return OneTimeCodes::failure(...$result['failure']);
        $user = $result['user'];
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put('auth_version', (int) $user->auth_version);

        return response()->json(['data' => new UserResource($user->load(['person', 'patient']))]);
    }

    public function resend(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255']]);
        $email = strtolower(trim($data['email']));
        if ($wait = app(OtpThrottle::class)->hit($email, (string) $request->ip())) return OtpThrottle::limited($wait);

        $result = DB::transaction(function () use ($email) {
            // The user row is the per-account mutex: concurrent resends cannot both observe the same
            // previous OTP as usable and commit two new usable rows.
            $user = User::where('email', $email)
                ->where('role', Role::Patient->value)
                ->lockForUpdate()
                ->first();
            if (! $user || $user->account_status !== 'Active' || $user->email_verified_at) return ['generic' => true];

            if ($wait = $this->codes->cooldown($user, EmailVerificationOtp::REGISTRATION)) return ['cooldown' => $wait];
            $otp = $this->codes->issue($user->load('person'), EmailVerificationOtp::REGISTRATION, $user->email);
            return ['user' => $user, 'sent_at' => $otp->sent_at];
        });

        if (! empty($result['generic'])) {
            return response()->json(['message' => 'If this account can be verified, a new code can be requested.', 'data' => ['verification_required' => true]]);
        }
        if (isset($result['cooldown'])) {
            return response()->json([
                'message' => 'Please wait before requesting another code.',
                'code' => 'otp_resend_cooldown',
                'retry_after' => $result['cooldown'],
            ], 429);
        }

        return response()->json(['data' => [
            'email' => $result['user']->email,
            'verification_required' => true,
            'resend_available_at' => $result['sent_at']->copy()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString(),
        ]]);
    }
}
