<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// QUEUE_ENTRIES (M9) — see the create_queue_tables migration. Anchored to exactly one Visit; the bigint id stays internal,
// routes bind and resources expose the ULID public_id. State changes happen only through QueueService's named commands.
class QueueEntry extends Model
{
    use HasUlids;

    public const STATUSES = ['Waiting', 'Called', 'Treatment Ready', 'Temporarily Away', 'Served'];

    /** States that hold a place in the queue order (Temporarily Away and Served do not). */
    public const POSITIONAL = ['Waiting', 'Called', 'Treatment Ready'];

    public const PRIORITIES = ['Urgent', 'Priority', 'Normal'];

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['closed_at' => 'immutable_datetime', 'revision' => 'integer', 'queue_number' => 'integer'];
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

    public function dentistQueue(): BelongsTo
    {
        return $this->belongsTo(DentistQueue::class);
    }

    public function history(): HasMany
    {
        return $this->hasMany(QueueEntryHistory::class)->orderBy('id');
    }

    /** The authorization read scope (QueuePolicy::view as a query). Patients use the own-queue endpoint instead. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return match ($user->role->value) {
            'owner' => $query,
            'staff' => $query->whereHas('dentistQueue', fn (Builder $q) => $q->whereIn('branch_id', UserBranchScope::select('branch_id')->where('user_id', $user->id))),
            'dentist' => $query->whereHas('dentistQueue.dentist', fn (Builder $q) => $q->where('person_id', $user->person_id)),
            default => $query->whereRaw('false'),
        };
    }
}
