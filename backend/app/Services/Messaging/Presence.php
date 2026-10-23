<?php

namespace App\Services\Messaging;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

// M17 "is this person in the app right now?" — used only to decide whether a new-message email alert is needed. A signed-in tab sends a
// heartbeat (POST /api/conversations/presence) while visible, and every messaging request counts too. Online = seen within
// messaging.online_seconds (default 90 s). Nothing about presence is ever shown to another person.
final class Presence
{
    public static function touch(User $user): void
    {
        try {
            Cache::put(self::key($user), now()->getTimestamp(), max(30, (int) config('messaging.online_seconds', 90)));
        } catch (\Throwable) {
            // Presence is best-effort for email alert suppression and must never fail a messaging request.
        }
    }

    public static function isOnline(User $user): bool
    {
        try {
            $seen = Cache::get(self::key($user));

            return is_int($seen) && $seen >= now()->getTimestamp() - max(30, (int) config('messaging.online_seconds', 90));
        } catch (\Throwable) {
            return false;
        }
    }

    private static function key(User $user): string
    {
        return 'm17:presence:'.$user->id;
    }
}
