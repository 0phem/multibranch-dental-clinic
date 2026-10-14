<?php

namespace App\Services\Assistant;

/** A model provider for the Clinic Assistant. Implementations stream; `$onText` receives each text fragment as it arrives. */
interface AssistantProvider
{
    public function configured(): bool;

    /**
     * One model turn (Messages API shape). Returns the assistant content blocks (text and tool_use), the stop reason and token usage.
     *
     * @param  array{system:string, messages:list<array>, tools:list<array>}  $request
     * @param  callable(string):void  $onText
     * @return array{content:list<array>, stop_reason:?string, input_tokens:int, output_tokens:int}
     */
    public function turn(array $request, callable $onText): array;
}
