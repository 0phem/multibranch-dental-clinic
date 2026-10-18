<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A5: a Patient waiting to hear that a time opened on a fully booked day. No slot is held. */
class WaitlistEntry extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['notified_at' => 'immutable_datetime', 'closed_at' => 'immutable_datetime'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function patient(): BelongsTo { return $this->belongsTo(Patient::class); }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }

    public function service(): BelongsTo { return $this->belongsTo(Service::class); }

    public function dentist(): BelongsTo { return $this->belongsTo(DentistProfile::class, 'dentist_profile_id'); }

    /** The clinic date as Y-m-d (kept as the plain date string: no time zone conversion). */
    public function dateString(): string
    {
        return substr((string) $this->clinic_date, 0, 10);
    }
}
