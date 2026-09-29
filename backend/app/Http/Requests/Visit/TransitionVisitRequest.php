<?php

namespace App\Http\Requests\Visit;

use Illuminate\Foundation\Http\FormRequest;

// start-treatment / complete. The target status comes from the named command, never the client.
class TransitionVisitRequest extends FormRequest
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
