<?php

namespace App\Http\Controllers\Reference;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reference\UpdateStaffProfileRequest;
use App\Http\Resources\Reference\StaffProfileResource;
use App\Models\Branch;
use App\Models\StaffProfile;

class StaffProfileController extends Controller
{
    // Route-gated to role:staff,dentist,owner — Patient is denied (Phase 2A plan, section H, point 1/7).
    public function index()
    {
        $rows = StaffProfile::with(['person', 'branch'])->get();

        return response()->json(['data' => StaffProfileResource::collection($rows)]);
    }

    // {staffProfile} resolves via StaffProfile::getRouteKeyName() = 'legacy_ref'.
    public function update(UpdateStaffProfileRequest $request, StaffProfile $staffProfile)
    {
        $attributes = $request->safe()->except('branch_ref');

        if ($request->has('branch_ref')) {
            $attributes['branch_id'] = $request->validated('branch_ref')
                ? Branch::where('legacy_ref', $request->validated('branch_ref'))->firstOrFail()->id
                : null;
        }

        $staffProfile->update($attributes);

        // Section 3.5: when an administrator changes a staff member's assigned branch on their StaffProfile,
        // synchronize the linked Staff user account's server-side authorization branch scopes (user_branch_scopes).
        if ($request->has('branch_ref') && $staffProfile->person_id) {
            $linkedUser = \App\Models\User::where('person_id', $staffProfile->person_id)
                ->where('role', \App\Enums\Role::Staff)
                ->first();
            if ($linkedUser) {
                $branchIds = $attributes['branch_id']
                    ? [$attributes['branch_id']]
                    : Branch::where('status', 'Open')->pluck('id')->all();
                \App\Models\UserBranchScope::where('user_id', $linkedUser->id)->whereNotIn('branch_id', $branchIds ?: [0])->delete();
                foreach ($branchIds as $branchId) {
                    \App\Models\UserBranchScope::firstOrCreate(['user_id' => $linkedUser->id, 'branch_id' => $branchId]);
                }
            }
        }

        return response()->json(['data' => new StaffProfileResource($staffProfile->fresh(['person', 'branch']))]);
    }
}
