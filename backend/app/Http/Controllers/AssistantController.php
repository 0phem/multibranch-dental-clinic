<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Services\Assistant\AssistantException;
use App\Services\Assistant\AssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// M7 Patient assistant: Patient-only, stateless and read-only. The Patient is the authenticated account; no identifier of any
// kind is accepted from the client — the only input is the message text.
class AssistantController extends Controller
{
    public function __construct(private readonly AssistantService $assistant) {}

    public function ask(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === Role::Patient && $request->user()->patient !== null, 403);
        $extra = array_diff(array_keys($request->all()), ['message']);
        if ($extra) {
            throw ValidationException::withMessages([reset($extra) => 'Only a message can be sent to the assistant.']);
        }
        $max = (int) config('assistant.max_message_chars');
        $validated = $request->validate(['message' => ['required', 'string', 'min:2', "max:{$max}"]]);
        $message = trim(preg_replace('/\s+/u', ' ', $validated['message']));
        if (mb_strlen($message) < 2) {
            throw ValidationException::withMessages(['message' => 'Type a question for the assistant.']);
        }

        try {
            return response()->json(['data' => $this->assistant->answer($message)]);
        } catch (AssistantException $e) {
            return response()->json($e->responseBody(), $e->getStatusCode());
        }
    }
}
