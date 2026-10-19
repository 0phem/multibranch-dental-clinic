<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\EmailVerificationOtp;
use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Services\Auth\OneTimeCodes;
use App\Services\Auth\OtpThrottle;
use App\Services\Intake\AccountClaims;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Claim an online account for a record the clinic already has.
 *
 *  1. store(), either
 *       - self-service: email + birth date. Only a record whose STORED email is that email (and whose birth date matches) can
 *         be claimed; the code goes to that stored email. A record without an email never matches; or
 *       - a one-time link issued by staff (after an in-person ID check, with the email they confirmed) or by a guardian for an
 *         adult dependent: the code goes to the email on the link.
 *     No password is taken here. A new claim account holds an unusable random password and `pending_claim`, so sign-up
 *     verification, resend and password reset refuse it.
 *  2. verify(): the emailed code TOGETHER with the new password; only the person who reads the code sets it. 5 tries per code.
 *
 * Self-service answers are identical in body, status and work (two bcrypt hashes) whether or not anything matched, and the
 * per-email, per-record and cooldown limits are silent. Audited: started, completed, blocked (never a code, a password or a
 * birth date).
 */
class AccountClaimController extends Controller
{
    private const GENERIC_FAILURE = ['invalid_otp', 'That code is not valid or has expired. Request a new code.'];

    private const PER_RECORD_PER_HOUR = 5;

    public function store(Request $request)
    {
        $data = $request->validate(['email' => ['required_without:token', 'nullable', 'email:rfc', 'max:255'], 'date_of_birth' => ['required_without:token', 'nullable', 'date_format:Y-m-d'],
            'token' => ['nullable', 'string', 'max:64'], 'password' => ['prohibited']]);

        if (! empty($data['token'])) return $this->storeWithLink($request, $data['token']);

        $email = Str::lower(trim($data['email']));
        if ($wait = app(OtpThrottle::class)->hit($email, (string) $request->ip())) return OtpThrottle::limited($wait); // per email and per email+IP, same for everyone
        $hashed = DB::transaction(function () use ($email, $data) {
            // Only the email stored on the record: a claimant cannot have the code sent anywhere else.
            $person = Person::whereRaw('lower(email) = ?', [$email])->where('date_of_birth', $data['date_of_birth'])->with(['patient', 'user'])->lockForUpdate()->first();

            return $person?->patient ? $this->startClaim($person, $email, 'self_service') : 0;
        });
        $this->burn(2 - $hashed); // the same bcrypt work on every path

        return response()->json(['data' => ['email' => $email, 'code_sent_if_matched' => true,
            'resend_available_at' => now()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString()]], 201);
    }

    private function storeWithLink(Request $request, string $token)
    {
        [$invite, $problem] = AccountClaims::resolve($token);
        if ($problem) {
            if ($invite) app(AuditService::class)->record(['action' => 'account.claim_blocked', 'category' => 'security', 'severity' => 'warning', 'actor' => null,
                'target' => Patient::find($invite->patient_id), 'payload' => ['reason' => 'link_'.$problem]]);

            return response()->json(['message' => 'This link is not valid any more. Ask the clinic for a new one.', 'code' => 'claim_link_invalid', 'errors' => ['token' => ['This link is not valid any more. Ask the clinic for a new one.']]], 422);
        }
        if ($wait = app(OtpThrottle::class)->hit($invite->email, (string) $request->ip())) return OtpThrottle::limited($wait);
        DB::transaction(function () use ($invite) {
            $person = Patient::with(['person.user'])->findOrFail($invite->patient_id)->person;
            $person = Person::whereKey($person->id)->with(['patient', 'user'])->lockForUpdate()->first();
            if (Str::lower((string) $person->email) === $invite->email) $this->startClaim($person, $invite->email, 'link');
        });

        return response()->json(['data' => ['email' => self::mask($invite->email), 'code_sent' => true,
            'resend_available_at' => now()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString()]], 201);
    }

