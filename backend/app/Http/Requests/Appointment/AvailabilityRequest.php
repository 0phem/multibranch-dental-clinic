<?php

namespace App\Http\Requests\Appointment;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;

// Read-only availability search for one branch/service/date. `appointment_id` (a public id the caller may view)
// excludes that appointment from conflict checks when searching times for a reschedule.
class AvailabilityRequest extends FormRequest
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
            'patient_id' => $patient ? ['prohibited'] : ['nullable', 'string', 'exists:patients,public_id'],
            'patient_code' => ['prohibited'],
            'appointment_id' => ['nullable', 'string', 'exists:appointments,public_id'],
        ];
    }
}
