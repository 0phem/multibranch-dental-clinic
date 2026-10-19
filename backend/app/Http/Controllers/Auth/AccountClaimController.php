<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\EmailVerificationOtp;
use App\Models\Person;
use App\Models\User;
use App\Services\Auth\OneTimeCodes;
use App\Services\Auth\OtpThrottle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Claim an online account for a record the clinic already has (registered at the counter without an email, or a dependent who
 * turned 18 and was invited).
 *
 *  1. store():  email + birth date. When they match a record without an account, a 6-digit code is emailed. No password is
 *               taken here: an unverified claim holds only an unusable random password, so nobody can pre-set it.
 *  2. verify(): the emailed code TOGETHER with the new password. Only the person who reads the code sets the password; the
 *               account becomes active and any guardian's access ends.
 *
 * Every request gets the same answer, so nobody can learn whether an email or birth date is on file.
 */
class AccountClaimController extends Controller
{
    private const GENERIC_FAILURE = ['invalid_otp', 'That code is not valid or has expired. Request a new code.'];

    public function store(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255'], 'date_of_birth' => ['required', 'date_format:Y-m-d'],
            'password' => ['prohibited']]);
        $email = Str::lower(trim($data['email']));
        if ($wait = app(OtpThrottle::class)->hit($email, (string) $request->ip())) return OtpThrottle::limited($wait);

        DB::transaction(function () use ($email, $data) {
            $person = Person::whereRaw('lower(email) = ?', [$email])->where('date_of_birth', $data['date_of_birth'])->with(['patient', 'user'])->lockForUpdate()->first();
            if (! $person?->patient) return;
            $user = $person->user;
            if ($user && ($user->email_verified_at || $user->trashed() || $user->email !== $email)) return; // already has an account
            if (! $user) {
                if (User::withTrashed()->where('email', $email)->exists()) return;
                $user = User::create(['person_id' => $person->id, 'email' => $email, 'password' => Hash::make(Str::random(48)), 'role' => Role::Patient, 'account_status' => 'Active']);
                app(\App\Services\Audit\AuditService::class)->recordAuth('account.claim_started', $user);
            }
            // Within the resend cooldown the code already sent stays valid (no flood of codes to the inbox).
            if (app(OneTimeCodes::class)->cooldown($user, EmailVerificationOtp::REGISTRATION) > 0) return;
            app(OneTimeCodes::class)->issue($user->setRelation('person', $person), EmailVerificationOtp::REGISTRATION, $email);
        });

        return response()->json(['data' => ['email' => $email, 'code_sent_if_matched' => true,
            'resend_available_at' => now()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString()]], 201);
    }

    public function verify(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255'], 'otp' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'max:72', 'confirmed', Password::min(8)->letters()->numbers()]]);
        $email = Str::lower(trim($data['email']));
        $result = DB::transaction(function () use ($email, $data) {
            $user = User::where('email', $email)->where('role', Role::Patient->value)->lockForUpdate()->first();
            if (! $user || $user->account_status !== 'Active' || $user->email_verified_at) {
                Hash::check($data['otp'], '$2y$12$H5ntb6FLY.qFGr/Rba08b.Dt0raoSs2QEEhzAIt5grrYJ3L8/f/q2');

                return ['failure' => self::GENERIC_FAILURE];
            }
            $check = app(OneTimeCodes::class)->check($user, EmailVerificationOtp::REGISTRATION, $data['otp']);
            if (isset($check['failure'])) return ['failure' => self::GENERIC_FAILURE];
            $user->forceFill(['password' => Hash::make($data['password']), 'email_verified_at' => now()])->save();
            app(\App\Services\Audit\AuditService::class)->recordAuth('account.claimed', $user);
            \App\Services\Intake\Guardianship::onOwnAccountVerified($user);

            return ['user' => $user];
        });
        if (isset($result['failure'])) return OneTimeCodes::failure(...$result['failure']);

        return response()->json(['message' => 'Your account is ready. Please sign in.', 'data' => ['email' => $result['user']->email, 'verified' => true]]);
    }
}
