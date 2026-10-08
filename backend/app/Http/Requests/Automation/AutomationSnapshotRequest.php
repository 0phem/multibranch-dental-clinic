<?php

namespace App\Http\Requests\Automation;

use App\Models\Branch;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

// M23 monitor query: an optional branch, resolved through the M2 reference contract (public ULID or legacy_ref). The former
// (int) cast turned "b1" into 0 and silently returned all-branch figures; an unresolvable value is now a 422.
class AutomationSnapshotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['branch_id' => ['nullable', 'string', 'max:64']];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $ref = $this->input('branch_id');
            if (is_string($ref) && $ref !== '' && strtolower($ref) !== 'all' && ! Branch::fromPublicReference($ref)) {
                $v->errors()->add('branch_id', 'Choose an existing branch.');
            }
        });
    }

    public function branch(): ?Branch
    {
        $ref = $this->input('branch_id');

        return is_string($ref) && $ref !== '' && strtolower($ref) !== 'all' ? Branch::fromPublicReference($ref) : null;
    }
}
