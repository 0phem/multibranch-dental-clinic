<?php

namespace App\Http\Requests\Appointment;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;

// Reschedule command. expected_revision is required so a stale form returns 409 instead of overwriting a newer
// change. A Patient changes only date and time; Staff/Owner may also move it to another eligible Dentist.
class RescheduleAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $patient = $this->user()->role === Role::Patient;

        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['required', 'date_format:H:i'],
            'expected_revision' => ['required', 'integer', 'min:1'],
            'dentist_ref' => $patient ? ['prohibited'] : ['nullable', 'string', 'exists:dentist_profiles,legacy_ref'],

            'branch_ref' => ['prohibited'],
            'service_ref' => ['prohibited'],
            'patient_id' => ['prohibited'],
            'patient_code' => ['prohibited'],
            'status' => ['prohibited'],
        ];
    }
}
