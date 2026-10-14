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

    protected static function booted(): void
    {
        static::creating(function (self $branch) {
            $branch->public_id ??= (string) \Illuminate\Support\Str::ulid();
        });
    }

    public function resolveRouteBindingQuery($query, $value, $field = null)
    {
        // Keep the frozen Phase 2A bridge during downstream migration. Never bind bigint IDs.
        return parent::resolveRouteBindingQuery($query, $value,
            $field ?? (\Illuminate\Support\Str::isUlid($value) ? 'public_id' : 'legacy_ref'));
    }

    /** The M2 public reference: a public ULID (any case) or the frozen transitional legacy_ref; never the bigint id. */
    public static function fromPublicReference(string $reference): ?self
    {
        return \Illuminate\Support\Str::isUlid($reference)
            ? static::whereRaw('lower(public_id) = ?', [strtolower($reference)])->first()
            : static::where('legacy_ref', $reference)->first();
    }

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
        'email',
        'latitude',
        'longitude',
        'operating_days',
    ];

    protected function casts(): array
    {
        return [
            'capacity_threshold' => 'integer',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'operating_days' => 'array',
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
