<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Treatment;
use App\Models\User;
use App\Models\UserBranchScope;
use App\Models\Visit;

// M5 authorization (decisions Q-T6 / Q-T9). Mirrors Treatment::scopeVisibleTo for single records.
//   Staff:   branch-scoped READ of the clinical record (existing project behaviour); no M5 command.
//   Dentist: start/document/complete only as the Visit's responsible Dentist and the Treatment's author; READ of their
//            own Treatments and of COMPLETED Treatments of a Patient they currently treat on an active Visit.
//   Owner:   operational summary read only (the resource hides clinical text); no M5 command.
//   Patient: own completed safe subset through /api/treatments/mine only.
class TreatmentPolicy
{
    public function view(User $user, Treatment $treatment): bool
    {
        return match ($user->role) {
            Role::Owner => true,
            Role::Staff => UserBranchScope::where('user_id', $user->id)->where('branch_id', $treatment->visit->branch_id)->exists(),
            Role::Dentist => $this->authored($user, $treatment) || ($treatment->status === 'Completed'
                && Treatment::treatingPatients($user)->where('visits.patient_id', $treatment->visit->patient_id)->exists()),
            default => false,
        };
    }

    /**
     * Start: only the Visit's responsible Dentist. A Visit without a responsible Dentist lets a Dentist through to the
     * command, which refuses with a clear `dentist_unresolved` error instead of a bare 403.
     */
    public function start(User $user, Visit $visit): bool
    {
        return $user->role === Role::Dentist && ($visit->dentist === null || $visit->dentist->person_id === $user->person_id);
    }

    /** Document / complete: the author, who is still the Visit's responsible Dentist (re-checked under lock). */
    public function author(User $user, Treatment $treatment): bool
    {
        return $this->authored($user, $treatment) && $treatment->visit->responsible_dentist_profile_id === $treatment->dentist_profile_id;
    }

    public function authored(User $user, Treatment $treatment): bool
    {
        return $user->role === Role::Dentist && $treatment->dentist?->person_id === $user->person_id;
    }
}
