<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** F5: a date one branch (or every branch, branch_id NULL) is closed or keeps partial hours. See the create_branch_closures migration. */
class BranchClosure extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['patients_notified_at' => 'immutable_datetime'];
    }

    public function uniqueIds(): array { return ['public_id']; }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }

    public function dateString(): string { return substr((string) $this->closed_on, 0, 10); }

    /** ['open','close'] partial hours, or null for a full-day closure. */
    public function partialHours(): ?array
    {
        return $this->open_time && $this->close_time ? ['open' => substr((string) $this->open_time, 0, 5), 'close' => substr((string) $this->close_time, 0, 5)] : null;
    }
}
