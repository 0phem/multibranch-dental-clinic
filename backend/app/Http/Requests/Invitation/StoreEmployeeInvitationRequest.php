<?php

namespace App\Http\Requests\Invitation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Owner input for a Staff or Dentist invitation. The Owner role is not invitable (PI-01: additional Owners unanswered). */
class StoreEmployeeInvitationRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    protected function prepareForValidation(): void
    {
        $clean = fn ($v) => is_string($v) ? trim($v) : $v;
        $this->merge([
            'email' => is_string($this->input('email')) ? strtolower(trim((string) $this->input('email'))) : $this->input('email'),
            'first_name' => $clean($this->input('first_name')), 'last_name' => $clean($this->input('last_name')),
            'title' => $clean($this->input('title')), 'license_no' => $clean($this->input('license_no')) ?: null,
            'specialty' => $clean($this->input('specialty')) ?: null, 'phone' => $clean($this->input('phone')) ?: null,
        ]);
    }

    public function rules(): array
    {
        return [
            'role' => ['required', Rule::in(['staff', 'dentist'])],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'phone' => ['nullable', 'regex:/^\+63[1-9][0-9]{9}$/'],
            // Display-only job title (never a permission — CLAUDE_OPERATING_MODE §5); required for Staff.
            'title' => ['required_if:role,staff', 'nullable', 'string', 'max:100'],
            'branch_ref' => ['required', 'string', 'max:64'],
            'shift_start' => ['required', 'date_format:H:i'],
            'shift_end' => ['required', 'date_format:H:i', 'after:shift_start'],
            'license_no' => ['nullable', 'string', 'max:50', Rule::unique('dentist_profiles', 'license_no')],
            'specialty' => ['nullable', 'string', 'max:100'],
        ];
    }
}
