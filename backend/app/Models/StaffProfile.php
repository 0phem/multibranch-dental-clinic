<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// STAFF_PROFILES — see the create_staff_profiles_table migration comment and the Phase 2A plan, section
// C/D/E. getRouteKeyName() binds mutation routes by legacy_ref (see Branch's equivalent comment).
class StaffProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'legacy_ref',
        'legacy_user_ref',
        'title',
        'person_id',
        'branch_id',
        'shift_start',
        'shift_end',
        'available',
    ];

    protected function casts(): array
    {
        return [
            'available' => 'boolean',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'legacy_ref';
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    // Informational only — see the create_dentist_profiles_table migration comment on assistant_staff_id.
    public function assistingDentists(): HasMany
    {
        return $this->hasMany(DentistProfile::class, 'assistant_staff_id');
    }
}
