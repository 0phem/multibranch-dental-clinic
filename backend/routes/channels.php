<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Conversation;
use App\Models\User;
use App\Models\UserBranchScope;
use Illuminate\Support\Facades\Broadcast;

// M17 private channels. Authorization runs on /api/broadcasting/auth with the same session checks as every API call
// (auth:sanctum + EnsureAccountAccess). Each rule is the HTTP rule — never broader:
//   conversation.{id}     whoever may read that conversation over HTTP (Conversation::accessibleTo): its Patient, in-scope branch
//                         Staff, a Dentist participant assigned to the branch. Owner never (decision 4).
//   branch-inbox.{branch} Staff whose authorization scope includes that branch.
//   user.{id}             only the account itself.
Broadcast::channel('conversation.{conversationId}', function (User $user, string $conversationId) {
    $conversation = Conversation::whereRaw('lower(public_id) = ?', [strtolower($conversationId)])->first();

    return $conversation !== null && $conversation->accessibleTo($user);
});

Broadcast::channel('branch-inbox.{branchId}', function (User $user, string $branchId) {
    if ($user->role !== Role::Staff) return false;
    $branch = Branch::whereRaw('lower(public_id) = ?', [strtolower($branchId)])->first();

    return $branch !== null && UserBranchScope::where('user_id', $user->id)->where('branch_id', $branch->id)->exists();
});

Broadcast::channel('user.{userId}', fn (User $user, string $userId) => strtolower((string) $user->public_id) === strtolower($userId));
