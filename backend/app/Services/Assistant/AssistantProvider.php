<?php

namespace App\Services\Assistant;

// The only way M7 reaches a language model: one bounded call, text in, text out. No tools, no functions, no retrieval of its own.
interface AssistantProvider
{
    /** @throws AssistantException when unconfigured, unreachable, refused or when the response is unusable */
    public function complete(string $system, string $patientMessage): string;
}
