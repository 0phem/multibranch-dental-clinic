<?php

namespace App\Http\Requests\Reference;

use Illuminate\Foundation\Http\FormRequest;

// Wires the existing frontend savePersonnel('staff', ...) action (Phase 2A plan, section H/J).
class UpdateStaffProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'nullable', 'string', 'max:100'],
            'branch_ref' => ['sometimes', 'nullable', 'string', 'exists:branches,legacy_ref'],
            'shift_start' => ['sometimes', 'date_format:H:i'],
            'shift_end' => ['sometimes', 'date_format:H:i', 'after:shift_start'],
            'available' => ['sometimes', 'boolean'],

            // Identity fields are immutable here, matching the existing savePersonnel behavior exactly.
            'legacy_ref' => ['prohibited'],
            'legacy_user_ref' => ['prohibited'],
            'person_id' => ['prohibited'],
            'id' => ['prohibited'],
        ];
    }
}
