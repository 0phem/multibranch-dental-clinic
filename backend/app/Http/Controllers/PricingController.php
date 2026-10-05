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

// M13 pricing foundation API. Owner: paged price history, create a version, retract a future version, resolve any date.
// Staff: resolve TODAY's price only, for branches in their authorization scope (never a history browser). Dentists,
// Patients and guests have no pricing access (route middleware). M11 uses PriceResolver internally, not this API.
class PricingController extends Controller
{
    use ReadsIdempotencyKey;

    private const RELATIONS = ['service', 'branch', 'createdBy.person', 'retractedBy.person'];

    public function __construct(private readonly PricingService $pricing, private readonly PriceResolver $resolver) {}

    private const MAX_PER_PAGE = 100;

    /**
     * Keyset page over price versions, newest first by the internal id (deterministic and never reused). The cursor is the last
     * version's public id; an unknown cursor yields an empty page. Authorization (Owner-only route) comes first; the optional
     * filters can only narrow the result.
     */
    private function page(Request $request, $query)
    {
        $v = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
            'cursor' => ['nullable', 'string', 'size:26'],
            'service_ref' => ['nullable', 'string', 'max:64', 'exists:services,legacy_ref'],
            'branch_ref' => ['nullable', 'string', 'max:64', 'exists:branches,legacy_ref'],
        ]);
        $per = (int) ($v['per_page'] ?? 50);
        if (! empty($v['service_ref'])) {
            $query->where('service_id', Service::where('legacy_ref', $v['service_ref'])->value('id'));
        }
        if (! empty($v['branch_ref'])) {
            $query->where('branch_id', Branch::where('legacy_ref', $v['branch_ref'])->value('id'));
        }
        if (! empty($v['cursor'])) {
            $query->where('id', '<', ServicePrice::select('id')->where('public_id', strtolower($v['cursor']))->limit(1));
        }
        $rows = $query->with(self::RELATIONS)->orderByDesc('id')->limit($per + 1)->get();
        $page = $rows->take($per)->values();

        return response()->json([
            'data' => ServicePriceResource::collection($page)->resolve($request),
            'meta' => ['per_page' => $per, 'next_cursor' => $rows->count() > $per ? $page->last()->public_id : null],
        ]);
    }

    /** Owner: price versions (including retracted ones), newest first, keyset-paged. */
    public function index(Request $request)
    {
        return $this->page($request, ServicePrice::query());
    }

    /** Owner: one service's version history (retracted versions included), newest first, keyset-paged. */
    public function history(Request $request, Service $service)
    {
        return $this->page($request, ServicePrice::where('service_id', $service->id));
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
