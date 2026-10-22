<?php

namespace App\Http\Resources;

use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// The Patient's OWN submission. Text is returned verbatim as data (clients render it as text, never HTML). The Visit is shown by its date
// and the performed service names (the same safe subset the Patient already sees in their treatment history); no status, reply or
// reviewer exists to show, and no internal id is returned.
class PatientFeedbackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $f = $this->resource;

        return [
            'id' => $f->public_id,
            'rating' => $f->rating,
            'visit' => FeedbackVisit::for($f->visit),
            'body' => $f->body,
            'submitted_at' => ClinicClock::local($f->created_at)->toIso8601String(),
        ];
    }
}
