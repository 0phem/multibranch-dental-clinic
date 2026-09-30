<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// HMO_CASE_REQUIREMENTS — one row per project requirement rule. Metadata label only; documents belong to M14.
class HmoCaseRequirement extends Model
{
    public const RULES = [
        'hmo-card' => 'HMO Card',
        'valid-id' => 'Valid ID',
        'treatment-request' => 'Dentist treatment request',
    ];

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['validated_at' => 'immutable_datetime'];
    }

    public function hmoCase(): BelongsTo
    {
        return $this->belongsTo(HmoCase::class);
    }
}
