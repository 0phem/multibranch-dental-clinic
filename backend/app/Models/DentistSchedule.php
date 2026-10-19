<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** M3: a dentist's weekly hours at one branch on one ISO weekday. See the create_work_schedules migration. */
class DentistSchedule extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array { return ['weekday' => 'integer', 'demo' => 'boolean']; }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function dentist(): BelongsTo { return $this->belongsTo(DentistProfile::class, 'dentist_profile_id'); }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }

    /** Hours as 'HH:MM' strings (old/new values for the audit, never patient data). */
    public function hours(): array
    {
        $t = fn ($v) => $v === null ? null : substr((string) $v, 0, 5);

        return ['start' => $t($this->start_time), 'end' => $t($this->end_time), 'break_start' => $t($this->break_start), 'break_end' => $t($this->break_end)];
    }
}
