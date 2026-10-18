<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** F3: "An earlier time is available" sent to one patient for one opening. The first acceptance wins. */
class SlotOffer extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['offered_at' => 'immutable_datetime', 'closed_at' => 'immutable_datetime', 'appointment_revision' => 'integer'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function opening(): BelongsTo { return $this->belongsTo(SlotOpening::class, 'slot_opening_id'); }

    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }
}
