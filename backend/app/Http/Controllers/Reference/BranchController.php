<?php

namespace App\Http\Controllers\Reference;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reference\UpdateBranchRequest;
use App\Http\Resources\Reference\BranchResource;
use App\Http\Resources\Reference\BranchServiceResource;
use App\Models\Branch;

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
        $branch->update($request->validated());

        return response()->json(['data' => new BranchResource($branch)]);
    }

    public function servicesForBranch(Branch $branch)
    {
        $rows = $branch->branchServices()->with(['branch', 'service'])->get();

        return response()->json(['data' => BranchServiceResource::collection($rows)]);
    }
}
