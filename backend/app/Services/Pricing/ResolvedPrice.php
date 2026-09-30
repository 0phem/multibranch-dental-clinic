<?php

namespace App\Services\Pricing;

use App\Models\Branch;
use App\Models\Service;
use App\Models\ServicePrice;

// A successfully resolved authoritative price: everything M11 snapshots onto an invoice line. `amount` is a decimal
// string ("1500.00"), never a float.
final class ResolvedPrice
{
    public function __construct(
        public readonly ServicePrice $version,
        public readonly Service $service,
        public readonly Branch $branch,
        public readonly string $date,
    ) {}

    public function available(): bool
    {
        return true;
    }

    public function amount(): string
    {
        return (string) $this->version->amount;
    }

    public function level(): string
    {
        return $this->version->branch_id === null ? 'base' : 'branch';
    }

    public function toArray(): array
    {
        return [
            'available' => true,
            'price_public_id' => $this->version->public_id,
            'level' => $this->level(),
            'service' => ['id' => $this->service->legacy_ref, 'code' => $this->service->code, 'name' => $this->service->name],
            'branch' => ['id' => $this->branch->legacy_ref, 'name' => $this->branch->name],
            'date' => $this->date,
            'effective_from' => $this->version->effective_from->format('Y-m-d'),
            'amount' => $this->amount(),
            'source' => $this->version->source,
        ];
    }
}
