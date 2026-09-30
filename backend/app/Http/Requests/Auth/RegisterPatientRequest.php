<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Rule;

// Public self-registration is Patient-only (see RegisteredPatientController). The reserved-field rules below
// reject the request outright — with a clear per-field validation error — rather than silently stripping
// privileged input, mirroring src/registration.js's allowlist discipline on the frontend. The true enforcement
// of "only safe fields are ever written" is that the controller builds records from $this->validated() alone,
// never from raw request input; these rules are an explicit, fail-closed defense-in-depth layer on top of that.
class RegisterPatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email'), Rule::unique('persons', 'email')],
            // Normalized E.164 contact number. These are deliberately simplified project-level bounds for the
            // six supported selectors, not a complete global telecom numbering authority. Display formatting is
            // handled by the frontend selector and the server never assumes a Philippine number.
            'phone' => ['required', function (string $attribute, mixed $value, \Closure $fail): void {
                $lengths = ['1' => 10, '44' => 10, '61' => 9, '63' => 10, '65' => 8, '81' => 10];
                $matched = false;
                foreach ($lengths as $dial => $digits) {
                    if (preg_match('/^\+'.preg_quote($dial, '/').'([1-9][0-9]{'.($digits - 1).'})$/', (string) $value)) {
                        $matched = true;
                        break;
                    }
                }
                if (! $matched) $fail('Enter a valid national number for the selected country code.');
            }],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],

            // Reserved/privileged fields — public registration can never choose these.
            'role' => ['prohibited'],
            'role_name' => ['prohibited'],
            'roleName' => ['prohibited'],
            'permissions' => ['prohibited'],
            'account_status' => ['prohibited'],
            'accountStatus' => ['prohibited'],
            'title' => ['prohibited'],
            'person_id' => ['prohibited'],
            'personId' => ['prohibited'],
            'patient_id' => ['prohibited'],
            'patientId' => ['prohibited'],
            'user_id' => ['prohibited'],
            'userId' => ['prohibited'],
            'id' => ['prohibited'],
        ];
    }
}
