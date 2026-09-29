<?php

namespace App\Http\Resources;

use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Public Visit shape. `id`, `patient.id` and `appointment.id` are ULID public_ids (bigints never leave the server).
// Timestamps are ISO-8601 with an explicit +08:00 offset; `clinic_date` is the Asia/Manila business date of arrival.
// Branch/service/Dentist use their transitional legacy_ref ids, matching the Phase 2A reference API. `service` is the
// appointment's service for a scheduled Visit and the requested service for a walk-in (null when none was given).
class VisitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $iso = fn ($value) => $value ? ClinicClock::local($value)->toIso8601String() : null;
        $service = $this->appointment?->service ?? $this->requestedService;
        $appointment = $this->appointment;

        return [
            'id' => $this->public_id,
            'source' => $this->source,
            'status' => $this->status,
            'revision' => $this->revision,
            'arrived_at' => $iso($this->arrived_at),
            'clinic_date' => $this->clinic_date->format('Y-m-d'),
            'closed_at' => $iso($this->closed_at),
            'patient' => ['id' => $this->patient->public_id, 'code' => $this->patient->patient_code, 'name' => $this->patient->person?->fullName()],
            'branch' => ['id' => $this->branch->legacy_ref, 'name' => $this->branch->name],
            'dentist' => $this->dentist ? ['id' => $this->dentist->legacy_ref, 'name' => $this->dentist->person?->fullName()] : null,
            'service' => $service ? ['id' => $service->legacy_ref, 'name' => $service->name] : null,
            'appointment' => $appointment ? [
                'id' => $appointment->public_id,
                'code' => $appointment->appointment_code,
                'status' => $appointment->status,
                'revision' => $appointment->revision,
                'date' => ClinicClock::local($appointment->starts_at)->toDateString(),
                'start_time' => ClinicClock::local($appointment->starts_at)->format('H:i'),
            ] : null,
            'created_at' => $iso($this->created_at),
            'updated_at' => $iso($this->updated_at),
            'history' => $this->whenLoaded('history', fn () => $this->history->map(fn ($h) => [
                'event' => $h->event,
                'from_status' => $h->from_status,
                'to_status' => $h->to_status,
                'revision' => $h->revision,
                'actor_role' => $h->actor_role,
                'occurred_at' => $iso($h->occurred_at),
            ])),
        ];
    }
}
