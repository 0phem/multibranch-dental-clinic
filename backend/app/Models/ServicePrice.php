<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// SERVICE_PRICES — an append-only, Owner-confirmed, effective-dated price version (see the create_service_prices_table
// migration). The only authoritative price source; `services.reference_fee_php` is never read for pricing. Rows are
// created and (future versions only) retracted exclusively through PricingService.
class ServicePrice extends Model
{
    use HasUlids;

    public const UPDATED_AT = null;

    public const SOURCE = 'owner_confirmed';

    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $guarded = ['id', 'public_id'];

    protected function casts(): array
    {
        return [
            // Decimal string ("1500.00") — never a float.
            'amount' => 'decimal:2',
            'effective_from' => 'date:Y-m-d',
            'retracted_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
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

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function retractedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'retracted_by_user_id');
    }
}
