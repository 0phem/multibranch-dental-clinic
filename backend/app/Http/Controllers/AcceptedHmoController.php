<?php

namespace App\Http\Controllers;

use App\Models\AcceptedHmo;
use App\Models\Branch;
use App\Services\Audit\AuditService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * F8 HMO information only (R2-16): the Owner's "Accepted HMOs" list per branch (or all branches). Only rows the clinic verified
 * and kept active are shown to patients (landing page, FAQ, assistant). No claims, no coverage calculation. Patients may store
 * their own HMO provider and member number for the front desk to check at the visit.
 */
class AcceptedHmoController extends Controller
{
    /** Verified, active HMOs for patients: [{name, branch|null, note}], all-branch rows first. */
    public static function publicList(): array
    {
        return AcceptedHmo::where('verified_by_clinic', true)->where('active', true)->with('branch')->orderByRaw('branch_id IS NOT NULL')->orderBy('name')->get()
            ->map(fn (AcceptedHmo $h) => ['name' => $h->name, 'branch' => $h->branch?->name, 'note' => $h->note])->values()->all();
    }

    /** @return string[] names for the assistant (branch-specific rows say which branch) */
    public static function publicNames(): array
    {
        return array_map(fn ($h) => $h['name'].($h['branch'] ? " ({$h['branch']})" : ''), self::publicList());
    }

    public function publicIndex(): JsonResponse
    {
        return response()->json(['data' => self::publicList()]);
    }

    public function index(): JsonResponse
    {
        return response()->json(['data' => AcceptedHmo::with('branch')->orderByDesc('active')->orderBy('name')->get()->map(fn ($h) => $this->view($h))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:120'], 'note' => ['nullable', 'string', 'max:200'], 'branch_ref' => ['nullable', 'string', 'max:50']]);
        $branch = ! empty($data['branch_ref']) ? Branch::where('legacy_ref', $data['branch_ref'])->firstOrFail() : null;
        try {
            $hmo = AcceptedHmo::create(['name' => trim($data['name']), 'note' => $data['note'] ?? null, 'branch_id' => $branch?->id, 'updated_by_user_id' => $request->user()->id]);
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') throw ValidationException::withMessages(['name' => ['This HMO is already on the list for that branch.']]);

            throw $e;
        }
        app(AuditService::class)->recordAdministrative('accepted_hmo.created', $request->user(), $hmo, ['name' => $hmo->name, 'branch' => $branch?->legacy_ref]);

        return response()->json(['data' => $this->view($hmo->fresh('branch'))], 201);
    }

    /** Verify (the clinic confirmed it), unverify, switch on/off, or edit the note. Optimistic revision. */
    public function update(Request $request, AcceptedHmo $acceptedHmo): JsonResponse
    {
        $data = $request->validate(['verified' => ['sometimes', 'boolean'], 'active' => ['sometimes', 'boolean'], 'note' => ['sometimes', 'nullable', 'string', 'max:200'], 'expected_revision' => ['required', 'integer']]);
        if ($acceptedHmo->revision !== (int) $data['expected_revision']) return response()->json(['message' => 'Someone else changed this HMO. Reload the list.', 'code' => 'stale_revision'], 409);
        $old = $acceptedHmo->only(['verified_by_clinic', 'active', 'note']);
        if (array_key_exists('verified', $data)) {
            $acceptedHmo->verified_by_clinic = $data['verified'];
            $acceptedHmo->verified_at = $data['verified'] ? now() : null;
            $acceptedHmo->verified_by_user_id = $data['verified'] ? $request->user()->id : null;
        }
        if (array_key_exists('active', $data)) $acceptedHmo->active = $data['active'];
        if (array_key_exists('note', $data)) $acceptedHmo->note = $data['note'];
        $acceptedHmo->revision++;
        $acceptedHmo->updated_by_user_id = $request->user()->id;
        $acceptedHmo->save();
        app(AuditService::class)->recordAdministrative('accepted_hmo.updated', $request->user(), $acceptedHmo, ['old' => $old, 'new' => $acceptedHmo->only(['verified_by_clinic', 'active', 'note'])]);

        return response()->json(['data' => $this->view($acceptedHmo->fresh('branch'))]);
    }

    /** Patient: their own HMO provider and member number (optional), for the front desk to check at the visit. */
    public function myProfile(Request $request): JsonResponse
    {
        $patient = $request->user()->patient;
        abort_unless($patient, 403);
        if ($request->isMethod('get')) return response()->json(['data' => $this->profile($patient)]);
        $data = $request->validate(['hmo_provider_name' => ['nullable', 'string', 'max:120'], 'hmo_member_number' => ['nullable', 'string', 'max:60', 'regex:/^[A-Za-z0-9 \-\/]*$/']]);
        $patient->forceFill(['hmo_provider_name' => ($data['hmo_provider_name'] ?? null) ?: null, 'hmo_member_number' => ($data['hmo_member_number'] ?? null) ?: null])->save();
        app(AuditService::class)->recordAdministrative('patient.hmo_profile_updated', $request->user(), $patient, ['fields' => ['hmo_provider_name', 'hmo_member_number']]);

        return response()->json(['data' => $this->profile($patient)]);
    }

    private function profile($patient): array
    {
        return ['hmo_provider_name' => $patient->hmo_provider_name, 'hmo_member_number' => $patient->hmo_member_number, 'accepted' => self::publicList()];
    }

    private function view(AcceptedHmo $h): array
    {
        return ['id' => $h->public_id, 'name' => $h->name, 'note' => $h->note, 'branch' => $h->branch ? ['id' => $h->branch->legacy_ref, 'name' => $h->branch->name] : null,
            'verified' => $h->verified_by_clinic, 'verified_at' => $h->verified_at?->toIso8601String(), 'active' => $h->active, 'revision' => $h->revision];
    }
}
