<?php

namespace App\Http\Controllers\Reference;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reference\UpdateDentistProfileRequest;
use App\Http\Resources\Reference\DentistProfileResource;
use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\StaffProfile;
use Illuminate\Support\Facades\DB;

class DentistProfileController extends Controller
{
    public function index()
    {
        $rows = DentistProfile::with(['person', 'assistant', 'branches', 'services'])->get();

        return response()->json(['data' => DentistProfileResource::collection($rows)]);
    }

    // {dentistProfile} resolves via DentistProfile::getRouteKeyName() = 'legacy_ref'. branch_ids, when
    // present, fully replaces the dentist's branch assignment set inside one transaction — matching how the
    // live edit form already submits one whole payload (plan section H/P).
    public function update(UpdateDentistProfileRequest $request, DentistProfile $dentistProfile)
    {
        $attributes = $request->safe()->except(['branch_ids', 'assistant_staff_ref']);

        if ($request->has('assistant_staff_ref')) {
            $attributes['assistant_staff_id'] = $request->validated('assistant_staff_ref')
                ? StaffProfile::where('legacy_ref', $request->validated('assistant_staff_ref'))->firstOrFail()->id
                : null;
        }

        DB::transaction(function () use ($request, $dentistProfile, $attributes): void {
            $dentistProfile->update($attributes);

            if ($request->has('branch_ids')) {
                $branchIds = Branch::whereIn('legacy_ref', $request->validated('branch_ids'))->pluck('id');
                $dentistProfile->branches()->sync($branchIds);
            }
        });

        return response()->json(['data' => new DentistProfileResource($dentistProfile->fresh(['person', 'assistant', 'branches', 'services']))]);
    }
}
