<?php

namespace App\Services\Appointments;

use Illuminate\Http\JsonResponse;
use RuntimeException;

// A refused M6 command, rendered with the shared API error contract (CONTRACTS.md §2): 422 { message, errors, code }
// for a rule failure, 409 for a stale revision or a concurrent scheduling conflict.
final class AppointmentCommandException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public static function invalidSchedule(array $failures, array $alternatives = []): self
    {
        return new self(422, 'schedule_invalid', 'The requested time cannot be booked.', [
            'errors' => ['schedule' => array_column($failures, 'label')],
            'failed_checks' => array_column($failures, 'key'),
            'alternatives' => $alternatives,
        ]);
    }

    public static function conflict(): self
    {
        return new self(409, 'schedule_conflict', 'That time was just booked by another request. Choose another time.');
    }

    public static function staleRevision(): self
    {
        return new self(409, 'stale_revision', 'This appointment changed after it was opened. Reload it before trying again.');
    }

    public static function rule(string $code, string $message, string $field = 'appointment'): self
    {
        return new self(422, $code, $message, ['errors' => [$field => [$message]]]);
    }

    /** An expected business refusal, not an application error: never written to the error log. */
    public function report(): void {}

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'code' => $this->errorCode] + $this->extra, $this->status);
    }
}
