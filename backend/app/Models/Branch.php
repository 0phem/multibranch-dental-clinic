<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

// BRANCHES — see the create_branches_table migration comment and the Phase 2A plan, section C/D.
// getRouteKeyName() binds mutation routes by legacy_ref, not the internal bigint id, so the React client
// never needs to know the bigint primary key exists (plan section C — this depends on Phase 2A shipping no
// create endpoint for this table; see the plan's Risks section).
class Branch extends Model
{
    use HasFactory;

    protected $fillable = [
        'legacy_ref',
        'branch_code',
        'name',
        'city',
        'address',
        'phone',
        'open_time',
        'close_time',
        'status',
        'capacity_threshold',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'capacity_threshold' => 'integer',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'legacy_ref';
    }

    public function branchServices(): HasMany
    {
        return $this->hasMany(BranchService::class);
    }

    public function staffProfiles(): HasMany
    {
        return $this->hasMany(StaffProfile::class);
    }

    public function dentistBranches(): HasMany
    {
        return $this->hasMany(DentistBranch::class);
    }
}
