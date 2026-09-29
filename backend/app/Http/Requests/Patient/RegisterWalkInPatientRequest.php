<?php

namespace App\Http\Requests\Patient;

use Illuminate\Foundation\Http\FormRequest;

// Minimal front-desk Patient registration (M4, decision D4): a Person + Patient with no login account. Only the
// fields a walk-in needs; nothing account-related or privileged can be sent.
class RegisterWalkInPatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $email = trim((string) $this->input('email', ''));
        $this->merge(['email' => $email === '' ? null : strtolower($email)]);
        if ($this->input('phone') === '') {
            $this->merge(['phone' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            // Same normalized Philippine mobile format as registration (src/phone.js).
            'phone' => ['nullable', 'regex:/^\+63[1-9][0-9]{9}$/'],
            'date_of_birth' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'id' => ['prohibited'],
            'public_id' => ['prohibited'],
            'patient_code' => ['prohibited'],
            'person_id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'password' => ['prohibited'],
            'role' => ['prohibited'],
            'account_status' => ['prohibited'],
            'consent' => ['prohibited'],
        ];
    }
}
