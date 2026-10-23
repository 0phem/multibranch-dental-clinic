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
        $role = $m->sender?->role?->value ?? 'staff';
        $sentAt = $m->created_at instanceof \DateTimeInterface
            ? $m->created_at
            : \Carbon\CarbonImmutable::parse((string) $m->created_at);

        // `without_body`: the copy kept in an idempotency record must not hold the text (encryption at rest); the service re-attaches it.
        return array_filter([
            'id' => $m->public_id,
            'body' => ($this->additional['without_body'] ?? false) ? null : $m->body,
            'sender' => ['name' => $m->sender?->person?->fullName(), 'role' => ucfirst($role)],
            'mine' => $m->sender_user_id === $viewer,
            'sent_at' => ClinicClock::local($sentAt)->toIso8601String(),
        ], fn ($value, $key) => $key !== 'body' || $value !== null, ARRAY_FILTER_USE_BOTH);
    }
}
