<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** F3: a time that became free. Offered, never held (App\Services\Automations\FillFreedSlots). */
class SlotOpening extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['starts_at' => 'immutable_datetime', 'ends_at' => 'immutable_datetime', 'offers_sent_at' => 'immutable_datetime',
            'waitlist_at' => 'immutable_datetime', 'closed_at' => 'immutable_datetime', 'appointment_revision' => 'integer'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }

    public function dentist(): BelongsTo { return $this->belongsTo(DentistProfile::class, 'dentist_profile_id'); }

    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }

    public function offers(): HasMany { return $this->hasMany(SlotOffer::class); }

    public function minutes(): int { return (int) $this->starts_at->diffInMinutes($this->ends_at, true); }

    public function dateString(): string { return substr((string) $this->clinic_date, 0, 10); }
}
