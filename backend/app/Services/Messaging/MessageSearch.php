<?php

namespace App\Services\Messaging;

use App\Models\ConversationMessage;
use Illuminate\Database\Eloquent\Builder;

/** Search encrypted bodies without creating a plaintext index, cache or transcript. */
final class MessageSearch
{
    public static function contains(?string $text, string $term): bool
    {
        return mb_stripos($text ?? '', $term, 0, 'UTF-8') !== false;
    }

    /** Only messages belonging to the caller's already-authorized conversation query are decrypted. */
    public static function conversationIds(Builder $visible, string $term): array
    {
        $ids = [];
        $messages = ConversationMessage::whereIn('conversation_id', (clone $visible)->reorder()->select('conversations.id'));
        foreach ($messages->lazyById(200) as $message) {
            if (!isset($ids[$message->conversation_id]) && self::contains($message->body, $term)) {
                $ids[$message->conversation_id] = true;
            }
        }
        return array_keys($ids);
    }
}
