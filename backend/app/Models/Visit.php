<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

// VISITS — the shared Visit / Clinical Encounter (see the create_visits_table migration). The bigint id stays
// internal; routes bind and resources expose the ULID public_id. Status changes happen only through VisitService's
// named commands, never a generic update.
class Visit extends Model
{
    use HasUlids;

    public const ACTIVE_STATUSES = ['Checked In', 'In Treatment'];

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return [
            'arrived_at' => 'immutable_datetime',
            'closed_at' => 'immutable_datetime',
            'clinic_date' => 'date:Y-m-d',
            'revision' => 'integer',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(DentistProfile::class, 'responsible_dentist_profile_id');
    }

    public function requestedService(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'requested_service_id');
    }

    /** The M9 queue entry opened with this Visit's arrival (at most one; none for a Visit without a Dentist). */
    public function queueEntry(): HasOne
    {
        return $this->hasOne(QueueEntry::class);
    }

    /** The M5 clinical Treatment of this Visit (at most one; created only by the M5 start command). */
    public function treatment(): HasOne
    {
        return $this->hasOne(Treatment::class);
    }

    public function history(): HasMany
    {
        return $this->hasMany(VisitHistory::class)->orderBy('id');
    }

    /** The authorization read scope (VisitPolicy::view expressed as a query). Patients have no Visit API yet (D9). */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return match ($user->role->value) {
            'owner' => $query,
            'staff' => $query->whereIn('branch_id', UserBranchScope::select('branch_id')->where('user_id', $user->id)),
            'dentist' => $query->whereHas('dentist', fn (Builder $q) => $q->where('person_id', $user->person_id)),
            default => $query->whereRaw('false'),
        };
    }
}
