<?php

namespace App\Services\Assistant;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

// Claude Messages API (`POST /v1/messages`, `stream: true`), called from the SERVER only. The browser never sees the key, the model
// id or the request. Server-sent events are read as they arrive: text deltas are passed on immediately (real streaming), tool_use
// blocks are assembled from their JSON deltas. One attempt per turn (a retry would multiply cost); only an error CATEGORY and HTTP
// status are logged — never the prompt, the answer or the key.
//
// ENDPOINT PINNING: the key is sent ONLY to the official Anthropic origin below. It is a constant, not configuration: no environment
// value, request field or Patient input can redirect it. Tests intercept the call with the framework HTTP fake.
final class AnthropicProvider implements AssistantProvider
{
    public const ORIGIN = 'https://api.anthropic.com';

    public function configured(): bool
    {
        return (string) config('assistant.api_key') !== '' && (bool) preg_match('/^[A-Za-z0-9._:-]{3,80}$/', (string) config('assistant.model'))
            && (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) config('assistant.anthropic_version'));
    }

    public function turn(array $request, callable $onText): array
    {
        if (! $this->configured()) {
            throw new AssistantException(503, 'assistant_not_configured', 'The AI assistant is not configured.');
        }
        try {
            $response = Http::withHeaders(['x-api-key' => (string) config('assistant.api_key'), 'anthropic-version' => (string) config('assistant.anthropic_version')])
                ->withOptions(['stream' => true])->accept('text/event-stream')->asJson()->timeout(max(5, (int) config('assistant.timeout_seconds')))
                ->post(self::ORIGIN.'/v1/messages', [
                    'model' => (string) config('assistant.model'),
                    'max_tokens' => max(64, min(1024, (int) config('assistant.max_output_tokens'))),
                    'temperature' => 0.2,
                    'stream' => true,
                    'system' => $request['system'],
                    'messages' => $request['messages'],
                    'tools' => $request['tools'],
                ]);
        } catch (ConnectionException) {
            Log::warning('assistant.provider_failed', ['category' => 'unreachable']);
            throw self::unavailable();
        }
        if (! $response->successful()) {
            Log::warning('assistant.provider_failed', ['category' => $response->clientError() ? 'refused' : 'server_error', 'status' => $response->status()]);
            throw self::unavailable();
        }

        $blocks = [];
        $stop = null;
        $inputTokens = $outputTokens = 0;
        $stream = $response->toPsrResponse()->getBody();
        $buffer = '';
        $event = null;
        $handle = function (string $line) use (&$blocks, &$stop, &$inputTokens, &$outputTokens, &$event, $onText) {
            if (str_starts_with($line, 'event:')) { $event = trim(substr($line, 6)); return; }
            if (! str_starts_with($line, 'data:')) return;
            $data = json_decode(trim(substr($line, 5)), true);
            if (! is_array($data)) return;
            switch ($data['type'] ?? $event) {
                case 'message_start':
                    $inputTokens = (int) ($data['message']['usage']['input_tokens'] ?? 0);
                    break;
                case 'content_block_start':
                    $block = $data['content_block'] ?? [];
                    $blocks[(int) ($data['index'] ?? count($blocks))] = ($block['type'] ?? '') === 'tool_use'
                        ? ['type' => 'tool_use', 'id' => (string) ($block['id'] ?? ''), 'name' => (string) ($block['name'] ?? ''), 'json' => '']
                        : ['type' => 'text', 'text' => (string) ($block['text'] ?? '')];
                    break;
                case 'content_block_delta':
                    $i = (int) ($data['index'] ?? 0);
                    $delta = $data['delta'] ?? [];
                    if (($delta['type'] ?? '') === 'text_delta' && isset($blocks[$i])) {
                        $blocks[$i]['text'] .= (string) $delta['text'];
                        $onText((string) $delta['text']);
                    } elseif (($delta['type'] ?? '') === 'input_json_delta' && isset($blocks[$i])) {
                        $blocks[$i]['json'] .= (string) ($delta['partial_json'] ?? '');
                    }
                    break;
                case 'message_delta':
                    $stop = $data['delta']['stop_reason'] ?? $stop;
                    $outputTokens = (int) ($data['usage']['output_tokens'] ?? $outputTokens);
                    break;
                case 'error':
                    Log::warning('assistant.provider_failed', ['category' => 'stream_error']);
                    throw self::unavailable();
            }
        };
        while (! $stream->eof()) {
            $buffer .= $stream->read(1024);
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = rtrim(substr($buffer, 0, $pos), "\r");
                $buffer = substr($buffer, $pos + 1);
                if ($line !== '') $handle($line);
            }
        }
        if (trim($buffer) !== '') $handle(trim($buffer));

        ksort($blocks);
        $content = array_values(array_map(function (array $b) {
            if ($b['type'] !== 'tool_use') return $b;
            $input = json_decode($b['json'] === '' ? '{}' : $b['json'], true);

            return ['type' => 'tool_use', 'id' => $b['id'], 'name' => $b['name'], 'input' => is_array($input) ? $input : []];
        }, $blocks));
        if (! in_array($stop, ['end_turn', 'tool_use', 'stop_sequence'], true)) {
            Log::warning('assistant.provider_failed', ['category' => 'unexpected_stop', 'stop' => $stop]);
            throw self::unavailable();
        }

        return ['content' => $content, 'stop_reason' => $stop, 'input_tokens' => $inputTokens, 'output_tokens' => $outputTokens];
    }

    private static function unavailable(): AssistantException
    {
        return new AssistantException(503, 'assistant_unavailable', 'The AI assistant is not available right now.');
    }
}
