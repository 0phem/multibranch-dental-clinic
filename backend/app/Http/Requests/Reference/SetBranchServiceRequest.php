<?php

namespace App\Http\Requests\Reference;

use Illuminate\Foundation\Http\FormRequest;

// Wires the existing frontend setBranchService toggle (Phase 2A plan, section C/H). Accepts branch_ref/
// service_ref — legacy_ref strings, never an internal bigint id (plan section C/point 2).
class SetBranchServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'branch_ref' => ['required', 'string', 'exists:branches,legacy_ref'],
            'service_ref' => ['required', 'string', 'exists:services,legacy_ref'],
            'active' => ['required', 'boolean'],
            'duration_override_minutes' => ['sometimes', 'nullable', 'integer', 'min:1'],

            'branch_id' => ['prohibited'],
            'service_id' => ['prohibited'],
            'id' => ['prohibited'],
        ];
    }
}
