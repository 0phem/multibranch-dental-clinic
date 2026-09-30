<?php

namespace App\Services\Pricing;

use App\Models\Branch;
use App\Models\Service;
use App\Models\ServicePrice;

// The ONE authoritative M13 price resolution (used internally by M11 with Treatment → Visit → clinic_date).
//   1. the latest non-retracted BRANCH version with effective_from <= date: priced → it; ended → go to the base;
//   2. the latest non-retracted BASE version with effective_from <= date: priced → it; ended → unavailable;
//   3. otherwise unavailable.
// It never reads services.reference_fee_php and never falls back to browser data, another branch, a previous invoice
// or a guessed value. The unique index (one non-retracted version per level and date) makes the result deterministic.
// It deliberately does not check whether the service is active or offered today: pricing a historical date must work.
final class PriceResolver
{
    public function resolve(Service $service, Branch $branch, string $date): ResolvedPrice|PriceUnavailable
    {
        $branchVersion = $this->latest($service, $branch->id, $date);
        if ($branchVersion?->kind === 'priced') {
            return new ResolvedPrice($branchVersion, $service, $branch, $date);
        }
        $baseVersion = $this->latest($service, null, $date);
        if ($baseVersion?->kind === 'priced') {
            return new ResolvedPrice($baseVersion, $service, $branch, $date);
        }

        return new PriceUnavailable($service, $branch, $date);
    }

    private function latest(Service $service, ?int $branchId, string $date): ?ServicePrice
    {
        return ServicePrice::where('service_id', $service->id)
            ->when($branchId === null, fn ($q) => $q->whereNull('branch_id'), fn ($q) => $q->where('branch_id', $branchId))
            ->whereNull('retracted_at')
            ->where('effective_from', '<=', $date)
            ->orderByDesc('effective_from')
            ->first();
    }
}
