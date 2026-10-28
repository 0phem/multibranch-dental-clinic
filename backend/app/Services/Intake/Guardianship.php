<?php

namespace App\Services\Intake;

use App\Models\Patient;
use App\Models\PatientGuardian;
use App\Models\Person;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Parents and guardians (R2-12: minors without an ID). A guardian's own account manages dependents (children or others in their
 * care): book, be reminded, message the front desk and pay for them. A dependent needs no ID or email; the guardian's ID is the
 * one checked in person. Consent is recorded per dependent. When a dependent of 18 or more claims their own account (email
 * code), every guardian link ends and the guardian loses access (audited). Links are never deleted.
 */
final class Guardianship
{
    public const ADULT_AGE = 18;

    /** Age in whole years on the clinic date (Asia/Manila). */
    public static function age(?string $dateOfBirth, ?CarbonImmutable $now = null): ?int
    {
        if (! $dateOfBirth) return null;
        $today = ClinicClock::local($now ?? ClinicClock::now())->startOfDay();
        $born = CarbonImmutable::createFromFormat('!Y-m-d', substr($dateOfBirth, 0, 10), ClinicClock::TIMEZONE);

        return (int) $born->diffInYears($today, true);
    }

    public static function isMinor(?string $dateOfBirth): bool
    {
        $age = self::age($dateOfBirth);

        return $age !== null && $age < self::ADULT_AGE;
    }

    /** The user's own patient record, or a dependent they are an active guardian of. */
    public static function canActFor(?User $user, ?Patient $patient): bool
    {
        if (! $user?->patient || ! $patient) return false;
        if ($user->patient->id === $patient->id) return true;

        return PatientGuardian::where('guardian_patient_id', $user->patient->id)->where('dependent_patient_id', $patient->id)->where('status', 'active')->exists();
    }

    /** Patient ids the user may act for: their own and their active dependents'. */
    public static function patientIdsFor(?User $user): array
    {
        if (! $user?->patient) return [];

        return [$user->patient->id, ...PatientGuardian::where('guardian_patient_id', $user->patient->id)->where('status', 'active')->pluck('dependent_patient_id')->all()];
    }

    public static function dependentsOf(Patient $guardian): Collection
    {
        return PatientGuardian::where('guardian_patient_id', $guardian->id)->where('status', 'active')->with('dependent.person')->orderBy('id')->get();
    }

    /** A guardian adds a dependent from the portal (or the counter): a patient record with no email and no account. */
    public static function addDependent(Patient $guardian, array $data, ?User $actor, string $source = 'guardian'): Patient
    {
        $person = Person::create(['first_name' => $data['first_name'], 'last_name' => $data['last_name'], 'date_of_birth' => $data['date_of_birth'],
            'sex' => $data['sex'] ?? null, 'phone' => $guardian->person?->phone]);
        $patient = Patient::create(['person_id' => $person->id, 'patient_code' => Patient::nextCode(), 'consent' => true]);
        $patient->forceFill(['registration_source' => $source, 'preferred_branch_id' => $guardian->preferred_branch_id])->save();
        self::link($patient, $guardian, $data['relationship'], $actor, $actor, $data['relationship_other'] ?? null);

        return $patient;
    }

    /** Staff (or the guardian's own consent) link a dependent to a guardian. Audited. */
    public static function link(Patient $dependent, Patient $guardian, string $relationship, ?User $actor, ?User $consentBy, ?string $relationshipOther = null): PatientGuardian
    {
        if ($dependent->id === $guardian->id) throw ValidationException::withMessages(['guardian' => ['A patient cannot be their own guardian.']]);
        if ($dependent->user) throw ValidationException::withMessages(['guardian' => ['This patient has their own account; a guardian cannot be linked.']]);
        if (self::isMinor($guardian->person?->date_of_birth?->toDateString())) throw ValidationException::withMessages(['guardian' => ['A guardian must be 18 or older.']]);
        $isOther = strcasecmp(trim($relationship), 'Other') === 0;
        $cleanOther = $isOther && $relationshipOther !== null ? mb_substr(trim($relationshipOther), 0, 100) : null;
        if ($isOther && ($cleanOther === null || $cleanOther === '')) {
            throw ValidationException::withMessages(['relationship_other' => ['Please specify the relationship.']]);
        }
        $link = PatientGuardian::firstOrCreate(['dependent_patient_id' => $dependent->id, 'guardian_patient_id' => $guardian->id, 'status' => 'active'],
            ['relationship' => mb_substr($relationship, 0, 40), 'relationship_other' => $cleanOther, 'consent_at' => now(), 'consent_by_user_id' => $consentBy?->id, 'created_by_user_id' => $actor?->id]);
        if ($link->wasRecentlyCreated && $actor) {
            app(AuditService::class)->recordAdministrative('patient.guardian_linked', $actor, $dependent, ['guardian' => $guardian->public_id, 'relationship' => $link->relationship, 'relationship_other' => $link->relationship_other]);
        }

        return $link;
    }

    /** The dependent verified their own account: every guardian link ends (the guardian loses access). Audited. */
    public static function onOwnAccountVerified(User $user): void
    {
        $patient = $user->patient;
        if (! $patient) return;
        foreach (PatientGuardian::where('dependent_patient_id', $patient->id)->where('status', 'active')->get() as $link) {
            $link->update(['status' => 'ended', 'ended_at' => now(), 'ended_reason' => 'claimed_own_account']);
            app(AuditService::class)->recordAdministrative('patient.guardian_access_ended', $user, $patient, ['guardian' => $link->guardian?->public_id, 'reason' => 'claimed_own_account']);
        }
    }
}
