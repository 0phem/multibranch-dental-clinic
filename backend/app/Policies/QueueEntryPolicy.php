<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\QueueEntry;
use App\Models\User;
use App\Models\UserBranchScope;

// M9 authorization. Staff: only branches in the account's authorization scopes (user_branch_scopes), never inferred
// from operational assignment. Dentist: their own Dentist queues; may Call their own entries only. Owner: global view
// and the documented Phase 1 non-clinical operational exception. Patients use the own-queue read endpoint only.
// Starting treatment is an M5 Treatment command (TreatmentPolicy::start), not a queue command.
class QueueEntryPolicy
{
    public function view(User $user, QueueEntry $entry): bool
    {
        return match ($user->role) {
            Role::Owner => true,
            Role::Staff => $this->staffScope($user, $entry),
            Role::Dentist => $this->ownQueue($user, $entry),
            default => false,
        };
    }

    /** Call: Staff (in scope), Owner, or the queue's own Dentist. */
    public function call(User $user, QueueEntry $entry): bool
    {
        return $this->operate($user, $entry) || ($user->role === Role::Dentist && $this->ownQueue($user, $entry));
    }

    /** Treatment Ready, Temporarily Away, Return and priority: Staff (in scope) or Owner only. */
    public function operate(User $user, QueueEntry $entry): bool
    {
        return $user->role === Role::Owner || ($user->role === Role::Staff && $this->staffScope($user, $entry));
    }

    private function staffScope(User $user, QueueEntry $entry): bool
    {
        return UserBranchScope::where('user_id', $user->id)->where('branch_id', $entry->dentistQueue->branch_id)->exists();
    }

    private function ownQueue(User $user, QueueEntry $entry): bool
    {
        return $entry->dentistQueue->dentist?->person_id === $user->person_id;
    }
}
