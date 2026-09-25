<?php

namespace App\Http\Controllers\Reference;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reference\SetBranchServiceRequest;
use App\Http\Resources\Reference\BranchServiceResource;
use App\Models\Branch;
use App\Models\BranchService;
use App\Models\Service;

class BranchServiceController extends Controller
{
    // The real, complete flat dataset — this, not GET /api/branches/{branch}/services, is what the
    // frontend bootstrap bridge fetches (Phase 2A plan, section H).
    public function index()
    {
        $rows = BranchService::with(['branch', 'service'])->get();

        return response()->json(['data' => BranchServiceResource::collection($rows)]);
    }

    // Idempotent upsert on (branch_id, service_id) — wires the existing setBranchService toggle. Looks up
    // both sides by legacy_ref (branch_ref/service_ref), never an internal bigint id (plan section C).
    public function store(SetBranchServiceRequest $request)
    {
        $branch = Branch::where('legacy_ref', $request->validated('branch_ref'))->firstOrFail();
        $service = Service::where('legacy_ref', $request->validated('service_ref'))->firstOrFail();

        $attributes = ['active' => $request->validated('active')];
        if ($request->has('duration_override_minutes')) {
            $attributes['duration_override_minutes'] = $request->validated('duration_override_minutes');
        }

        $row = BranchService::updateOrCreate(
            ['branch_id' => $branch->id, 'service_id' => $service->id],
            $attributes
        );

        // Explicit 200 regardless of create-vs-update: this is described to callers as an idempotent
        // upsert, not a strict create, so the status contract stays simple and consistent.
        return response()->json(['data' => new BranchServiceResource($row->load(['branch', 'service']))], 200);
    }
}
