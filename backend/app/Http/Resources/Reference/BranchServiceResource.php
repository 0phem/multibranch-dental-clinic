<?php

namespace App\Http\Resources\Reference;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Exposes branch_ref/service_ref (both legacy_ref strings) rather than internal bigint foreign keys — see
// GET /api/branch-services in the Phase 2A plan, section H.
class BranchServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'branch_ref' => $this->branch->legacy_ref,
            'service_ref' => $this->service->legacy_ref,
            'active' => $this->active,
            'duration_override_minutes' => $this->duration_override_minutes,
        ];
    }
}
