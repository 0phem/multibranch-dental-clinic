<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Idempotency record for M6 commands — see the create_appointment_command_keys_table migration.
class AppointmentCommandKey extends Model
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
