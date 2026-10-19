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
 * turned 18 and was invited). The email and birth date must match the record, which must have no account yet; then an
 * unverified account is made and the usual 6-digit email code is sent (the same /register/verify step). Every request gets the
 * same answer, so nobody can learn whether an email or birth date is on file. Verifying ends any guardian's access. An unverified
 * account cannot sign in, and a later claim replaces an earlier unverified one's password (the emailed code decides who wins).
 */
class AccountClaimController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255'], 'date_of_birth' => ['required', 'date_format:Y-m-d'],
            'password' => ['required', 'string', 'max:72', 'confirmed', Password::min(8)->letters()->numbers()]]);
        $email = Str::lower(trim($data['email']));
        if ($wait = app(OtpThrottle::class)->hit($email, (string) $request->ip())) return OtpThrottle::limited($wait);

        DB::transaction(function () use ($email, $data) {
            $person = Person::whereRaw('lower(email) = ?', [$email])->where('date_of_birth', $data['date_of_birth'])->with(['patient', 'user'])->lockForUpdate()->first();
            // A claim that was started but never verified does not lock the record to its first submitter: the newest claim
            // replaces the password and gets a fresh code, so only the person who can read the emailed code activates it.
            $pending = $person?->user;
            if ($person?->patient && $pending && ! $pending->email_verified_at && ! $pending->trashed() && $pending->email === $email) {
                $pending->forceFill(['password' => Hash::make($data['password'])])->save();
                app(\App\Services\Audit\AuditService::class)->recordAuth('account.claim_restarted', $pending);
                app(OneTimeCodes::class)->issue($pending->setRelation('person', $person), EmailVerificationOtp::REGISTRATION, $email);

                return;
            }
            if (! $person?->patient || $person->user || User::withTrashed()->where('email', $email)->exists()) {
                Hash::make($data['password']); // the same work as a real claim

                return;
            }
            $user = User::create(['person_id' => $person->id, 'email' => $email, 'password' => Hash::make($data['password']), 'role' => Role::Patient, 'account_status' => 'Active']);
            app(\App\Services\Audit\AuditService::class)->recordAuth('account.claimed', $user);
            app(OneTimeCodes::class)->issue($user->setRelation('person', $person), EmailVerificationOtp::REGISTRATION, $email);
        });

        return response()->json(['data' => ['email' => $email, 'verification_required' => true,
            'resend_available_at' => now()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString()]], 201);
    }
}
