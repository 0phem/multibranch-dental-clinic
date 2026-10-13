<?php

namespace App\Services\Messaging;

use Illuminate\Support\Facades\DB;

// M17 realtime: an event is broadcast only AFTER the database transaction that made the change commits (never for a rolled-back change,
// never twice for an idempotent replay because the replay does not run the command). A broadcast failure (Reverb stopped) is reported
// and never fails the request — clients fall back to polling the same endpoints.
final class RealtimeEvents
{
    public static function afterCommit(object $event): void
    {
        DB::afterCommit(function () use ($event) {
            try {
                event($event); // ShouldBroadcastNow: the dispatcher broadcasts it synchronously (and Event::fake can observe it in tests)
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Realtime broadcast failed.', ['event' => $event::class, 'exception' => $e::class]);
            }
        });
    }
}
