<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use RuntimeException;
use Symfony\Component\Uid\Ulid;

class SystemEvent extends Model
{
    public $timestamps = false;
    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $table = 'system_events';

    protected $fillable = [
        'public_id',
        'event_type',
        'idempotency_key',
        'domain',
        'aggregate_type',
        'aggregate_id',
        'branch_id',
        'actor_user_id',
        'payload',
        'occurred_at',
        'created_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'occurred_at' => 'immutable_datetime',
        'created_at' => 'immutable_datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->public_id)) {
                $model->public_id = strtolower((string) Ulid::generate());
            }
            if (empty($model->occurred_at)) {
                $model->occurred_at = CarbonImmutable::now('Asia/Manila');
            }
            if (empty($model->created_at)) {
                $model->created_at = CarbonImmutable::now('Asia/Manila');
            }
        });
    }

    public function update(array $attributes = [], array $options = []): bool
    {
        throw new RuntimeException('System events are append-only and cannot be updated.');
    }

    public function delete(): ?bool
    {
        throw new RuntimeException('System events are append-only and cannot be deleted.');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(AutomatedAction::class, 'system_event_id');
    }

    public function scopeForBranch(Builder $query, ?int $branchId): Builder
    {
        if ($branchId === null) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        });
    }

    public function scopeDomain(Builder $query, ?string $domain): Builder
    {
        if (!$domain || $domain === 'all') {
            return $query;
        }

        return $query->where('domain', $domain);
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }
}
