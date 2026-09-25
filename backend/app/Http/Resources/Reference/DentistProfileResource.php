<?php

namespace App\Http\Resources\Reference;

use App\Enums\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// The scheduling engine's real input (Phase 2A plan, section A/H). license_no is included only for
// non-Patient roles ($this->when(...)) — no current Patient workflow needs it. service_ids[] lets the
// frontend derive dentistServiceAssignments client-side without a separate endpoint (plan section H).
// Deliberately carries no account_status field — see StaffProfileResource's comment; the same
// non-authoritative-account-status rule applies here.
class DentistProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->legacy_ref,
            'userId' => $this->legacy_user_ref,
            'personId' => 'per-'.$this->legacy_ref,
            'name' => $this->person->fullName(),
            'specialty' => $this->specialty,
            'license_no' => $this->when($request->user()?->role !== Role::Patient, $this->license_no),
            'assistantStaffId' => $this->assistant?->legacy_ref,
            'branch_ids' => $this->branches->pluck('legacy_ref')->values(),
            // Only authorized eligibility rows — the bridge synthesizes dentistServiceAssignments entries
            // from this list and can safely assume isAuthorized:true for every one present (plan section H).
            'service_ids' => $this->services->where('pivot.is_authorized', true)->pluck('legacy_ref')->values(),
            'shiftStart' => $this->shift_start,
            'shiftEnd' => $this->shift_end,
            'available' => $this->available,
        ];
    }
}