    /** Creates (or reuses) the pending claim account and sends a code, within the limits. Returns the bcrypt hashes done. */
    private function startClaim(Person $person, string $email, string $channel): int
    {
        $user = $person->user;
        if ($user && ($user->email_verified_at || $user->trashed() || ! $user->pending_claim || $user->email !== $email)) return 0; // already an account
        $recordKey = 'claim-record:'.$person->id;
        if (RateLimiter::tooManyAttempts($recordKey, self::PER_RECORD_PER_HOUR)) {
            app(AuditService::class)->record(['action' => 'account.claim_blocked', 'category' => 'security', 'severity' => 'warning', 'actor' => null, 'target' => $person->patient, 'payload' => ['reason' => 'record_limit']]);

            return 0;
        }
        RateLimiter::hit($recordKey, 3600);
        $hashes = 0;
        if (! $user) {
            if (User::withTrashed()->where('email', $email)->exists()) return 0;
            $user = User::create(['person_id' => $person->id, 'email' => $email, 'password' => Hash::make(Str::random(48)), 'role' => Role::Patient, 'account_status' => 'Active']);
            $user->forceFill(['pending_claim' => true])->save();
            $hashes++;
            app(AuditService::class)->recordAuth('account.claim_started', $user, ['channel' => $channel]);
        }
        // Within the resend cooldown the code already sent stays valid: no new code.
        if (app(OneTimeCodes::class)->cooldown($user, EmailVerificationOtp::ACCOUNT_CLAIM) > 0) return $hashes;
        app(OneTimeCodes::class)->issue($user->setRelation('person', $person), EmailVerificationOtp::ACCOUNT_CLAIM, $email);

        return $hashes + 1;
    }

    public function verify(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255'], 'otp' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'max:72', 'confirmed', Password::min(8)->letters()->numbers()]]);
        $email = Str::lower(trim($data['email']));
        $emailKey = 'claim-verify:'.hash('sha256', $email);
        if (RateLimiter::tooManyAttempts($emailKey, 10)) {
            Hash::check($data['otp'], '$2y$12$H5ntb6FLY.qFGr/Rba08b.Dt0raoSs2QEEhzAIt5grrYJ3L8/f/q2');

            return OneTimeCodes::failure(...self::GENERIC_FAILURE);
        }
        RateLimiter::hit($emailKey, 3600);
        $result = DB::transaction(function () use ($email, $data) {
            $user = User::where('email', $email)->where('role', Role::Patient->value)->lockForUpdate()->first();
            if (! $user || $user->account_status !== 'Active' || $user->email_verified_at || ! $user->pending_claim) {
                Hash::check($data['otp'], '$2y$12$H5ntb6FLY.qFGr/Rba08b.Dt0raoSs2QEEhzAIt5grrYJ3L8/f/q2');

                return ['failure' => self::GENERIC_FAILURE];
            }
            $check = app(OneTimeCodes::class)->check($user, EmailVerificationOtp::ACCOUNT_CLAIM, $data['otp']); // 5 tries, then the code is dead
            if (isset($check['failure'])) return ['failure' => self::GENERIC_FAILURE];
            $user->forceFill(['password' => Hash::make($data['password']), 'email_verified_at' => now(), 'pending_claim' => false])->save();
            if ($user->patient) AccountClaims::markUsed($user->patient);
            app(AuditService::class)->recordAuth('account.claimed', $user);
            \App\Services\Intake\Guardianship::onOwnAccountVerified($user);

            return ['user' => $user];
        });
        if (isset($result['failure'])) return OneTimeCodes::failure(...$result['failure']);

        return response()->json(['message' => 'Your account is ready. Please sign in.', 'data' => ['email' => $result['user']->email, 'verified' => true]]);
    }

    private function burn(int $n): void
    {
        for ($i = 0; $i < $n; $i++) Hash::make(Str::random(16));
    }

    public static function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($local, 0, 1).str_repeat('•', max(1, mb_strlen($local) - 1)).'@'.$domain;
    }
}
