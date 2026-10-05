<?php

namespace App\Http\Requests\Treatment;

use Illuminate\Foundation\Http\FormRequest;

// Treatment start / complete. The target status comes from the named command, never the client. For start the
// expected_revision is the Visit's; for complete it is the Treatment's.
class TreatmentCommandRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'status' => ['prohibited'],
            // Identity, ownership, state, clocks, money and audit fields are server context: supplying one is refused, never ignored.
            ...array_fill_keys(['patient_id', 'branch_id', 'branch_ref', 'started_at', 'completed_at', 'dentist_ref', 'visit_id', 'dentist_id', 'dentist_profile_id', 'assistant_ref', 'id', 'public_id', 'revision',
                'created_by_user_id', 'updated_by_user_id', 'reviewed_by', 'billing_status', 'invoice_id', 'price', 'amount', 'fee', 'total', 'history', 'audit'], ['prohibited']),
        ];
    }
}
