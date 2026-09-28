<?php

namespace App\Http\Requests\Appointment;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;

// Create an appointment. A Patient books for themself (no Patient identifier) and never chooses a Dentist; Staff/Owner
// name the Patient and may either select a Dentist or let the deterministic assignment choose one. Status, source,
// revision and ids are always server-decided. Scheduling rules are checked by SchedulingService, not here.
class StoreAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $patient = $this->user()->role === Role::Patient;

        return [
            'branch_ref' => ['required', 'string', 'exists:branches,legacy_ref'],
            'service_ref' => ['required', 'string', 'exists:services,legacy_ref'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['required', 'date_format:H:i'],
            'notes' => ['nullable', 'string', 'max:1000'],
            // Staff/Owner name the Patient by public_id (never the bigint or patient_code). A Patient's own booking is
            // always derived from the authenticated identity, so any Patient identifier they send is refused.
            'patient_id' => $patient ? ['prohibited'] : ['required', 'string', 'exists:patients,public_id'],
            'dentist_ref' => $patient ? ['prohibited'] : ['nullable', 'string', 'exists:dentist_profiles,legacy_ref'],

            'id' => ['prohibited'],
            'status' => ['prohibited'],
            'source' => ['prohibited'],
            'revision' => ['prohibited'],
            'patient_code' => ['prohibited'],
            'dentist_profile_id' => ['prohibited'],
        ];
    }
}
