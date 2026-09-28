<?php

namespace App\Http\Requests\Appointment;

use Illuminate\Foundation\Http\FormRequest;

class CancelAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'status' => ['prohibited'],
        ];
    }
}
