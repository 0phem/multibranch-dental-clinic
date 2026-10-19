<?php

namespace App\Services\Intake;

use App\Mail\AccountClaimInviteMail;
use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Services\Automations\AutomationCatalog;
use App\Services\Mail\MailDispatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * One-time claim links. A record registered at the counter has no email, so it cannot be claimed by self-service: staff check
 * the ID in person, confirm the patient's email with them and "Offer online account" (audited: who and when). A guardian can do
 * the same for a dependent who is 18 or older. The link carries a random token (only its hash is stored), works once and
 * expires (Owner setting, default 24 hours). The password is still chosen only together with the code emailed to that address.
 */
final class AccountClaims
{
    public function offer(Patient $patient, string $email, User $actor, string $kind): array
    {
        $email = Str::lower(trim($email));
        // A minor's access is through a guardian; only a patient of 18 or older gets their own account (checked here for every caller).
        if ((Guardianship::age($patient->person?->date_of_birth?->toDateString()) ?? 0) < Guardianship::ADULT_AGE) {
            throw ValidationException::withMessages(['email' => ['Only a patient of 18 or older can have their own account.']]);
        }
        if ($patient->user?->email_verified_at) throw ValidationException::withMessages(['email' => ['This patient already has an online account.']]);
        if (Person::whereRaw('lower(email) = ?', [$email])->where('id', '<>', $patient->person_id)->exists() || User::withTrashed()->where('email', $email)->where('person_id', '<>', $patient->person_id)->exists()) {
            throw ValidationException::withMessages(['email' => ['This email is already used by another record.']]);
        }
        $token = Str::random(48);
        $hours = (int) (AutomationCatalog::setting('intake')?->settings['claim_link_hours'] ?? 24);
        DB::transaction(function () use ($patient, $email, $actor, $kind, $token, $hours) {
            // An unverified claim made earlier with another email is dropped: the confirmed email is the only one used now.
            $pending = $patient->user;
            if ($pending && ! $pending->email_verified_at && $pending->email !== $email) $pending->forceFill(['email' => $email])->save();
            $patient->person->update(['email' => $email]);
            DB::table('account_claim_invites')->where('patient_id', $patient->id)->whereNull('used_at')->update(['used_at' => now()->toIso8601String()]); // older links stop working
            DB::table('account_claim_invites')->insert(['patient_id' => $patient->id, 'email' => $email, 'token_hash' => hash('sha256', $token), 'issued_by_kind' => $kind,
                'created_by_user_id' => $actor->id, 'expires_at' => now()->addHours($hours)->toIso8601String(), 'created_at' => now()->toIso8601String()]);
        });
        $result = app(MailDispatcher::class)->send($email, new AccountClaimInviteMail($patient->person->first_name, $token), 'account_claim_invite', $actor, $patient);
        app(AuditService::class)->recordAdministrative('patient.account_offered', $actor, $patient, ['by' => $kind, 'expires_in_hours' => $hours]);

        return $result;
    }

    /** The valid, unused, unexpired link for this token, or a reason it cannot be used. */
    public static function resolve(?string $token): array
    {
        if (! is_string($token) || ! preg_match('/^[A-Za-z0-9]{48}$/', $token)) return [null, 'invalid'];
        $row = DB::table('account_claim_invites')->where('token_hash', hash('sha256', $token))->first();
        if (! $row) return [null, 'invalid'];
        if ($row->used_at) return [$row, 'used'];
        if (now()->greaterThanOrEqualTo(\Carbon\CarbonImmutable::parse($row->expires_at))) return [$row, 'expired'];

        return [$row, null];
    }

    public static function markUsed(Patient $patient): void
    {
        DB::table('account_claim_invites')->where('patient_id', $patient->id)->whereNull('used_at')->update(['used_at' => now()->toIso8601String()]);
    }
}
