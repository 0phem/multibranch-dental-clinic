<?php

namespace App\Http\Requests\Messaging;

// A Patient's first message to a branch front desk: the same message rules as a send, plus the chosen branch (public id). Everything
// else (Patient, participants, status, context) is server context and refused if supplied.
class StartConversationRequest extends SendMessageRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['branch_id'] = ['required', 'string', 'size:26'];
        foreach (['context', 'participants', 'assigned_user_id', 'patient', 'dentist_id'] as $field) $rules[$field] = ['prohibited'];

        return $rules;
    }
}
