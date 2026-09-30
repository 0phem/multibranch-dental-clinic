<?php

namespace App\Services\Pricing;

use App\Http\Resources\ServicePriceResource;
use App\Models\Branch;
use App\Models\BranchService;
use App\Models\CommandKey;
use App\Models\Service;
use App\Models\ServicePrice;
use App\Models\User;
use App\Services\Visits\VisitCommandException;
use App\Support\ClinicClock;
use App\Support\IdempotentCommand;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;

// M13 pricing commands (Owner only; Idempotency-Key required). A price change is always a NEW version; the only
// mutation of an existing row is retracting a version that has not taken effect yet. `source` and the actor columns are
// assigned here from the authenticated Owner — never accepted from the client.
final class PricingService
{
    private const ATTEMPTS = 3;

    public function create(User $actor, Service $service, ?Branch $branch, string $kind, ?string $amount, string $effectiveFrom, string $key): JsonResponse
    {
        $payload = ['service' => $service->id, 'branch' => $branch?->id, 'kind' => $kind, 'amount' => $amount, 'effective_from' => $effectiveFrom];

        return $this->idempotent($actor, $key, 'pricing.create', $payload, function () use ($actor, $service, $branch, $kind, $amount, $effectiveFrom) {
            // D2: today or a future Asia/Manila business date; never backdated.
            if ($effectiveFrom < ClinicClock::today()) {
                throw VisitCommandException::rule('effective_from_past', 'A price version can start today or on a future date, never in the past.', 'effective_from');
            }
            // D8: a branch-specific price requires the branch to offer the service (the current branch-service convention).
            if ($branch && ! BranchService::where('branch_id', $branch->id)->where('service_id', $service->id)->where('active', true)->exists()) {
                throw VisitCommandException::rule('branch_service_missing', 'This branch does not offer this service, so it cannot have a branch price.', 'branch_ref');
            }
            $price = ServicePrice::create([
                'service_id' => $service->id,
                'branch_id' => $branch?->id,
                'kind' => $kind,
                'amount' => $kind === 'priced' ? $amount : null,
                'effective_from' => $effectiveFrom,
                'source' => ServicePrice::SOURCE,
                'created_by_user_id' => $actor->id,
                'created_at' => ClinicClock::now(),
            ]);

            return [$price, 201];
        });
    }

    public function retract(User $actor, ServicePrice $price, string $key): JsonResponse
    {
        return $this->idempotent($actor, $key, 'pricing.retract', ['price' => $price->id], function () use ($actor, $price) {
            $current = ServicePrice::whereKey($price->id)->lockForUpdate()->firstOrFail();
            if ($current->retracted_at !== null) {
                throw new VisitCommandException(409, 'price_already_retracted', 'This price version was already retracted.');
            }
            // D3: only a version that has not taken effect yet may be withdrawn; once effective it is immutable.
            if ($current->effective_from->format('Y-m-d') <= ClinicClock::today()) {
                throw VisitCommandException::rule('price_effective', 'This price version is already in effect and cannot be changed. Add a new version instead.', 'price');
            }
            $current->update(['retracted_at' => ClinicClock::now(), 'retracted_by_user_id' => $actor->id]);

            return [$current, 200];
        });
    }

    private function idempotent(User $actor, string $key, string $command, array $payload, Closure $work): JsonResponse
    {
        return IdempotentCommand::run(
            CommandKey::class, $actor, $key, $command, $payload,
            function () use ($work) {
                [$price, $status] = $work();
                $body = (new ServicePriceResource($price->fresh(['service', 'branch', 'createdBy.person', 'retractedBy.person'])))->response()->getData(true);

                return [$body, $status];
            },
            fn () => VisitCommandException::rule('idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'idempotency_key'),
            function (QueryException $e) {
                if (str_contains($e->getMessage(), 'service_prices_one_version_per_level_date')) {
                    throw new VisitCommandException(409, 'price_version_exists', 'A price version already starts on this date for this service and level. Choose another date or retract the existing future version.');
                }
                if (in_array($e->getCode(), ['40P01', '40001'], true)) {
                    throw new VisitCommandException(409, 'conflict', 'Another request changed pricing at the same time. Reload and try again.');
                }
            },
            self::ATTEMPTS,
        );
    }
}
