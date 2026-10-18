<?php

namespace App\Http\Resources\Reference;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// M13 contract correction: the Service projection carries NO fee. `services.reference_fee_php` is project/demo/reference data,
// never clinic-confirmed pricing, and no current production consumer needs it; exposing it beside authoritative
// service_prices (and as a JSON float) invited use as a price. Authoritative prices come only from the M13 pricing API.
class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->legacy_ref,
            'code' => $this->code,
            'name' => $this->name,
            'duration_minutes' => $this->duration_minutes,
            'category' => $this->category,
            'description' => $this->description,
            'status' => $this->status,
            // F7 (R2-17): bookable online, consultation first (books the linked consultation instead) or hidden online.
            'online_booking' => $this->online_booking ?? 'bookable',
            'consultation_service_id' => $this->consultation_service_id ? \App\Models\Service::whereKey($this->consultation_service_id)->value('legacy_ref') : null,
        ];
    }
}
