<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

// Replaces a Staff account's full set of authorization branch scopes (zero, one or many). Branches are named by their
// transitional legacy_ref, like every other branch reference in the API; repeated branches in one request are
// rejected rather than silently merged.
class SetBranchScopesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'branch_refs' => ['present', 'array'],
            'branch_refs.*' => ['required', 'string', 'distinct', 'exists:branches,legacy_ref'],

            'user_id' => ['prohibited'],
            'branch_ids' => ['prohibited'],
        ];
    }
}
