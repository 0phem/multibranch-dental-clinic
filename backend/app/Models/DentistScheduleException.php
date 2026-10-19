<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** M3: one date off (every branch) or custom hours at one branch for a dentist. */
class DentistScheduleException extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function dentist(): BelongsTo { return $this->belongsTo(DentistProfile::class, 'dentist_profile_id'); }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }

    public function dateString(): string { return substr((string) $this->on_date, 0, 10); }
}
