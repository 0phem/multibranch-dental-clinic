<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Symfony\Component\Uid\Ulid;

class WorkflowRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'public_id',
        'rule_code',
        'name',
        'trigger_event',
        'target_domains',
        'condition_description',
        'action_description',
        'owner_domain',
        'is_active',
        'is_system_protected',
    ];

    protected $casts = [
        'target_domains' => 'array',
        'is_active' => 'boolean',
        'is_system_protected' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (empty($model->public_id)) {
                $model->public_id = strtolower((string) Ulid::generate());
            }
        });
    }

    public function actions(): HasMany
    {
        return $this->hasMany(AutomatedAction::class, 'workflow_rule_id');
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }
}
