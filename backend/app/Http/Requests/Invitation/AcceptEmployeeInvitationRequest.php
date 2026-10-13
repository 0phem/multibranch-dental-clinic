<?php

namespace App\Http\Requests\Invitation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class AcceptEmployeeInvitationRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email:rfc', 'max:255'],
            'token' => ['required', 'string', 'size:64'],
            'password' => ['required', 'string', new \App\Rules\PasswordInput(), 'max:72', 'confirmed', Password::min(8)->letters()->numbers()],
        ];
    }
}
