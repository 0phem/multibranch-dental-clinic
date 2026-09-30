<?php

namespace App\Http\Resources;

use App\Models\HmoCaseRequirement;
use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// The Patient's own HMO case, safe subset (M12): provider, masked member number, the visit's date and their own appointment,
// status, requirement states, submission / final dates, the final outcome and the approved amount when Approved.
// Never Staff notes, contacts, provider references, recorder identities or the event history.
class PatientHmoCaseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $iso = fn ($value) => $value ? ClinicClock::local($value)->toIso8601String() : null;

        return [
            'id' => $this->public_id,
            'status' => $this->status,
            'provider_name' => $this->provider_name,
            'member_number' => $this->membership->maskedMemberNumber(),
            'visit_date' => $this->visit->clinic_date->format('Y-m-d'),
            // The Patient's own appointment (public id + code) so their Visits view can show this case beside it.
            'appointment' => $this->visit->appointment ? ['id' => $this->visit->appointment->public_id, 'code' => $this->visit->appointment->appointment_code] : null,
            'branch' => ['name' => $this->branch->name],
            'requirements' => $this->requirements->map(fn ($r) => ['rule' => $r->rule_key, 'label' => HmoCaseRequirement::RULES[$r->rule_key], 'state' => $r->state])->values()->all(),
            'submitted_at' => $iso($this->submitted_at),
            'final_at' => $iso($this->final_at),
            'approved_amount' => $this->status === 'Approved' ? (string) $this->approved_amount : null,
        ];
    }
}
