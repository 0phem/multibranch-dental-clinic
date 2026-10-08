<?php

namespace App\Http\Requests\Automation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

// Manual dispatch records an EVALUATION of one rule against an Owner-typed observation. It is not an event from the
// domain: it can never carry a Dentist's clinical decision, a Patient, a payment or HMO response, or another actor. Each
// rule accepts only its own observation fields; anything else (including clinical follow-up / prescription flags) is a 422.
class DispatchAutomationRequest extends FormRequest
{
    /** rule_code => [field => validation rules]; fields not listed are refused. `diagnostic_check` is always allowed. */
    public const OBSERVATIONS = [
        'R1_APPT_LIFECYCLE' => ['action_type' => ['required', 'string', 'in:created,moved,cancelled']],
        'R2_HMO_FOLLOWUP_REMINDER' => ['pending_hours' => ['required', 'integer', 'between:0,8760']],
        'R3_CAPACITY_ALERT' => ['estimated_wait_minutes' => ['required', 'integer', 'between:0,1440']],
        'R4_TREATMENT_DOWNSTREAM' => [],
        'R5_MESSAGE_ROUTING' => [],
        'R6_USER_PROFILE_SYNC' => [],
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = [
            'rule_code' => ['required', 'string', 'exists:workflow_rules,rule_code'],
            'payload' => ['nullable', 'array'],
            'payload.diagnostic_check' => ['sometimes', 'boolean'],
        ];
        $code = $this->input('rule_code');
        foreach (self::OBSERVATIONS[is_string($code) ? $code : ''] ?? [] as $field => $fieldRules) {
            $rules["payload.{$field}"] = $fieldRules;
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            foreach (array_keys($this->all()) as $key) {
                if (! in_array($key, ['rule_code', 'payload'], true)) {
                    $v->errors()->add((string) $key, 'This field is not accepted.');
                }
            }
            $code = $this->input('rule_code');
            $payload = $this->input('payload');
            if (! is_string($code) || ! is_array($payload)) {
                return;
            }
            $allowed = array_merge(['diagnostic_check'], array_keys(self::OBSERVATIONS[$code] ?? []));
            foreach (array_keys($payload) as $key) {
                if (! in_array($key, $allowed, true)) {
                    $clinical = in_array($key, ['followup_required', 'prescription_required'], true);
                    $v->errors()->add("payload.{$key}", $clinical
                        ? 'Clinical follow-up and prescription flags cannot be supplied manually; they exist only on a Dentist-documented Treatment.'
                        : 'This field is not accepted for this rule.');
                }
            }
        });
    }
}
