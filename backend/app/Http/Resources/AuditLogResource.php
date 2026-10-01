<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->public_id,
            'action' => $this->action,
            'category' => $this->category,
            'severity' => $this->severity,
            'actor' => [
                'id' => $this->actor?->public_id,
                'name' => $this->actor_name,
                'role' => $this->actor_role,
            ],
            'branch' => $this->branch ? [
                'id' => $this->branch->public_id,
                'name' => $this->branch->name,
            ] : null,
            'auditable_type' => $this->auditable_type,
            'auditable_id' => $this->auditable_public_id,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'payload' => $this->payload ?? [],
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
