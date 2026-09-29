<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Idempotency record for the M8 commands (Visit Check-In, Walk-In, Visit transitions, front-desk Patient
// registration) — see the create_visits_table migration and App\Support\IdempotentCommand.
class CommandKey extends Model
{
    public const UPDATED_AT = null;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'response_body' => 'array',
            'response_status' => 'integer',
        ];
    }
}
