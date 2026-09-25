<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** The separate Owner User Management projection. It never exposes password, title or account status. */
class UserAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'person_id' => $this->person_id,
            'name' => $this->person?->fullName() ?? '',
            'first_name' => $this->person?->first_name,
            'last_name' => $this->person?->last_name,
            'email' => $this->email,
            'phone' => $this->person?->phone,
            'role' => $this->role->value,
        ];
    }
}
