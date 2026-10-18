<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** What a Patient answered about an appointment (F1–F3). Append-only; `link_hash` makes an email link single-use. */
class AppointmentResponse extends Model
{
    public const UPDATED_AT = null;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['created_at' => 'immutable_datetime', 'appointment_revision' => 'integer'];
    }

    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }
}
