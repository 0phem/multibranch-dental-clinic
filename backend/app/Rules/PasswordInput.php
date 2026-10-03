<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Bcrypt accepts at most 72 bytes, not 72 Unicode characters; NUL is invalid. */
class PasswordInput implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || strlen($value) > 72 || str_contains($value, "\0")) {
            $fail('Use a password of at most 72 bytes without null characters.');
        }
    }
}
