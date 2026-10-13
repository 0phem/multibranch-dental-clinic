<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\SecurityNoticeMail;
use App\Models\EmailVerificationOtp;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Services\Auth\OneTimeCodes;
use App\Services\Auth\OtpThrottle;
use App\Services\Mail\MailDispatcher;
use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

/**
 * M1 password reset by emailed one-time code, for every role (Patient, Staff, Dentist, Owner) with an Active account.
 * Invited employees finish through their invitation link instead; suspended or deleted accounts get no code.
 *
 *  forgot — always the same answer whether or not the address has an account (no enumeration). An eligible account gets a
 *           code (same rules as registration: hashed, 10 minutes, 5 tries, single use, newest replaces older).
 *  reset  — a correct code sets the new password, verifies the email (the code proves control of it), signs every session
 *           out (auth_version) and queues a "your password was changed" notice. Wrong codes count toward the 5-try limit.
 */
class PasswordResetController extends Controller
{
    public function __construct(private readonly OneTimeCodes $codes, private readonly AuditService $audit) {}

    public function forgot(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255']]);
        $email = strtolower(trim($data['email']));
        if ($wait = app(OtpThrottle::class)->hit($email, (string) $request->ip())) return OtpThrottle::limited($wait);

        DB::transaction(function () use ($email) {
            $user = User::where('email', $email)->lockForUpdate()->first();
            if (! $user || $user->account_status !== 'Active') return;
            // Inside the 60-second wait the earlier code stays valid; answering differently would reveal the account.
            if ($this->codes->cooldown($user, EmailVerificationOtp::PASSWORD_RESET)) return;
            $this->codes->issue($user->load('person'), EmailVerificationOtp::PASSWORD_RESET, $user->email);
            $this->audit->recordAuth('auth.password_reset_requested', $user);
        });

        return response()->json([
            'message' => 'If an account uses this email, we sent it a code to reset the password.',
            'data' => ['resend_available_at' => now()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString()],
        ]);
    }

    public function reset(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'otp' => ['required', 'digits:6'],
            'password' => ['required', 'string', new \App\Rules\PasswordInput(), 'max:72', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);
        $email = strtolower(trim($data['email']));

        $result = DB::transaction(function () use ($email, $data) {
            $user = User::where('email', $email)->lockForUpdate()->first();
            if (! $user || $user->account_status !== 'Active') {
                Hash::check($data['otp'], '$2y$12$H5ntb6FLY.qFGr/Rba08b.Dt0raoSs2QEEhzAIt5grrYJ3L8/f/q2'); // same work as a real check

                return ['failure' => ['invalid_otp', 'That code is not valid.']];
            }
            $check = $this->codes->check($user, EmailVerificationOtp::PASSWORD_RESET, $data['otp']);
            if (isset($check['failure'])) return $check;

            // A reset may follow a compromise: any pending email-change code is cancelled too.
            EmailVerificationOtp::where('user_id', $user->id)->where('purpose', EmailVerificationOtp::EMAIL_CHANGE)->whereNull('consumed_at')->update(['consumed_at' => now()]);
            $user->forceFill(['password' => Hash::make($data['password']), 'email_verified_at' => $user->email_verified_at ?? now()])->save();
            $this->audit->recordAuth('auth.password_reset_completed', $user);
            app(MailDispatcher::class)->queueOnce($user->email, new SecurityNoticeMail('password_changed', $user->person?->first_name, ClinicClock::now()->format('F j, Y g:i A')), 'password_changed_notice', $user);

            return ['ok' => true];
        });

        if (isset($result['failure'])) return OneTimeCodes::failure(...$result['failure']);

        return response()->json(['message' => 'Your password was reset. Sign in with your new password.']);
    }
}
