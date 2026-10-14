<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Services\Assistant\AssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

// M7 Clinic Assistant: Patient-only and read-only. The Patient is the authenticated account; the only inputs are the message and a
// short history of this chat (untrusted text). No identifier of any kind is accepted from the client.
class AssistantController extends Controller
{
    public function __construct(private readonly AssistantService $assistant) {}

    /** GET /api/assistant — the mode (ai or knowledge), the starter questions and how many questions are left today. */
    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === Role::Patient && $request->user()->patient !== null, 403);

        return response()->json(['data' => [
            'mode' => $this->assistant->mode(),
            'starters' => ['When is my next appointment?', 'Bukas ba kayo sa Sabado?', 'What’s my balance?', 'Saan ang mga branch ninyo?'],
            'remaining_today' => max(0, (int) config('assistant.daily_cap') - AssistantService::usedToday($request->user())),
        ]]);
    }

    /** POST /api/assistant/messages — the whole answer as JSON. */
    public function ask(Request $request): JsonResponse
    {
        [$message, $history] = $this->input($request);
        if ($capped = $this->capped($request)) return $capped;

        return response()->json(['data' => $this->assistant->answer($request->user(), $message, $history)]);
    }

    /** POST /api/assistant/stream — server-sent events: `delta` (text as it is written), `replace` (the final safe text), `done`. */
    public function stream(Request $request): StreamedResponse|JsonResponse
    {
        [$message, $history] = $this->input($request);
        if ($capped = $this->capped($request)) return $capped;
        $user = $request->user();

        return response()->stream(function () use ($user, $message, $history) {
            $send = function (string $event, array $data) {
                echo "event: {$event}\ndata: ".json_encode($data, JSON_UNESCAPED_UNICODE)."\n\n";
                if (ob_get_level() > 0) @ob_flush();
                flush();
            };
            $send('meta', ['mode' => $this->assistant->mode()]);
            $result = $this->assistant->answer($user, $message, $history, $send);
            $send('done', $result);
        }, 200, ['Content-Type' => 'text/event-stream', 'Cache-Control' => 'no-cache, no-store', 'X-Accel-Buffering' => 'no']);
    }

    /** @return array{0:string, 1:list<array{role:string,text:string}>} */
    private function input(Request $request): array
    {
        abort_unless($request->user()->role === Role::Patient && $request->user()->patient !== null, 403);
        $extra = array_diff(array_keys($request->all()), ['message', 'history']);
        if ($extra) {
            throw ValidationException::withMessages([reset($extra) => 'Only a message and this chat\'s history can be sent to the assistant.']);
        }
        $max = (int) config('assistant.max_message_chars');
        $turns = (int) config('assistant.max_history_turns');
        $v = $request->validate([
            'message' => ['required', 'string', 'min:2', "max:{$max}"],
            'history' => ['sometimes', 'array', "max:{$turns}"],
            'history.*.role' => ['required_with:history', 'in:user,assistant'],
            'history.*.text' => ['required_with:history', 'string', "max:{$max}"],
        ]);
        $message = trim(preg_replace('/\s+/u', ' ', $v['message']));
        if (mb_strlen($message) < 2) throw ValidationException::withMessages(['message' => 'Type a question for the assistant.']);

        return [$message, $v['history'] ?? []];
    }

    private function capped(Request $request): ?JsonResponse
    {
        if (AssistantService::usedToday($request->user()) < (int) config('assistant.daily_cap')) return null;

        return response()->json(['message' => 'You have reached today’s limit for the assistant. You can still message the front desk.',
            'code' => 'assistant_daily_cap'], 429);
    }
}
