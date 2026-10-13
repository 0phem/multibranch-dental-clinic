<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only record of one send attempt (database trigger refuses UPDATE/DELETE). */
class MailDispatchAttempt extends Model
{
    public $timestamps = false;

    // timestamptz columns: always write the offset, so an instant never shifts with the PHP/session time zone.
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['started_at' => 'immutable_datetime', 'finished_at' => 'immutable_datetime'];
    }
}
