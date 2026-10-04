<?php

namespace App\Http\Controllers\Reference;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reference\UpdateBranchRequest;
use App\Http\Resources\Reference\BranchResource;
use App\Http\Resources\Reference\BranchServiceResource;
use App\Models\Branch;
use App\Services\Audit\AuditService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BranchController extends Controller
{
    // Explicit response()->json(['data' => ...]) rather than returning the Resource/Collection directly,
    // matching CurrentUserController's established convention — avoids JsonResource::toResponse()'s
    // auto-201-on-wasRecentlyCreated quirk and keeps every Phase 2A response shape consistent.
    public function index()
    {
        return response()->json(['data' => BranchResource::collection(Branch::orderBy('name')->get())]);
    }

    // {branch} resolves via Branch::getRouteKeyName() = 'legacy_ref' — see the Phase 2A plan, section C/D.
    public function update(UpdateBranchRequest $request, Branch $branch)
    {
        return DB::transaction(function () use ($request, $branch) {
            $current = Branch::whereKey($branch->id)->lockForUpdate()->firstOrFail();
            $data = $request->validated();
            // Validate the effective pair, including PATCH requests that change only one endpoint.
            if (isset($data['open_time']) || isset($data['close_time'])) {
                $open = substr($data['open_time'] ?? $current->open_time, 0, 5);
                $close = substr($data['close_time'] ?? $current->close_time, 0, 5);
                if ($close <= $open) {
                    throw ValidationException::withMessages(['close_time' => 'Closing time must be after opening time.']);
                }
            }
            $current->fill($data);
            $changed = array_keys($current->getDirty());
            if ($changed) {
                $current->save();
                app(AuditService::class)->record([
                    'action' => 'branch.updated', 'category' => 'administrative',
                    'actor' => $request->user(), 'target' => $current,
                    'branch_id' => $current->id, 'payload' => ['fields' => $changed],
                ]);
            }
            return response()->json(['data' => new BranchResource($current)]);
        });
    }

    public function servicesForBranch(Branch $branch)
    {
        $rows = $branch->branchServices()->with(['branch', 'service'])->get();

        return response()->json(['data' => BranchServiceResource::collection($rows)]);
    }
}
