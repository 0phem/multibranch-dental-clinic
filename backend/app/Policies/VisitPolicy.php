<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\User;
use App\Models\UserBranchScope;
use App\Models\Visit;

// M8 / Visit authorization. Staff: only branches in the account's authorization scopes (user_branch_scopes), never
// inferred from operational assignment. Dentist: read only Visits where they are the responsible Dentist; clinical
// progression belongs to the M5 Treatment commands (TreatmentPolicy). Owner: broad oversight and the documented Phase 1
// front-desk exception, but no clinical actions.
// Patient: no Visit API in this wave (D9). Active-account checks happen earlier in the `role:` middleware.
class VisitPolicy
{
    public function view(User $user, Visit $visit): bool
    {
        return match ($user->role) {
            Role::Owner => true,
            Role::Staff => $this->staffScope($user, $visit->branch_id),
            Role::Dentist => $visit->dentist?->person_id === $user->person_id,
            default => false,
        };
    }

    /** Scheduled Check-In: a front-desk action on an appointment in the actor's scope. */
    public function checkIn(User $user, Appointment $appointment): bool
    {
        return $this->frontDesk($user, $appointment->branch_id);
    }

    /** Walk-In admission at this branch. */
    public function walkIn(User $user, Branch $branch): bool
    {
        return $this->frontDesk($user, $branch->id);
    }

    private function frontDesk(User $user, int $branchId): bool
    {
        return $user->role === Role::Owner || ($user->role === Role::Staff && $this->staffScope($user, $branchId));
    }

    private function staffScope(User $user, int $branchId): bool
    {
        return UserBranchScope::where('user_id', $user->id)->where('branch_id', $branchId)->exists();
    }
}
