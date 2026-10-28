<?php

namespace App\Http\Requests\Inquiry;

use Illuminate\Foundation\Http\FormRequest;

// A manually captured inquiry. Text is bounded and free of control characters; names and handles are NOT restricted to ASCII.
// Ownership, status, timestamps, identifiers and any platform field are server context: supplying one is refused, not ignored.
class CreateInquiryRequest extends FormRequest
{
    public const CONTROL = '/[\x00-\x08\x0B-\x1F\x7F]/';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $clean = fn ($v) => is_string($v) ? trim(preg_replace('/[ \t]+/u', ' ', str_replace(["\r\n", "\r"], "\n", $v))) : $v;
        $this->merge(array_filter(['name' => $clean($this->input('name')), 'contact' => $clean($this->input('contact')), 'topic' => $clean($this->input('topic'))], fn ($v) => $v !== null));
    }

    public function rules(): array
    {
        return [
            'branch_ref' => ['nullable', 'string', 'max:64', 'exists:branches,legacy_ref'],
            'source' => ['required', 'string', 'in:Facebook,Instagram,Website'],
            'name' => ['required', 'string', 'min:2', 'max:120', 'not_regex:'.self::CONTROL, 'not_regex:/\n/'],
            'contact' => ['nullable', 'string', 'max:200', 'not_regex:'.self::CONTROL, 'not_regex:/\n/'],
            'topic' => ['required', 'string', 'min:2', 'max:500', 'not_regex:'.self::CONTROL],
            ...array_fill_keys(['id', 'public_id', 'status', 'revision', 'assigned_user_id', 'assignee', 'assigned_to', 'created_by', 'created_by_user_id', 'branch_id', 'patient_id', 'patient', 'appointment_id',
                'capture_method', 'external_id', 'provider_id', 'platform_id', 'delivery_status', 'received_at', 'responded_at', 'closed_at', 'converted_at', 'created_at', 'updated_at', 'history', 'audit'], ['prohibited']),
        ];
    }
}
