<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/public/branches — the clinic's open branches for the public website (no sign-in): name, address and the approximate
 * map coordinates. The website keeps no branch list of its own, so the Owner's changes appear everywhere at once.
 * Phone numbers and hours are not included: they are not confirmed by the clinic yet (docs/BRANCH_LOCATIONS.md).
 */
class PublicBranchController extends Controller
{
    public function index(): JsonResponse
    {
        $branches = Branch::where('status', 'Open')->orderBy('legacy_ref')->get()->values();

        return response()->json(['data' => $branches->map(fn (Branch $b, int $i) => [
            'id' => $b->legacy_ref, 'number' => sprintf('%02d', $i + 1), 'name' => $b->name, 'address' => $b->address, 'city' => $b->city,
            'latitude' => $b->latitude !== null ? (float) $b->latitude : null, 'longitude' => $b->longitude !== null ? (float) $b->longitude : null,
        ])->all()]);
    }
}
