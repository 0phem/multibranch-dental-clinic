<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Requests\Messaging\CloseConversationRequest;
use App\Http\Requests\Messaging\SendMessageRequest;
use App\Http\Resources\ConversationResource;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Services\Messaging\MessagingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// M17 API (route middleware role:patient,staff,dentist; Owner and guests have none). Authorization is Conversation::visibleTo applied
// BEFORE any cursor or filter; there is no conversation-creation, edit-message or delete-message route.
class ConversationController extends Controller
{
    use ReadsIdempotencyKey;

    private const MAX_PER_PAGE = 100;

    public function __construct(private readonly MessagingService $messaging) {}

    /** The viewer's conversations, newest-created first (keyset by id), with an unread count and no message text. */
    public function index(Request $request): JsonResponse
    {
        $v = $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE], 'cursor' => ['nullable', 'string', 'size:26'], 'status' => ['nullable', 'string', 'in:Open,Closed']]);
        $per = (int) ($v['per_page'] ?? 50);
        $user = $request->user();
        $query = $this->summaries($user)->visibleTo($user);
        if (! empty($v['status'])) {
            $query->where('status', $v['status']);
        }
        if (! empty($v['cursor'])) {
            $query->where('id', '<', Conversation::visibleTo($user)->select('id')->where('public_id', strtolower($v['cursor']))->limit(1));
        }
        $rows = $query->with(['patient.person', 'branch', 'participants.user.person'])->orderByDesc('id')->limit($per + 1)->get();
        $page = $rows->take($per)->values();

        return response()->json(['data' => ConversationResource::collection($page)->resolve($request), 'meta' => ['per_page' => $per, 'next_cursor' => $rows->count() > $per ? $page->last()->public_id : null]]);
    }

    /** Authoritative in-application counts for the viewer (a genuine zero is a zero; the client must treat a failure as unavailable). */
    public function summary(Request $request): JsonResponse
    {
        $rows = $this->summaries($request->user())->visibleTo($request->user())->get(['conversations.id', 'conversations.status']);

        return response()->json(['data' => ['conversations' => $rows->count(), 'open' => $rows->where('status', 'Open')->count(), 'unread_conversations' => $rows->filter(fn ($c) => (int) $c->unread_count > 0)->count()]]);
    }

    public function show(Request $request, Conversation $conversation): ConversationResource
    {
        abort_unless($conversation->accessibleTo($request->user()), 403);
        $conversation = $this->summaries($request->user())->with(['patient.person', 'branch', 'participants.user.person'])->findOrFail($conversation->id);

        return new ConversationResource($conversation);
    }

    /** Messages newest first (keyset by serial id — a deterministic order, the cursor is the oldest message public id returned). */
    public function messages(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->accessibleTo($request->user()), 403);
        $v = $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE], 'cursor' => ['nullable', 'string', 'size:26']]);
        $per = (int) ($v['per_page'] ?? 30);
        $query = ConversationMessage::where('conversation_id', $conversation->id);
        if (! empty($v['cursor'])) {
            // The cursor is looked up inside THIS conversation only: a message from elsewhere reveals nothing.
            $query->where('id', '<', ConversationMessage::where('conversation_id', $conversation->id)->select('id')->where('public_id', strtolower($v['cursor']))->limit(1));
        }
        $rows = $query->with('sender.person')->orderByDesc('id')->limit($per + 1)->get();
        $page = $rows->take($per)->values();

        return response()->json(['data' => MessageResource::collection($page)->resolve($request), 'meta' => ['per_page' => $per, 'next_cursor' => $rows->count() > $per ? $page->last()->public_id : null]]);
    }

    public function send(SendMessageRequest $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->accessibleTo($request->user()), 403);

        return $this->messaging->send($request->user(), $conversation, $request->validated('body'), $this->idempotencyKey($request, true));
    }

    public function read(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->accessibleTo($request->user()), 403);
        $v = $request->validate([
            'up_to' => ['required', 'string', 'size:26'],
            ...array_fill_keys(['body', 'read_at', 'message_id', 'last_read_message_id', 'user_id', 'participant', 'participant_id', 'seen_at', 'delivered_at', 'status'], ['prohibited']),
        ]);
        $this->messaging->markRead($request->user(), $conversation, $v['up_to']);

        return response()->json(['data' => ['id' => $conversation->public_id, 'read' => true]]);
    }

    public function close(CloseConversationRequest $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->accessibleTo($request->user()), 403);

        return $this->messaging->close($request->user(), $conversation, (int) $request->validated('expected_revision'), $this->idempotencyKey($request, true));
    }

    /** Adds the viewer's unread count and the latest message time (no message text) to a conversation query. */
    private function summaries($user)
    {
        return Conversation::query()
            ->select('conversations.*')
            ->selectSub(DB::table('conversation_messages as m')->selectRaw('count(*)')->whereColumn('m.conversation_id', 'conversations.id')->where('m.sender_user_id', '<>', $user->id)
                ->whereRaw('m.id > coalesce((select p.last_read_message_id from conversation_participants p where p.conversation_id = conversations.id and p.user_id = ?), 0)', [$user->id]), 'unread_count')
            ->selectSub(DB::table('conversation_messages as m2')->selectRaw('max(m2.created_at)')->whereColumn('m2.conversation_id', 'conversations.id'), 'last_message_at');
    }
}
