<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Rule;
use libphonenumber\PhoneNumberUtil;
use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberFormat;

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
            // Patient contact only; the browser submits normalized E.164 and the server validates it.
            'phone' => ['required', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! is_string($value) || ! preg_match('/^\+[1-9]\d{1,14}$/', $value)) {
                    $fail('Enter a valid international phone number.');
                    return;
                }
                try {
                    $util = PhoneNumberUtil::getInstance();
                    $parsed = $util->parse($value, null);
                    if (! $util->isValidNumber($parsed) || $util->format($parsed, PhoneNumberFormat::E164) !== $value) {
                        $fail('Enter a valid international phone number.');
                    }
                } catch (NumberParseException) {
                    $fail('Enter a valid international phone number.');
                }
            }],
            'date_of_birth' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
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
