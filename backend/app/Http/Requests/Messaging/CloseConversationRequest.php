<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;

class CloseConversationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            ...array_fill_keys(['id', 'public_id', 'status', 'revision', 'patient_id', 'branch_id', 'closed_at', 'closed_by', 'closed_by_user_id', 'body', 'audit'], ['prohibited']),
        ];
    }
}
