<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A2 "possible no-show" hint for the front desk; it never changes the appointment by itself. */
class NoShowFlag extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['flagged_at' => 'immutable_datetime', 'resolved_at' => 'immutable_datetime', 'appointment_revision' => 'integer'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
}
