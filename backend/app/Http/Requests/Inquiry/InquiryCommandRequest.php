<?php

namespace App\Http\Requests\Inquiry;

use Illuminate\Foundation\Http\FormRequest;

// respond / close / convert. The target state comes from the named command, never the client.
class InquiryCommandRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'appointment_id' => ['sometimes', 'string', 'size:26'],
            ...array_fill_keys(['id', 'public_id', 'status', 'revision', 'assigned_user_id', 'assignee', 'patient_id', 'patient', 'branch_id', 'capture_method', 'responded_at', 'closed_at', 'converted_at',
                'created_at', 'updated_at', 'history', 'audit', 'message', 'reply', 'delivery_status'], ['prohibited']),
        ];
    }
}
