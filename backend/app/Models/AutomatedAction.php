<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;
use Symfony\Component\Uid\Ulid;

class AutomatedAction extends Model
{
    public $timestamps = false;
    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $table = 'automated_actions';

    protected $fillable = [
        'public_id',
        'workflow_rule_id',
        'system_event_id',
        'idempotency_key',
        'status',
        'result_summary',
        'details',
        'executed_at',
        'created_at',
    ];

    protected $casts = [
        'details' => 'array',
        'executed_at' => 'immutable_datetime',
        'created_at' => 'immutable_datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->public_id)) {
                $model->public_id = strtolower((string) Ulid::generate());
            }
            if (empty($model->executed_at)) {
                $model->executed_at = CarbonImmutable::now('Asia/Manila');
            }
            if (empty($model->created_at)) {
                $model->created_at = CarbonImmutable::now('Asia/Manila');
            }
        });
    }

    public function update(array $attributes = [], array $options = []): bool
    {
        throw new RuntimeException('Automated actions are append-only execution records and cannot be updated.');
    }

    public function delete(): ?bool
    {
        throw new RuntimeException('Automated actions are append-only execution records and cannot be deleted.');
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(WorkflowRule::class, 'workflow_rule_id');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(SystemEvent::class, 'system_event_id');
    }

    public function scopeStatus(Builder $query, ?string $status): Builder
    {
        if (!$status || $status === 'all') {
            return $query;
        }

        return $query->where('status', ucfirst(strtolower($status)));
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }
}
