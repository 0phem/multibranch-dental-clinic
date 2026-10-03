<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Named M1 access commands; never changes operational availability or profile data. */
class AccountStatusController extends Controller
{
    public function suspend(Request $request, User $user)
    {
        return $this->change($request, $user, 'Suspended');
    }

    public function restore(Request $request, User $user)
    {
        return $this->change($request, $user, 'Active');
    }

    private function change(Request $request, User $target, string $status)
    {
        return DB::transaction(function () use ($request, $target, $status) {
            $owners = User::where('role', Role::Owner)->orderBy('id')->lockForUpdate()->get();
            $user = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            if ($status !== 'Active' && ($request->user()->is($user) ||
                ($user->role === Role::Owner && $user->account_status === 'Active' && $owners->where('account_status', 'Active')->count() <= 1))) {
                throw ValidationException::withMessages(['user' => 'You cannot suspend your own account or the last active Owner.']);
            }
            if ($user->account_status !== $status) {
                $user->update(['account_status' => $status]);
                // The User model revokes database sessions/tokens on either transition;
                // restoring access never restores an old session.
                app(AuditService::class)->recordAdministrative($status === 'Active' ? 'account.restored' : 'account.suspended', $request->user(), $user);
            }
            return response()->json(['data' => ['id' => $user->public_id, 'account_status' => $user->account_status]]);
        });
    }
}
