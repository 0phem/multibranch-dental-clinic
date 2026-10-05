<?php

namespace App\Services\Assistant;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

// Reference adapter for the Claude Messages API (`POST /v1/messages`), the FIRST implementation behind AssistantProvider. It is not
// a recorded clinic vendor decision. Contract used (current official API): JSON body {model, max_tokens, temperature, system,
// messages:[single user turn]}, headers `x-api-key` (the supported API-key form), `anthropic-version`, `content-type: application/json`;
// no `tools` key, so the model has nothing to call. One attempt: a retry would multiply cost, so failure is reported and the Patient
// decides to try again. Only an error CATEGORY and HTTP status are logged — never the prompt, the answer or the key.
//
// ENDPOINT PINNING: the API key is sent ONLY to the official Anthropic origin below. It is a constant, not configuration: no
// environment value, request field or Patient input can redirect it, so the secret cannot be sent to an arbitrary HTTPS host. A
// different provider or an internal proxy must get its own adapter and its own credential model, never reuse this class with
// another host. Tests intercept the call with the framework HTTP fake instead of pointing the adapter at a test host.
final class AnthropicProvider implements AssistantProvider
{
    public const ORIGIN = 'https://api.anthropic.com';

    private const ACCEPTED_STOP_REASONS = ['end_turn', 'stop_sequence'];

    public function complete(string $system, string $patientMessage): string
    {
        $key = (string) config('assistant.api_key');
        $model = (string) config('assistant.model');
        $version = (string) config('assistant.anthropic_version');
        if ($key === '' || ! preg_match('/^[A-Za-z0-9._:-]{3,80}$/', $model) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $version) || config('assistant.provider') !== 'anthropic') {
            throw new AssistantException(503, 'assistant_not_configured', 'The clinic assistant is not available right now. Please contact the clinic.');
        }

        try {
            $response = Http::withHeaders(['x-api-key' => $key, 'anthropic-version' => $version])
                ->acceptJson()->asJson()->timeout(max(1, (int) config('assistant.timeout_seconds')))->retry(0)
                ->post(self::ORIGIN.'/v1/messages', [
                    'model' => $model,
                    'max_tokens' => max(1, min(400, (int) config('assistant.max_output_tokens'))),
                    'temperature' => 0,
                    'system' => $system,
                    'messages' => [['role' => 'user', 'content' => $patientMessage]],
                ]);
        } catch (ConnectionException) {
            Log::warning('assistant.provider_failed', ['category' => 'unreachable']);
            throw self::unavailable();
        }
        if (! $response->successful()) {
            Log::warning('assistant.provider_failed', ['category' => $response->clientError() ? 'refused' : 'server_error', 'status' => $response->status()]);
            throw self::unavailable();
        }
        // Only the expected successful Messages shape is accepted: an assistant message, a normal stop (a max_tokens cut or a refusal
        // is never shown), and text blocks only (a tool or any other block is unexpected because no tool was offered).
        $body = $response->json();
        $content = is_array($body) ? ($body['content'] ?? null) : null;
        $text = '';
        $valid = is_array($body) && ($body['type'] ?? null) === 'message' && ($body['role'] ?? null) === 'assistant'
            && in_array($body['stop_reason'] ?? null, self::ACCEPTED_STOP_REASONS, true) && is_array($content) && $content !== [];
        if ($valid) {
            foreach ($content as $block) {
                if (! is_array($block) || ($block['type'] ?? null) !== 'text' || ! is_string($block['text'] ?? null)) {
                    $valid = false;
                    break;
                }
                $text .= $block['text'];
            }
        }
        if (! $valid || trim($text) === '') {
            Log::warning('assistant.provider_failed', ['category' => 'malformed', 'stop_reason' => is_array($body) && is_string($body['stop_reason'] ?? null) ? substr($body['stop_reason'], 0, 30) : null]);
            throw self::unavailable();
        }

        return $text;
    }

    private static function unavailable(): AssistantException
    {
        return new AssistantException(502, 'assistant_unavailable', 'The clinic assistant could not answer right now. Please try again, or contact the clinic.');
    }
}
