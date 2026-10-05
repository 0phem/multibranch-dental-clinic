<?php

namespace App\Http\Resources;

use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Conversation SUMMARY: deliberately carries no message text (lists must not leak bodies). `unread` counts other participants'
// messages this account has not yet opened, in this application only. `participants` are the OTHER participants by display name and role.
class ConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $c = $this->resource;
        $me = $request->user()->id;
        $iso = fn ($v) => $v ? ClinicClock::local($v instanceof \DateTimeInterface ? $v : \Carbon\CarbonImmutable::parse($v))->toIso8601String() : null;

        return [
            'id' => $c->public_id,
            'context' => $c->context,
            'status' => $c->status,
            'revision' => $c->revision,
            'patient' => ['id' => $c->patient->public_id, 'code' => $c->patient->patient_code, 'name' => $c->patient->person?->fullName()],
            'branch' => ['id' => $c->branch->legacy_ref, 'name' => $c->branch->name],
            'participants' => $c->participants->filter(fn ($p) => $p->user_id !== $me)->map(fn ($p) => ['name' => $p->user->person?->fullName(), 'role' => ucfirst($p->user->role->value)])->values()->all(),
            'unread' => (int) ($c->unread_count ?? 0),
            'last_message_at' => $iso($c->last_message_at ?? null),
            'closed_at' => $iso($c->closed_at),
        ];
    }
}
