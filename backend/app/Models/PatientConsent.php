<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatientConsent extends Model
{
    use HasUlids;

    public const TYPES = [
        'general_treatment',
        'data_privacy',
        'hmo_authorization',
        'photography_consent',
        'minor_treatment',
    ];

    public const STATUSES = [
        'Granted',
        'Withdrawn',
    ];

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return [
            'signed_at' => 'immutable_datetime',
            'withdrawn_at' => 'immutable_datetime',
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

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by_user_id');
    }
}
