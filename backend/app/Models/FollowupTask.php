<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** M20: a follow-up task. Open → Contacted → Booked → Closed. The reason is encrypted at rest. */
class FollowupTask extends Model
{
    use HasUlids;

    public const OPEN = ['Open', 'Contacted'];

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['reason' => 'encrypted', 'close_note' => 'encrypted', 'due_on' => 'date:Y-m-d', 'contacted_at' => 'immutable_datetime', 'booked_at' => 'immutable_datetime',
            'closed_at' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function patient(): BelongsTo { return $this->belongsTo(Patient::class); }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }

    public function service(): BelongsTo { return $this->belongsTo(Service::class); }

    public function dentist(): BelongsTo { return $this->belongsTo(DentistProfile::class, 'dentist_profile_id'); }

    public function treatment(): BelongsTo { return $this->belongsTo(Treatment::class); }

    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }

    public function assignee(): BelongsTo { return $this->belongsTo(User::class, 'assignee_user_id'); }

    public function dueOn(): string { return substr((string) $this->getRawOriginal('due_on'), 0, 10); }
}
