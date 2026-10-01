<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PatientConsentResource extends JsonResource
{
    public function toArray($request): array
    {
        $c = $this->resource;
        return [
            'id' => $c->public_id,
            'patient_id' => $c->patient?->public_id,
            'document_id' => $c->document?->public_id,
            'consent_type' => $c->consent_type,
            'version' => $c->version,
            'status' => $c->status,
            'notes' => $c->notes,
            'signed_at' => $c->signed_at?->toIso8601String(),
            'withdrawn_at' => $c->withdrawn_at?->toIso8601String(),
            'recorded_by' => $c->recordedBy ? [
                'id' => $c->recordedBy->public_id,
                'name' => $c->recordedBy->person?->fullName() ?? $c->recordedBy->name,
                'role' => $c->recordedBy->role?->value,
            ] : null,
            'created_at' => $c->created_at?->toIso8601String(),
        ];
    }
}
