<?php

namespace App\Http\Requests\Patient;

use App\Support\ClinicClock;
use Illuminate\Foundation\Http\FormRequest;

// Staff maintenance of the NON-CLINICAL Patient profile. Every mutable field is explicitly allowlisted. Clinical history
// (allergies, medical and dental history) and every identity/ownership/authorization field are `prohibited`, so a direct
// API call cannot reach them even though the model would accept them: clinical changes belong to an authorized Dentist
// workflow, which does not exist on the server yet, and identity linkage is never client-chosen.
class UpdatePatientRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['first_name', 'last_name', 'address', 'emergency_contact', 'sex'] as $field) {
            if (is_string($this->input($field))) {
                $value = trim($this->input($field));
                $this->merge([$field => ($value === '' && in_array($field, ['address', 'emergency_contact', 'sex'], true)) ? null : $value]);
            }
        }
        if (is_string($this->input('email'))) {
            $email = strtolower(trim($this->input('email')));
            $this->merge(['email' => $email === '' ? null : $email]);
        }
        if ($this->input('phone') === '') {
            $this->merge(['phone' => null]);
        }
    }

    public function rules(): array
    {
        $forbidden = ['prohibited'];

        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'regex:/^\+63[1-9][0-9]{9}$/'],
            'date_of_birth' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'before_or_equal:'.ClinicClock::today()],
            'sex' => ['sometimes', 'nullable', 'string', 'max:30'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'emergency_contact' => ['sometimes', 'nullable', 'string', 'max:500'],
            // The branch's legacy_ref or ULID public_id; null clears the preference.
            'preferred_branch_id' => ['sometimes', 'nullable', 'string', 'max:64'],

            // Clinical history: not editable through the generic profile route.
            'allergies' => $forbidden,
            'medical_history' => $forbidden,
            'dental_history' => $forbidden,
            'clinical_notes' => $forbidden,
            // Identity, linkage, ownership and authorization.
            'id' => $forbidden,
            'public_id' => $forbidden,
            'patient_code' => $forbidden,
            'person_id' => $forbidden,
            'user_id' => $forbidden,
            'patient_id' => $forbidden,
            'role' => $forbidden,
            'account_status' => $forbidden,
            'password' => $forbidden,
            'branch_scopes' => $forbidden,
            'consent' => $forbidden,
            'revision' => $forbidden,
            'created_by' => $forbidden,
            'approved_by' => $forbidden,
            'created_at' => $forbidden,
            'updated_at' => $forbidden,
        ];
    }
}
