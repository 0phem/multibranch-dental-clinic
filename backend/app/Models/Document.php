<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    use HasUlids;

    public const CATEGORIES = [
        'hmo_card',
        'valid_id',
        'treatment_request',
        'clinical_attachment',
        'consent_document',
        'referral',
        'other',
    ];

    public const STATUSES = [
        'Active',
        'Archived',
        'Retracted',
    ];

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return [
            'file_size_bytes' => 'integer',
            'metadata' => 'array',
            'retracted_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
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

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function hmoCase(): BelongsTo
    {
        return $this->belongsTo(HmoCase::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }

    public function retractedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'retracted_by_user_id');
    }

    public function extractions(): HasMany
    {
        return $this->hasMany(DocumentExtraction::class)->latest('id');
    }

    public function consents(): HasMany
    {
        return $this->hasMany(PatientConsent::class);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return match ($user->role?->value) {
            'owner' => $query,
            'staff' => $query->where(function ($q) use ($user) {
                $branchIds = UserBranchScope::select('branch_id')->where('user_id', $user->id);
                $q->whereIn('branch_id', $branchIds)
                  ->orWhereNull('branch_id')
                  ->orWhereHas('visit', fn ($v) => $v->whereIn('branch_id', $branchIds));
            }),
            'dentist' => $query->where(function ($q) use ($user) {
                $dentistProfileId = $user->person?->dentistProfile?->id;
                if (! $dentistProfileId) {
                    $dentistProfileId = DentistProfile::where('person_id', $user->person_id)->value('id') ?? 0;
                }
                $q->whereHas('visit', fn ($v) => $v->where('responsible_dentist_profile_id', $dentistProfileId))
                  ->orWhereHas('patient.visits', fn ($v) => $v->where('responsible_dentist_profile_id', $dentistProfileId));
            }),
            'patient' => $query->where('patient_id', $user->patient?->id ?? 0),
            default => $query->whereRaw('false'),
        };
    }
}
