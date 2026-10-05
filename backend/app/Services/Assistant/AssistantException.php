<?php

namespace App\Services\Assistant;

use Symfony\Component\HttpKernel\Exception\HttpException;

// A deliberate, patient-safe assistant failure. The message never contains provider text, a request body or a credential.
final class AssistantException extends HttpException
{
    public function __construct(int $status, public readonly string $errorCode, string $message)
    {
        parent::__construct($status, $message);
    }

    public function responseBody(): array
    {
        return ['message' => $this->getMessage(), 'code' => $this->errorCode];
    }
}
