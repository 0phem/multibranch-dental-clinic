<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// BRANCH_SERVICES — see the create_branch_services_table migration comment and the Phase 2A plan, section
// C/D. No getRouteKeyName() override: this resource is identified in POST /api/branch-services' request
// body via branch_ref/service_ref, not a URL route-model-bound segment.
class BranchService extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'service_id',
        'active',
        'duration_override_minutes',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'duration_override_minutes' => 'integer',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}
