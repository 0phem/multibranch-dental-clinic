<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// One verified payment-provider event, stored by its provider event id before it is acted on (duplicate-delivery guard and
// reconciliation record). Holds identifiers, an amount and a status only — never the raw payload, headers or credentials.
class PaymentProviderEvent extends Model
{
    use HasUlids;

    public const STATUSES = ['Received', 'Settled', 'Duplicate', 'Needs review', 'Ignored'];

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return ['received_at' => 'immutable_datetime', 'processed_at' => 'immutable_datetime', 'amount_centavos' => 'integer'];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }
}
