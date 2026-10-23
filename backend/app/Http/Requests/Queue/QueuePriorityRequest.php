<?php

namespace App\Http\Requests\Queue;

use App\Models\QueueEntry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Operational queue priority (not clinical triage): one of Normal / Priority / Urgent with a required reason.
class QueuePriorityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['reason' => trim(preg_replace('/\s+/', ' ', (string) $this->input('reason', '')))]);
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'priority' => ['required', Rule::in(QueueEntry::PRIORITIES)],
            'reason' => ['required', 'string', 'min:1', 'max:500'],
            'category' => ['nullable', 'string', Rule::in(['Senior Citizen', 'PWD', 'Urgent'])],
            'verification_status' => ['nullable', 'required_with:category', 'string', Rule::in(['verified', 'pending'])],
            'status' => ['prohibited'],
            'position' => ['prohibited'],
        ];
    }
}
