<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Safe frontend identity/context only. Never includes password, password hash, remember_token, or any other
// internal security field — see backend/README.md's API contract section.
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // Public identifiers only (CONTRACTS.md §1): no internal user/person/patient bigint ever leaves the server.
            'id' => $this->public_id,
            'name' => $this->name(),
            // Already-stored, already-safe Person fields (Backend Foundation 1B): let a frontend identity
            // bridge build a real local Person/Patient projection instead of parsing the derived `name` string.
            'first_name' => $this->person?->first_name,
            'last_name' => $this->person?->last_name,
            'phone' => $this->person?->phone,
            'date_of_birth' => $this->person?->date_of_birth?->toDateString(),
            'email' => $this->email,
            'role' => $this->role->value,
            'title' => $this->title,
            'account_status' => $this->account_status,
            // The logged-in account's own Patient record, resolved server-side through the database-backed
            // User -> Person -> Patient relationship (unique person_id on both users and patients) — never from
            // request input, email matching or frontend state. Null when the account has no Patient record.
            'patient' => $this->patient ? [
                'id' => $this->patient->public_id,
                'code' => $this->patient->patient_code,
            ] : null,
            // Explicit authorization branch scopes (user_branch_scopes). Owner authority is global by policy and
            // does not depend on this list; operational work assignment is never included here.
            'branch_scopes' => $this->branchScopes()->with('branch')->orderBy('branch_id')->get()
                ->map(fn ($scope) => ['id' => $scope->branch->legacy_ref, 'name' => $scope->branch->name])->values(),
        ];
    }
}
