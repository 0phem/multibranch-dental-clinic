<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Append-only (a database trigger rejects UPDATE/DELETE) — see the create_appointment_history_table migration.
class AppointmentHistory extends Model
{
    protected $table = 'appointment_history';

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'occurred_at' => 'immutable_datetime',
            'revision' => 'integer',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }
}
