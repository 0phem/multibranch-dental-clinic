<?php

namespace App\Events\Messaging;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * The reader's own read marker moved forward. Sent ONLY to the reader's own channel (their other tabs and devices update unread badges):
 * read state is never shown to other participants.
 */
class ReadAdvanced implements ShouldBroadcastNow
{
    public function __construct(public string $userId, public string $conversationId, public string $upTo) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.strtolower($this->userId))];
    }

    public function broadcastAs(): string
    {
        return 'read.advanced';
    }

    public function broadcastWith(): array
    {
        return ['conversation_id' => $this->conversationId, 'up_to' => $this->upTo];
    }
}
