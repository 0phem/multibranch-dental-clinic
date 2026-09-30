<?php

namespace App\Http\Resources;

use App\Enums\Role;
use App\Models\HmoCaseRequirement;
use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// HMO case projections by role (M12). Staff (in scope) and Owner: the full case with its append-only history. Dentist
// (responsible for the Visit): a safe summary — status, provider, dates, requirement states and final outcome, without
// member number, notes, contacts or recorder identities. Patients use PatientHmoCaseResource. Amounts are decimal
// strings; ids are public ids / legacy refs only.
class HmoCaseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $iso = fn ($value) => $value ? ClinicClock::local($value)->toIso8601String() : null;
        $full = in_array($request->user()->role, [Role::Staff, Role::Owner], true);
        $visit = $this->visit;

        $body = [
            'id' => $this->public_id,
            'status' => $this->status,
            'revision' => $this->revision,
            'submission_cycle' => $this->submission_cycle,
            'provider_name' => $this->provider_name,
            'visit' => ['id' => $visit->public_id, 'clinic_date' => $visit->clinic_date->format('Y-m-d'), 'status' => $visit->status],
            'patient' => ['id' => $this->patient->public_id, 'code' => $this->patient->patient_code, 'name' => $this->patient->person?->fullName()],
            'branch' => ['id' => $this->branch->legacy_ref, 'name' => $this->branch->name],
            'dentist' => $visit->dentist ? ['id' => $visit->dentist->legacy_ref, 'name' => $visit->dentist->person?->fullName()] : null,
            'appointment' => $visit->appointment ? ['id' => $visit->appointment->public_id, 'code' => $visit->appointment->appointment_code] : null,
            'submitted_at' => $iso($this->submitted_at),
            'follow_up_due_at' => $iso($this->followUpDueAt()),
            'escalated_at' => $iso($this->escalated_at),
            'final_at' => $iso($this->final_at),
            'approved_amount' => $this->approved_amount !== null ? (string) $this->approved_amount : null,
            'requirements' => $this->requirements->map(fn ($r) => [
                'rule' => $r->rule_key, 'label' => HmoCaseRequirement::RULES[$r->rule_key], 'state' => $r->state,
            ] + ($full ? ['document_label' => $r->document_label, 'validated_at' => $iso($r->validated_at)] : []))->values()->all(),
        ];
        if ($full) {
            $body['member_number'] = $this->member_number;
            $body['created_at'] = $iso($this->created_at);
            $body['events'] = $this->events->map(fn ($e) => [
                'kind' => $e->kind, 'submission_cycle' => $e->submission_cycle, 'from_status' => $e->from_status, 'to_status' => $e->to_status,
                'method' => $e->method, 'note' => $e->note, 'next_action' => $e->next_action, 'provider_reference' => $e->provider_reference,
                'outcome' => $e->outcome, 'approved_amount' => $e->approved_amount !== null ? (string) $e->approved_amount : null,
                'rule_keys' => $e->rule_keys, 'actor' => ['role' => $e->actor_role, 'name' => $e->actor?->person?->fullName()],
                'occurred_at' => $iso($e->occurred_at),
            ])->values()->all();
        }

        return $body;
    }
}
