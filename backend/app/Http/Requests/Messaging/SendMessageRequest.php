<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;

// The only input is the message text. Sender, role, Patient, branch, conversation owner, read/delivery state, status, timestamps and
// provider ids are server context: supplying one is refused, never ignored. No attachments or rich text exist.
class SendMessageRequest extends FormRequest
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
            'body' => ['required', 'string', 'min:1', 'max:'.self::MAX, 'not_regex:/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/'],
            ...array_fill_keys(['id', 'public_id', 'sender', 'sender_id', 'sender_user_id', 'sender_role', 'sent_by', 'actor_id', 'patient_id', 'branch_id', 'conversation_id', 'owner', 'assigned_to', 'read_at', 'delivered_at',
                'seen_at', 'status', 'created_at', 'updated_at', 'external_id', 'provider_id', 'channel', 'attachment', 'attachments', 'html', 'audit'], ['prohibited']),
        ];
    }
}
