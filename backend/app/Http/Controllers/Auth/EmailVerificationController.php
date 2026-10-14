<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\EmailVerificationOtp;
use App\Models\User;
use App\Services\Auth\OneTimeCodes;
use App\Services\Auth\OtpThrottle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class EmailVerificationController extends Controller
{
    private const GENERIC_FAILURE = ['invalid_otp', 'That code is not valid or has expired. Request a new code if you need one.'];

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
            // Unknown, inactive, already verified, wrong, expired and used-up codes all get ONE answer (and the same bcrypt work), so
            // this endpoint cannot be used to learn whether an address is registered. Wrong codes still count toward the 5-try limit.
            if (! $user || $user->account_status !== 'Active' || $user->email_verified_at) {
                Hash::check($data['otp'], '$2y$12$H5ntb6FLY.qFGr/Rba08b.Dt0raoSs2QEEhzAIt5grrYJ3L8/f/q2');

                return ['failure' => self::GENERIC_FAILURE];
            }

            $check = $this->codes->check($user, EmailVerificationOtp::REGISTRATION, $data['otp']);
            if (isset($check['failure'])) return ['failure' => self::GENERIC_FAILURE];

            $user->forceFill(['email_verified_at' => now()])->save();
            app(\App\Services\Audit\AuditService::class)->recordAuth('account.email_verified', $user);
            return ['user' => $user];
        });

        if (isset($result['failure'])) return OneTimeCodes::failure(...$result['failure']);
        // Decision 1: verifying the email does NOT sign the Patient in. They sign in with their password next (the portal shows
        // the sign-in page with the email filled in), so a stolen or forwarded code alone never opens an account.
        return response()->json(['message' => 'Your account is verified. Please sign in.', 'data' => ['email' => $result['user']->email, 'verified' => true]]);
    }

    public function resend(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255']]);
        $email = strtolower(trim($data['email']));
        if ($wait = app(OtpThrottle::class)->hit($email, (string) $request->ip())) return OtpThrottle::limited($wait);

        DB::transaction(function () use ($email) {
            // The user row is the per-account mutex: concurrent resends cannot both observe the same
            // previous OTP as usable and commit two new usable rows.
            $user = User::where('email', $email)
                ->where('role', Role::Patient->value)
                ->lockForUpdate()
                ->first();
            if (! $user || $user->account_status !== 'Active' || $user->email_verified_at) return;
            // Inside the 60-second wait the earlier code stays valid; a different answer here would reveal the account.
            if ($this->codes->cooldown($user, EmailVerificationOtp::REGISTRATION)) return;
            $this->codes->issue($user->load('person'), EmailVerificationOtp::REGISTRATION, $user->email);
        });

        // One answer for every address (registered or not, verified or not, inside the wait or not).
        return response()->json([
            'message' => 'If this email is waiting for verification, we sent it a new code.',
            'data' => ['verification_required' => true, 'resend_available_at' => now()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString()],
        ]);
    }
}
