<?php

namespace App\Services\Pricing;

use App\Models\Branch;
use App\Models\Service;

// No Owner-confirmed price applies to this service, branch and date. Callers must not substitute any other value
// (reference fee, browser data, another branch, a previous invoice or a guess).
final class PriceUnavailable
{
    public function __construct(
        public readonly Service $service,
        public readonly Branch $branch,
        public readonly string $date,
    ) {}

    public function available(): bool
    {
        return false;
    }

    public function toArray(): array
    {
        return [
            'available' => false,
            'service' => ['id' => $this->service->legacy_ref, 'code' => $this->service->code, 'name' => $this->service->name],
            'branch' => ['id' => $this->branch->legacy_ref, 'name' => $this->branch->name],
            'date' => $this->date,
            'reason' => 'price_unavailable',
        ];
    }
}
