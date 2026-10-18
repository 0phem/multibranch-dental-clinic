<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** F8: one HMO the clinic accepts (information only; no claims, no coverage calculation). Shown to patients only when verified. */
class AcceptedHmo extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['verified_by_clinic' => 'boolean', 'active' => 'boolean', 'verified_at' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
}
