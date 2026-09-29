<?php

namespace App\Http\Requests\Queue;

use Illuminate\Foundation\Http\FormRequest;

// call / ready / away / return. The target status comes from the named command, never the client.
class QueueTransitionRequest extends FormRequest
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
            'position' => ['prohibited'],
            'queue_number' => ['prohibited'],
        ];
    }
}
