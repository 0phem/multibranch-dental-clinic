<?php

namespace App\Models;

use App\Enums\Role;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

class AuditLog extends Model
{
    use HasFactory, HasUlids;

    public $timestamps = false;

    public const CATEGORIES = [
        'security',
        'clinical',
        'financial',
        'administrative',
        'automation',
        'general',
    ];

    public const SEVERITIES = [
        'info',
        'warning',
        'critical',
    ];

    protected $fillable = [
        'actor_user_id',
        'actor_role',
        'actor_name',
        'branch_id',
        'action',
        'category',
        'severity',
        'auditable_type',
        'auditable_public_id',
        'ip_address',
        'user_agent',
        'payload',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'created_at' => 'immutable_datetime',
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

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    /**
     * Audit logs are strictly append-only. Updates and deletes are disallowed.
     */
    public function update(array $attributes = [], array $options = []): bool
    {
        throw new RuntimeException('Audit logs are append-only and cannot be modified.');
    }

    public function delete(): ?bool
    {
        throw new RuntimeException('Audit logs are immutable and cannot be deleted.');
    }

    /**
     * Scope for searching audit logs.
     */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (empty($term)) {
            return $query;
        }

        $term = trim($term);

        return $query->where(function (Builder $q) use ($term) {
            $q->where('action', 'ilike', "%{$term}%")
                ->orWhere('actor_name', 'ilike', "%{$term}%")
                ->orWhere('auditable_public_id', 'ilike', "%{$term}%")
                ->orWhere('auditable_type', 'ilike', "%{$term}%")
                ->orWhere('ip_address', 'ilike', "%{$term}%");
        });
    }

    /**
     * Scope for branch filter.
     */
    public function scopeForBranch(Builder $query, ?string $branchId): Builder
    {
        if (empty($branchId)) {
            return $query;
        }

        return $query->whereHas('branch', function (Builder $b) use ($branchId) {
            $b->where('public_id', $branchId)->orWhere('id', is_numeric($branchId) ? (int) $branchId : 0);
        });
    }

    /**
     * Scope for category filter.
     */
    public function scopeByCategory(Builder $query, ?string $category): Builder
    {
        if (empty($category) || $category === 'all') {
            return $query;
        }

        return $query->where('category', $category);
    }

    /**
     * Scope for severity filter.
     */
    public function scopeBySeverity(Builder $query, ?string $severity): Builder
    {
        if (empty($severity) || $severity === 'all') {
            return $query;
        }

        return $query->where('severity', $severity);
    }
}
