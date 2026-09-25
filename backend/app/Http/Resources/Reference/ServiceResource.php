<?php

namespace App\Http\Resources\Reference;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// reference_fee_php is deliberately exposed as-is with no companion "confirmed" flag — it is project/
// demo/reference configuration only, never clinic-confirmed pricing (Phase 2A plan, section F).
class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->legacy_ref,
            'code' => $this->code,
            'name' => $this->name,
            'duration_minutes' => $this->duration_minutes,
            'reference_fee_php' => $this->reference_fee_php !== null ? (float) $this->reference_fee_php : null,
            'category' => $this->category,
            'status' => $this->status,
        ];
    }
}
