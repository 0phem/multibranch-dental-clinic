<?php

namespace App\Services\Visits;

use Illuminate\Http\JsonResponse;
use RuntimeException;

// A refused M8/M9/M5 (Visit / Queue / Treatment) command, rendered with the shared API error contract (CONTRACTS.md §2): 422 { message, errors,
// code } for a rule failure, 409 { message, code } for a stale revision or a lost concurrent race.
final class VisitCommandException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public static function rule(string $code, string $message, string $field = 'visit'): self
    {
        return new self(422, $code, $message, ['errors' => [$field => [$message]]]);
    }

    /** @param list<array{key:string,label:string}> $failures */
    public static function ineligible(array $failures): self
    {
        return new self(422, 'walk_in_invalid', 'This walk-in can’t be admitted.', [
            'errors' => ['walk_in' => array_column($failures, 'label')],
            'failed_checks' => array_column($failures, 'key'),
        ]);
    }

    public static function staleAppointment(): self
    {
        return new self(409, 'stale_revision', 'This appointment changed after it was opened. Reload it before trying again.');
    }

    public static function staleVisit(): self
    {
        return new self(409, 'stale_revision', 'This visit changed after it was opened. Reload it before trying again.');
    }

    public static function staleQueueEntry(): self
    {
        return new self(409, 'stale_revision', 'This queue entry changed after it was opened. Reload the queue before trying again.');
    }

    public static function visitExists(): self
    {
        return new self(409, 'visit_exists', 'This appointment is already checked in.');
    }

    public static function activeVisitExists(): self
    {
        return new self(409, 'active_visit_exists', 'This patient already has an active visit. Finish that visit before admitting another.');
    }

    /** An expected business refusal, not an application error: never written to the error log. */
    public function report(): void {}

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'code' => $this->errorCode] + $this->extra, $this->status);
    }
}
