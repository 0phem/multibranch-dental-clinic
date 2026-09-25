<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => [
                'required', 'email:rfc', 'max:255',
                Rule::unique('users', 'email'),
                Rule::unique('persons', 'email'),
            ],
            'phone' => ['nullable', 'regex:/^\+63[1-9][0-9]{9}$/'],
            'role' => ['required', Rule::in(['patient'])],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ];
    }
}
