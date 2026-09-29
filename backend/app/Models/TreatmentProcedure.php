<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// TREATMENT_PROCEDURES — a performed procedure line of a Treatment: canonical service, quantity, notes and the service's
// code/name snapshot. No price (M13/M11 own pricing). The public_id stays stable while the same line is retained.
class TreatmentProcedure extends Model
{
    use HasUlids;

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['line_no' => 'integer', 'quantity' => 'integer'];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function treatment(): BelongsTo
    {
        return $this->belongsTo(Treatment::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}
