<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\User;
use App\Models\UserBranchScope;

// M6 authorization (mirrors src/contracts.js inScope). Patient: own appointments only. Staff: only branches in the
// account's authorization scopes (user_branch_scopes; zero, one or many) — never inferred from operational
// assignment. Dentist: read-only view of appointments assigned to them. Owner: all branches. Active-account checks
// happen earlier in the `role:` middleware.
class AppointmentPolicy
{
    public function view(User $user, Appointment $appointment): bool
    {
        return match ($user->role) {
            Role::Owner => true,
            Role::Patient => $user->patient !== null && $appointment->patient_id === $user->patient->id,
            Role::Staff => $this->staffScope($user, $appointment->branch_id),
            Role::Dentist => $appointment->dentist?->person_id === $user->person_id,
        };
    }

    /** Create an appointment (or search availability) at this branch. */
    public function book(User $user, Branch $branch): bool
    {
        return match ($user->role) {
            Role::Owner => true,
            Role::Patient => $user->patient !== null,
            Role::Staff => $this->staffScope($user, $branch->id),
            Role::Dentist => false,
        };
    }

    public function reschedule(User $user, Appointment $appointment): bool
    {
        return $user->role !== Role::Dentist && $this->view($user, $appointment);
    }

    public function cancel(User $user, Appointment $appointment): bool
    {
        return $user->role !== Role::Dentist && $this->view($user, $appointment);
    }

    private function staffScope(User $user, int $branchId): bool
    {
        return UserBranchScope::where('user_id', $user->id)->where('branch_id', $branchId)->exists();
    }
}
