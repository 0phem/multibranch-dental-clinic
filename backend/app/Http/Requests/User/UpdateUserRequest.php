<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
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
        $user = $this->route('user');
        $userId = is_object($user) ? $user->id : $user;
        $personId = is_object($user) ? $user->person_id : null;

        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'email' => [
                'sometimes', 'required', 'email:rfc', 'max:255',
                Rule::unique('users', 'email')->ignore($userId),
                Rule::unique('persons', 'email')->ignore($personId),
            ],
            'phone' => ['sometimes', 'nullable', 'regex:/^\+63[1-9][0-9]{9}$/'],
            'role' => ['prohibited'],
            'password' => ['prohibited'],
            'password_confirmation' => ['prohibited'],
            'title' => ['prohibited'],
            'account_status' => ['prohibited'],
        ];
    }
}
