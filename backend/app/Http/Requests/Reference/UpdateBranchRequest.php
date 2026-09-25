<?php

namespace App\Http\Requests\Reference;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Wires the existing frontend saveBranch action (Phase 2A plan, section H/J) — update-only, matching what
// the current Admin UI actually does; no create endpoint exists this phase. authorize() defers to the
// 'role:owner' route middleware, matching the existing RegisterPatientRequest/LoginRequest convention of
// returning true here.
class UpdateBranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $branchId = $this->route('branch')?->id;

        return [
            'branch_code' => ['sometimes', 'string', 'max:50', Rule::unique('branches', 'branch_code')->ignore($branchId)],
            'name' => ['sometimes', 'string', 'max:150', Rule::unique('branches', 'name')->ignore($branchId)],
            'city' => ['sometimes', 'string', 'max:100'],
            'address' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'open_time' => ['sometimes', 'date_format:H:i'],
            'close_time' => ['sometimes', 'date_format:H:i', 'after:open_time'],
            'status' => ['sometimes', Rule::in(['Open', 'Temporarily Closed', 'Inactive'])],
            'capacity_threshold' => ['sometimes', 'integer', 'min:1', 'max:100'],

            // legacy_ref/latitude/longitude/id are never client-mutable — coordinates stay NULL until a
            // real future decision populates them (plan section F); legacy_ref is bridge-internal only.
            'legacy_ref' => ['prohibited'],
            'latitude' => ['prohibited'],
            'longitude' => ['prohibited'],
            'id' => ['prohibited'],
        ];
    }
}
