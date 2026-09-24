<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Safe frontend identity/context only. Never includes password, password hash, remember_token, or any other
// internal security field — see backend/README.md's API contract section.
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'person_id' => $this->person_id,
            'patient_id' => $this->patient?->id,
            'name' => $this->name(),
            // Already-stored, already-safe Person fields (Backend Foundation 1B): let a frontend identity
            // bridge build a real local Person/Patient projection instead of parsing the derived `name` string.
            'first_name' => $this->person?->first_name,
            'middle_name' => $this->person?->middle_name,
            'last_name' => $this->person?->last_name,
            'phone' => $this->person?->phone,
            'date_of_birth' => $this->person?->date_of_birth?->toDateString(),
            'email' => $this->email,
            'role' => $this->role->value,
            'title' => $this->title,
            'account_status' => $this->account_status,
        ];
    }
}
