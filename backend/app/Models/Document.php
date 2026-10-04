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

    /**
     * The authoritative read scope for a document (and, through it, download, upload-target and retraction checks).
     *   Patient: their own documents.
     *   Staff:   documents of a branch in the account's authorization scopes (the document's branch or its Visit's branch);
     *            a document with no branch and no Visit is reachable only for a Patient who has an appointment or Visit in
     *            those scopes. A Staff account with no scope reaches nothing.
     *   Dentist: only documents linked to a Visit for which they are the responsible Dentist (workflow-tied, never arbitrary
     *            Patient browsing).
     *   Owner:   none — unrestricted clinical-document access for the Owner is not an established contract
     *            (POLICY DECISION REQUIRED), so it fails closed.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return match ($user->role?->value) {
            'patient' => $query->where('patient_id', $user->patient?->id ?? 0),
            'staff' => $query->where(function (Builder $q) use ($user) {
                $branchIds = UserBranchScope::select('branch_id')->where('user_id', $user->id);
                $q->whereIn('branch_id', $branchIds)
                    ->orWhereHas('visit', fn ($v) => $v->whereIn('branch_id', $branchIds))
                    ->orWhere(fn ($n) => $n->whereNull('branch_id')->whereNull('visit_id')->where(fn ($r) => $r
                        ->whereIn('patient_id', Appointment::select('patient_id')->whereIn('branch_id', $branchIds))
                        ->orWhereIn('patient_id', Visit::select('patient_id')->whereIn('branch_id', $branchIds))));
            }),
            'dentist' => $query->whereHas('visit', fn ($v) => $v->whereHas('dentist', fn ($d) => $d->where('person_id', $user->person_id))),
            default => $query->whereRaw('false'),
        };
    }
}
