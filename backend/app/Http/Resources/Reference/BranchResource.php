<?php

namespace App\Http\Resources\Reference;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Exposes legacy_ref as the resource's `id` — the internal bigint primary key never reaches the client
// (Phase 2A plan, section C/D).
class BranchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->legacy_ref,
            'branch_code' => $this->branch_code,
            'name' => $this->name,
            'city' => $this->city,
            'address' => $this->address,
            'phone' => $this->phone,
            'open_time' => $this->open_time,
            'close_time' => $this->close_time,
            'status' => $this->status,
            'capacity_threshold' => $this->capacity_threshold,
            'latitude' => $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->longitude !== null ? (float) $this->longitude : null,
        ];
    }
}
