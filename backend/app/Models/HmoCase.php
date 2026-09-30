<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// HMO_CASES — the one HMO case of a Visit (M12). Changes happen only through HmoCaseService's named commands.
class HmoCase extends Model
{
    use HasUlids;

    public const PREPARATION = ['Missing Requirements', 'Ready for Submission'];

    public const WAITING = ['Pending', 'Escalated'];

    public const FINAL = ['Approved', 'Rejected', 'Withdrawn'];

    /** Project value (not a clinic fact): a pending submission is due for follow-up after this many hours. */
    public const FOLLOW_UP_HOURS = 12;

    public const METHODS = ['Portal', 'Email', 'Phone', 'In person'];

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'immutable_datetime',
            'escalated_at' => 'immutable_datetime',
            'final_at' => 'immutable_datetime',
            'approved_amount' => 'decimal:2',
            'submission_cycle' => 'integer',
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

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(PatientHmoMembership::class, 'membership_id');
    }

    public function requirements(): HasMany
    {
        return $this->hasMany(HmoCaseRequirement::class)->orderBy('id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(HmoCaseEvent::class)->orderBy('id');
    }

    public function isFinal(): bool
    {
        return in_array($this->status, self::FINAL, true);
    }

    /** Derived display/operational fact only: no task record, job or automatic escalation exists (M23 owns automation). */
    public function followUpDueAt(): ?\Carbon\CarbonImmutable
    {
        return in_array($this->status, self::WAITING, true) && $this->submitted_at ? $this->submitted_at->addHours(self::FOLLOW_UP_HOURS) : null;
    }

    /** Read scope: Owner all; Staff their branch scopes; Dentist Visits they are responsible for; others none. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return match ($user->role->value) {
            'owner' => $query,
            'staff' => $query->whereIn('branch_id', UserBranchScope::select('branch_id')->where('user_id', $user->id)),
            'dentist' => $query->whereHas('visit.dentist', fn (Builder $d) => $d->where('person_id', $user->person_id)),
            default => $query->whereRaw('false'),
        };
    }
}
