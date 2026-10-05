<?php

namespace App\Services\Messaging;

use App\Enums\Role;
use App\Http\Resources\MessageResource;
use App\Models\CommandKey;
use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\ConversationParticipant;
use App\Models\User;
use App\Services\Visits\VisitCommandException;
use App\Support\ClinicClock;
use App\Support\IdempotentCommand;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;

// M17 named commands. Human, in-app only: nothing here sends SMS/e-mail/social messages, produces a notification, calls an AI or
// reads a delivery receipt. The sender is always the authenticated account; every command re-checks access under the conversation lock.
//   send:  a participant posts a message to an OPEN conversation (Idempotency-Key required: a retry never posts twice).
//   read:  records that THIS participant has opened the conversation up to a message they name (in-application read state only). The
//          message must belong to THIS conversation, and the marker only ever moves FORWARD (a stale request cannot make read messages unread).
//   close: Staff or Dentist participants end the conversation. There is no reopen (no policy) and no Patient close.
final class MessagingService
{
    private const ATTEMPTS = 3;

    public function send(User $actor, Conversation $conversation, string $body, string $key): JsonResponse
    {
        $payload = ['conversation' => $conversation->id, 'body' => $body];

        return IdempotentCommand::run(
            CommandKey::class, $actor, $key, 'conversation.send', $payload,
            function () use ($actor, $conversation, $body) {
                $current = $this->lock($actor, $conversation);
                if ($current->status !== 'Open') {
                    throw VisitCommandException::rule('conversation_closed', 'This conversation is closed and cannot receive new messages.', 'conversation');
                }
                $message = ConversationMessage::create(['conversation_id' => $current->id, 'sender_user_id' => $actor->id, 'body' => $body, 'created_at' => ClinicClock::now()]);
                // Sending a message means the sender has seen everything up to it.
                ConversationParticipant::where('conversation_id', $current->id)->where('user_id', $actor->id)->update(['last_read_message_id' => $message->id, 'last_read_at' => ClinicClock::now()]);

                return [(new MessageResource($message->load('sender.person')))->additional(['viewer' => $actor->id])->response()->getData(true), 201];
            },
            fn () => VisitCommandException::rule('idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'idempotency_key'),
            fn (QueryException $e) => in_array($e->getCode(), ['40P01', '40001'], true) ? throw new VisitCommandException(409, 'conflict', 'Another request changed this conversation at the same time. Try again.') : null,
            self::ATTEMPTS,
        );
    }

    /**
     * Moves the actor's own read marker forward to the named message (public id). A message that is not in THIS conversation — foreign,
     * unknown or malformed — is refused with the same answer in every case, so nothing about another conversation is revealed. Ordering
     * is the serial id (never a timestamp). A marker at or behind the current one changes nothing. Reading a closed conversation is allowed.
     */
    public function markRead(User $actor, Conversation $conversation, string $upToPublicId): void
    {
        $this->inTransaction(function () use ($actor, $conversation, $upToPublicId) {
            $current = $this->lock($actor, $conversation);
            $target = ConversationMessage::where('conversation_id', $current->id)->where('public_id', strtolower($upToPublicId))->value('id');
            if ($target === null) {
                throw VisitCommandException::rule('message_not_in_conversation', 'Choose a message from this conversation.', 'up_to');
            }
            ConversationParticipant::where('conversation_id', $current->id)->where('user_id', $actor->id)
                ->where(fn ($q) => $q->whereNull('last_read_message_id')->orWhere('last_read_message_id', '<', $target))
                ->update(['last_read_message_id' => $target, 'last_read_at' => ClinicClock::now()]);
        });
    }

    public function close(User $actor, Conversation $conversation, int $expectedRevision, string $key): JsonResponse
    {
        $payload = ['conversation' => $conversation->id, 'expected_revision' => $expectedRevision];

        return IdempotentCommand::run(
            CommandKey::class, $actor, $key, 'conversation.close', $payload,
            function () use ($actor, $conversation, $expectedRevision) {
                if (! in_array($actor->role, [Role::Staff, Role::Dentist], true)) {
                    throw new VisitCommandException(403, 'forbidden', 'Only clinic participants can close a conversation.');
                }
                $current = $this->lock($actor, $conversation);
                if ($current->status === 'Closed') {
                    return [['data' => ['id' => $current->public_id, 'status' => 'Closed', 'revision' => $current->revision]], 200];
                }
                if ($current->revision !== $expectedRevision) {
                    throw new VisitCommandException(409, 'stale_revision', 'This conversation changed after it was opened. Reload it before trying again.');
                }
                $current->update(['status' => 'Closed', 'revision' => $current->revision + 1, 'closed_at' => ClinicClock::now(), 'closed_by_user_id' => $actor->id]);

                return [['data' => ['id' => $current->public_id, 'status' => 'Closed', 'revision' => $current->revision]], 200];
            },
            fn () => VisitCommandException::rule('idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'idempotency_key'),
            null,
            self::ATTEMPTS,
        );
    }

    private function inTransaction(Closure $work): void
    {
        \Illuminate\Support\Facades\DB::transaction($work, self::ATTEMPTS);
    }

    /** Locks the conversation and re-checks access (participant + role link) under the lock. */
    private function lock(User $actor, Conversation $conversation): Conversation
    {
        $current = Conversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
        if (! $current->accessibleTo($actor)) {
            throw new VisitCommandException(403, 'forbidden', 'This conversation is outside your access.');
        }

        return $current;
    }
}
