<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Append-only (a database trigger rejects UPDATE/DELETE) — see the create_treatment_tables migration. `snapshot` holds
// the documentation and procedure lines of that revision, so removed lines stay reconstructable.
class TreatmentHistory extends Model
{
    protected $table = 'treatment_history';

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'immutable_datetime',
            'revision' => 'integer',
            'snapshot' => 'array',
        ];
    }

    public function treatment(): BelongsTo
    {
        return $this->belongsTo(Treatment::class);
    }
}
