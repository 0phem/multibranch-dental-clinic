<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** What a patient filled in at the counter, waiting for staff (App\Services\Intake\IntakeService). The form is encrypted. */
class IntakeSubmission extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['data' => 'encrypted:array', 'scanned_fields' => 'array', 'join_queue' => 'boolean',
            'confirmed_at' => 'immutable_datetime', 'consent_at' => 'immutable_datetime', 'created_at' => 'immutable_datetime'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }

    public function accountPatient(): BelongsTo { return $this->belongsTo(Patient::class, 'account_patient_id'); }

    public function patient(): BelongsTo { return $this->belongsTo(Patient::class); }
}
