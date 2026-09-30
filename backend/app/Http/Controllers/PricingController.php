<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Requests\Pricing\CreateServicePriceRequest;
use App\Http\Resources\ServicePriceResource;
use App\Models\Branch;
use App\Models\Service;
use App\Models\ServicePrice;
use App\Models\UserBranchScope;
use App\Services\Pricing\PriceResolver;
use App\Services\Pricing\PricingService;
use App\Support\ClinicClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// M13 pricing foundation API. Owner: price history, create a version, retract a future version, resolve any date.
// Staff: resolve TODAY's price only, for branches in their authorization scope (never a history browser). Dentists,
// Patients and guests have no pricing access (route middleware). M11 uses PriceResolver internally, not this API.
class PricingController extends Controller
{
    use ReadsIdempotencyKey;

    private const RELATIONS = ['service', 'branch', 'createdBy.person', 'retractedBy.person'];

    public function __construct(private readonly PricingService $pricing, private readonly PriceResolver $resolver) {}

    /** Owner: every version of every service (the table is small and append-only). */
    public function index()
    {
        return ServicePriceResource::collection(ServicePrice::with(self::RELATIONS)->orderBy('service_id')->orderBy('effective_from')->orderBy('id')->get());
    }

    /** Owner: one service's complete version history, including retracted versions. */
    public function history(Service $service)
    {
        return ServicePriceResource::collection(ServicePrice::with(self::RELATIONS)->where('service_id', $service->id)
            ->orderBy('effective_from')->orderBy('id')->get());
    }

    public function store(CreateServicePriceRequest $request, Service $service): JsonResponse
    {
        $ref = $request->validated('branch_ref');

        return $this->pricing->create(
            $request->user(), $service, $ref ? Branch::where('legacy_ref', $ref)->firstOrFail() : null,
            $request->validated('kind'), $request->validated('amount'), $request->validated('effective_from'),
            $this->idempotencyKey($request, true),
        );
    }

    public function retract(Request $request, ServicePrice $servicePrice): JsonResponse
    {
        return $this->pricing->retract($request->user(), $servicePrice, $this->idempotencyKey($request, true));
    }

    public function resolve(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_ref' => ['required', 'string', 'exists:services,legacy_ref'],
            'branch_ref' => ['required', 'string', 'exists:branches,legacy_ref'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $user = $request->user();
        $today = ClinicClock::today();
        $date = $validated['date'] ?? $today;
        $branch = Branch::where('legacy_ref', $validated['branch_ref'])->firstOrFail();
        if ($user->role === Role::Staff) {
            // D4: Staff see only today's resolved price, and only within their branch authorization scope.
            if ($date !== $today) {
                return response()->json(['message' => 'Staff can see only today’s resolved price.', 'code' => 'date_not_allowed'], 403);
            }
            if (! UserBranchScope::where('user_id', $user->id)->where('branch_id', $branch->id)->exists()) {
                return response()->json(['message' => 'This branch is outside your access.', 'code' => 'forbidden'], 403);
            }
        }
        $service = Service::where('legacy_ref', $validated['service_ref'])->firstOrFail();

        return response()->json(['data' => $this->resolver->resolve($service, $branch, $date)->toArray()]);
    }
}
