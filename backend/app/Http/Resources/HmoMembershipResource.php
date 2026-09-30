<?php

namespace App\Http\Resources;

use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Staff/Owner view of a Patient HMO membership row (active or ended history).
class HmoMembershipResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $iso = fn ($value) => $value ? ClinicClock::local($value)->toIso8601String() : null;

        return [
            'id' => $this->public_id,
            'status' => $this->status,
            'provider_name' => $this->provider_name,
            'member_number' => $this->member_number,
            'created_at' => $iso($this->created_at),
            'created_by' => ['name' => $this->createdBy?->person?->fullName()],
            'ended_at' => $iso($this->ended_at),
            'ended_by' => $this->ended_at ? ['name' => $this->endedBy?->person?->fullName()] : null,
        ];
    }
}
