<?php

namespace App\Http\Resources;

use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// A message as one participant sees it. The body is returned verbatim as DATA (clients render it as text, never HTML). The sender is
// shown by display name and role only — never an internal id. `mine` is derived from the authenticated viewer, not stored.
class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $m = $this->resource;
        $viewer = $this->additional['viewer'] ?? $request->user()?->id;
        $role = $m->sender->role->value;

        return [
            'id' => $m->public_id,
            'body' => $m->body,
            'sender' => ['name' => $m->sender->person?->fullName(), 'role' => ucfirst($role)],
            'mine' => $m->sender_user_id === $viewer,
            'sent_at' => ClinicClock::local($m->created_at)->toIso8601String(),
        ];
    }
}
