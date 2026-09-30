<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Append-only M12 case history (a database trigger rejects UPDATE/DELETE). M12 domain history, not the M22 audit trail.
class HmoCaseEvent extends Model
{
    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'immutable_datetime',
            'approved_amount' => 'decimal:2',
            'rule_keys' => 'array',
            'submission_cycle' => 'integer',
            'revision' => 'integer',
        ];
    }

    public function hmoCase(): BelongsTo
    {
        return $this->belongsTo(HmoCase::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
