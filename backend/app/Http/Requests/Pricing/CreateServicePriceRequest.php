<?php

namespace App\Http\Requests\Pricing;

use Illuminate\Foundation\Http\FormRequest;

// A new price version. The amount is decimal TEXT ("1500.00", at most 2 decimals, > 0) so it never passes through a
// binary float. Source, actor and retraction fields are server-assigned and refused if supplied.
class CreateServicePriceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'branch_ref' => ['nullable', 'string', 'exists:branches,legacy_ref'],
            'kind' => ['required', 'in:priced,ended'],
            'amount' => ['required_if:kind,priced', 'prohibited_if:kind,ended', 'nullable', 'string', 'regex:/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/', 'not_regex:/^0(\.0{1,2})?$/'],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'source' => ['prohibited'],
            'created_by_user_id' => ['prohibited'],
            'retracted_at' => ['prohibited'],
            'status' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.regex' => 'Enter the amount as a peso value with at most two decimals, for example 1500.00.',
            'amount.not_regex' => 'A confirmed price must be greater than zero.',
        ];
    }
}
