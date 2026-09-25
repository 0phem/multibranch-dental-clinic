<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

// DENTIST_PROFILES — see the create_dentist_profiles_table migration comment and the Phase 2A plan, section
// C/D/E. getRouteKeyName() binds mutation routes by legacy_ref (see Branch's equivalent comment).
class DentistProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'legacy_ref',
        'legacy_user_ref',
        'person_id',
        'license_no',
        'specialty',
        'shift_start',
        'shift_end',
        'available',
        'assistant_staff_id',
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

    public function assistant(): BelongsTo
    {
        return $this->belongsTo(StaffProfile::class, 'assistant_staff_id');
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'dentist_branches');
    }

    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class, 'dentist_service_assignments')
            ->withPivot('is_authorized');
    }
}
