<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// The Idempotency-Key header (CONTRACTS.md §2): 1–255 visible ASCII characters. Commands where a duplicate submission
// is realistic and would create a record (M8 Check-In, Walk-In, front-desk Patient registration) require it.
trait ReadsIdempotencyKey
{
    private function idempotencyKey(Request $request, bool $required = false): ?string
    {
        $key = $request->header('Idempotency-Key');
        if ($key === null) {
            if ($required) {
                throw ValidationException::withMessages(['idempotency_key' => 'An Idempotency-Key header is required for this command.']);
            }

            return null;
        }
        if (! is_string($key) || $key === '' || strlen($key) > 255 || preg_match('/[^\x21-\x7E]/', $key)) {
            throw ValidationException::withMessages(['idempotency_key' => 'The Idempotency-Key header must be 1–255 visible ASCII characters.']);
        }

        return $key;
    }
}
