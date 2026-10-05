<?php

namespace App\Http\Resources;

use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Staff-facing inquiry. `id` is the ULID public id; branch uses its transitional legacy_ref (internal operational reference, never
// shown to external inquirers). The text fields are returned VERBATIM as data — clients must render them as text, never as HTML.
// `capture` states provenance honestly: the source is what Staff reported; nothing was fetched from or sent to any platform.
class InquiryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $iso = fn ($value) => $value ? ClinicClock::local($value)->toIso8601String() : null;
        $i = $this->resource;
        $body = [
            'id' => $i->public_id,
            'source' => $i->source,
            'capture' => 'Recorded manually by Staff',
            'contact' => ['name' => $i->contact_name, 'detail' => $i->contact_detail],
            'topic' => $i->topic,
            'status' => $i->status,
            'revision' => $i->revision,
            'branch' => ['id' => $i->branch->legacy_ref, 'name' => $i->branch->name],
            'assigned' => ['name' => $i->assignee?->person?->fullName()],
            'patient' => $i->patient ? ['id' => $i->patient->public_id, 'code' => $i->patient->patient_code, 'name' => $i->patient->person?->fullName()] : null,
            'appointment' => $i->appointment ? ['id' => $i->appointment->public_id, 'code' => $i->appointment->appointment_code] : null,
            'received_at' => $iso($i->received_at),
            'responded_at' => $iso($i->responded_at),
            'closed_at' => $iso($i->closed_at),
            'converted_at' => $iso($i->converted_at),
        ];
        if ($i->relationLoaded('history')) {
            $body['history'] = $i->history->map(fn ($h) => ['event' => $h->event, 'from_status' => $h->from_status, 'to_status' => $h->to_status, 'actor_role' => $h->actor_role, 'occurred_at' => $iso($h->occurred_at)])->values()->all();
        }

        return $body;
    }
}
