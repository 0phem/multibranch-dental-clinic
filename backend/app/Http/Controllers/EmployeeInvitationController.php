<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Requests\Invitation\AcceptEmployeeInvitationRequest;
use App\Http\Requests\Invitation\StoreEmployeeInvitationRequest;
use App\Models\User;
use App\Services\Auth\EmployeeInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** M1 employee invitations. Owner-only management (route middleware); public, throttled, generic-failure acceptance. */
class EmployeeInvitationController extends Controller
{
    public function __construct(private readonly EmployeeInvitationService $invitations) {}

    public function index(): JsonResponse
    {
        $users = User::query()->with(['person', 'staffProfile.branch', 'dentistProfile.branches'])
            ->whereIn('role', [Role::Staff->value, Role::Dentist->value])
            ->whereIn('account_status', [EmployeeInvitationService::INVITED, EmployeeInvitationService::REVOKED])
            ->whereNull('email_verified_at')->orderByDesc('id')->limit(200)->get();

        return response()->json(['data' => $users->map(fn (User $u) => $this->present($u))->values()]);
    }

    public function store(StoreEmployeeInvitationRequest $request): JsonResponse
    {
        $result = $this->invitations->invite($request->user(), $request->validated());

        return response()->json(['data' => $this->present($result['user']), 'delivery' => $result['delivery']], 201);
    }

    public function resend(Request $request, User $user): JsonResponse
    {
        $result = $this->invitations->resend($request->user(), $user);

        return response()->json(['data' => $this->present($result['user']), 'delivery' => $result['delivery']]);
    }

    public function cancel(Request $request, User $user): JsonResponse
    {
        return response()->json(['data' => $this->present($this->invitations->cancel($request->user(), $user))]);
    }

    public function accept(AcceptEmployeeInvitationRequest $request): JsonResponse
    {
        $data = $request->validated();
        $this->invitations->accept($data['email'], $data['token'], $data['password']);

        return response()->json(['data' => ['accepted' => true]]);
    }

    private function present(User $user): array
    {
        $user->loadMissing(['person', 'staffProfile.branch', 'dentistProfile.branches']);
        $branch = $user->role === Role::Staff ? $user->staffProfile?->branch : $user->dentistProfile?->branches->first();
        $last = \App\Models\AuditLog::query()->where('action', 'mail.dispatched')->where('auditable_public_id', $user->public_id)
            ->orderByDesc('id')->first();

        return [
            'id' => $user->public_id,
            'name' => $user->person?->fullName() ?? '',
            'email' => $user->email,
            'role' => $user->role->value,
            'title' => $user->role === Role::Staff ? ($user->staffProfile?->title ?? $user->title) : null,
            'branch' => $branch ? ['id' => $branch->legacy_ref, 'name' => $branch->name] : null,
            'status' => $user->account_status,
            ...$this->invitations->invitationState($user),
            // The last recorded send outcome (M18 evidence): never a claim of inbox delivery.
            'last_delivery' => $last ? ['status' => $last->payload['status'] ?? null, 'at' => $last->created_at?->toIso8601String()] : null,
        ];
    }
}
