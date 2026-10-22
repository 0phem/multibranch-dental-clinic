<?php

namespace App\Http\Requests\Feedback;

use Illuminate\Foundation\Http\FormRequest;

// A Patient's feedback: the Visit (public id) and free text. Nothing else is accepted: no rating, category, anonymity flag, publication or
// marketing flag, reviewer, status, Patient/user/branch/Dentist reference or timestamp — supplying one is refused, never ignored.
class SubmitFeedbackRequest extends FormRequest
{
    public const MAX = 2000;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $body = $this->input('body');
        if (is_string($body)) {
            $this->merge(['body' => trim(str_replace(["\r\n", "\r"], "\n", $body))]);
        }
    }

    public function rules(): array
    {
        return [
            'visit_id' => ['required', 'string', 'size:26'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'body' => ['required', 'string', 'min:1', 'max:'.self::MAX, 'not_regex:/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/'],
            ...array_fill_keys(['id', 'public_id', 'patient_id', 'patient', 'user_id', 'author', 'author_id', 'reviewer', 'reviewed_by', 'review_status', 'status', 'branch_id', 'branch', 'dentist_id', 'dentist',
                'stars', 'score', 'nps', 'category', 'tags', 'anonymous', 'is_anonymous', 'publish', 'public', 'testimonial', 'testimonial_consent', 'marketing_consent', 'consent',
                'resolved_at', 'created_at', 'updated_at', 'attachment', 'attachments', 'html', 'audit'], ['prohibited']),
        ];
    }
}
