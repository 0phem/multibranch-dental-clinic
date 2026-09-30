<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Mail\PatientEmailVerificationOtp;
use App\Models\EmailVerificationOtp;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

class EmailVerificationController extends Controller
{
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
            if (! $user) return ['failure' => ['invalid_otp', 'That verification code is not valid.']];
            if ($user->email_verified_at) return ['failure' => ['already_verified', 'This email address is already verified.']];

            $otp = EmailVerificationOtp::where('user_id', $user->id)
                ->whereNull('consumed_at')
                ->latest('id')
                ->lockForUpdate()
                ->first();
            if (! $otp || $otp->expires_at->isPast()) return ['failure' => ['otp_expired', 'That code has expired. Request a new code.']];
            if ($otp->attempts >= 5) return ['failure' => ['otp_attempt_limit', 'Too many incorrect attempts. Request a new code.']];

            if (! Hash::check($data['otp'], $otp->digest)) {
                $otp->attempts++;
                if ($otp->attempts >= 5) {
                    $otp->consumed_at = now();
                    $otp->save();
                    return ['failure' => ['otp_attempt_limit', 'Too many incorrect attempts. Request a new code.']];
                }
                $otp->save();
                return ['failure' => ['invalid_otp', 'That verification code is not valid.']];
            }

            $now = now();
            $user->forceFill(['email_verified_at' => $now])->save();
            $otp->forceFill(['consumed_at' => $now])->save();
            return ['user' => $user];
        });

        if (isset($result['failure'])) return $this->failure(...$result['failure']);
        $user = $result['user'];
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return response()->json(['data' => new UserResource($user->load(['person', 'patient']))]);
    }

    public function resend(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255']]);
        $email = strtolower(trim($data['email']));
        $key = 'email-otp-resend:'.sha1($email.'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json([
                'message' => 'Too many resend requests. Please try again later.',
                'code' => 'otp_rate_limited',
                'retry_after' => RateLimiter::availableIn($key),
            ], 429);
        }
        RateLimiter::hit($key, 3600);

        $result = DB::transaction(function () use ($email) {
            // The user row is the per-account mutex: concurrent resends cannot both observe the same
            // previous OTP as usable and commit two new usable rows.
            $user = User::where('email', $email)
                ->where('role', Role::Patient->value)
                ->lockForUpdate()
                ->first();
            if (! $user || $user->email_verified_at) return ['generic' => true];

            $latest = EmailVerificationOtp::where('user_id', $user->id)->latest('id')->lockForUpdate()->first();
            if ($latest && $latest->sent_at->gt(now()->subSeconds(60))) {
                return ['cooldown' => max(1, $latest->sent_at->copy()->addSeconds(60)->diffInSeconds(now()))];
            }

            $code = (string) random_int(100000, 999999);
            $now = now();
            EmailVerificationOtp::where('user_id', $user->id)->whereNull('consumed_at')->update(['consumed_at' => $now]);
            EmailVerificationOtp::create([
                'user_id' => $user->id,
                'digest' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => $now->copy()->addMinutes(10),
                'sent_at' => $now,
            ]);
            return ['user' => $user, 'code' => $code, 'sent_at' => $now];
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

        try {
            Mail::to($result['user']->email)->send(new PatientEmailVerificationOtp($result['code']));
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['message' => 'We could not send the verification email. Please try again.', 'code' => 'email_delivery_failed'], 503);
        }

        return response()->json(['data' => [
            'email' => $result['user']->email,
            'verification_required' => true,
            'resend_available_at' => $result['sent_at']->copy()->addSeconds(60)->toISOString(),
        ]]);
    }

    private function failure(string $code, string $message)
    {
        return response()->json(['message' => $message, 'errors' => ['otp' => [$message]], 'code' => $code], 422);
    }
}
