<?php

namespace App\Http\Requests\Visit;

use Illuminate\Foundation\Http\FormRequest;

// Walk-In admission: the Patient (public_id), the branch, the requested service when known, and optionally the
// responsible Dentist. A walk-in never names an appointment, and the arrival time/status come from the server.
class WalkInVisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'string', 'max:26'],
            'branch_ref' => ['required', 'string', 'exists:branches,legacy_ref'],
            'service_ref' => ['nullable', 'string', 'exists:services,legacy_ref'],
            'dentist_ref' => ['nullable', 'string', 'exists:dentist_profiles,legacy_ref'],
            'appointment_id' => ['prohibited'],
            'status' => ['prohibited'],
            'source' => ['prohibited'],
            'arrived_at' => ['prohibited'],
            'clinic_date' => ['prohibited'],
        ];
    }
}
