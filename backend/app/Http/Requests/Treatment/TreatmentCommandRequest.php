<?php

namespace App\Http\Requests\Treatment;

use Illuminate\Foundation\Http\FormRequest;

// Treatment start / complete. The target status comes from the named command, never the client. For start the
// expected_revision is the Visit's; for complete it is the Treatment's.
class TreatmentCommandRequest extends FormRequest
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
