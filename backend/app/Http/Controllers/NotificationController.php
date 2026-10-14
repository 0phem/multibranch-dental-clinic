<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The signed-in user's own notifications (identity-specific; never anyone else's). */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = UserNotification::where('user_id', $user->id)->orderByDesc('id')->limit(50)->get();

        return response()->json([
            'data' => $rows->map(fn (UserNotification $n) => [
                'id' => $n->public_id, 'kind' => $n->kind, 'title' => $n->title, 'body' => $n->body,
                'target' => $n->target_page ? ['page' => $n->target_page, 'id' => $n->target_id] : null,
                'created_at' => $n->created_at ? \App\Support\ClinicClock::local($n->created_at)->toIso8601String() : null, 'read' => $n->read_at !== null,
            ])->values(),
            'meta' => ['unread' => UserNotification::where('user_id', $user->id)->whereNull('read_at')->count()],
        ]);
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        $updated = UserNotification::where('user_id', $request->user()->id)->where('public_id', strtolower($notification))->whereNull('read_at')->update(['read_at' => now()]);
        abort_if(! $updated && ! UserNotification::where('user_id', $request->user()->id)->where('public_id', strtolower($notification))->exists(), 404);

        return $this->index($request);
    }

    public function readAll(Request $request): JsonResponse
    {
        UserNotification::where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);

        return $this->index($request);
    }
}
