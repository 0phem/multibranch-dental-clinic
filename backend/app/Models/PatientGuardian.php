<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A guardian's link to a dependent patient, with consent; ended (never deleted) at the dependent's own-account claim. */
class PatientGuardian extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['consent_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function dependent(): BelongsTo { return $this->belongsTo(Patient::class, 'dependent_patient_id'); }

    public function guardian(): BelongsTo { return $this->belongsTo(Patient::class, 'guardian_patient_id'); }
}
