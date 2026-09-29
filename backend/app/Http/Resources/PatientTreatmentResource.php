<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// The Patient's own COMPLETED Treatment — exactly the approved safe subset (decision Q-T6): treatment date, procedure
// summary, performed service display names and the Dentist's display identity, plus the Treatment's own public id for
// keying. Nothing else: no Visit, appointment, branch or service identifiers, no chief complaint, plan, clinical notes,
// line notes, follow-up/prescription flags or history. Other modules' Patient views use their own projections.
class PatientTreatmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->public_id,
            'date' => $this->visit->clinic_date->format('Y-m-d'),
            'procedure_summary' => $this->procedure_summary,
            'services' => $this->procedures->map(fn ($line) => ['name' => $line->service_name])->values()->all(),
            'dentist' => ['name' => $this->dentist->person?->fullName()],
        ];
    }
}
