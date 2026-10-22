<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Requests\Feedback\SubmitFeedbackRequest;
use App\Http\Resources\FeedbackVisit;
use App\Http\Resources\PatientFeedbackResource;
use App\Models\PatientFeedback;
use App\Models\Visit;
use App\Services\Feedback\FeedbackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// M26 API (Patient only): submit, list own, list own completed Visits to choose from. There is NO reviewer endpoint: "Owner review" appears only
// in the INTENDED lifecycle of MODULE_COVERAGE.md, not in any current canonical contract, so Owner, Staff, Dentist and guests have no access to
// feedback text until a reviewer policy is approved (fail closed). No edit, delete, reply, status or publication route exists.
class FeedbackController extends Controller
{
    use ReadsIdempotencyKey;

    private const MAX_PER_PAGE = 100;

    public function __construct(private readonly FeedbackService $feedback) {}

    /** The authenticated Patient's own COMPLETED Visits (newest first, keyset): the only Visits they may give feedback about. */
    public function eligibleVisits(Request $request): JsonResponse
    {
        $v = $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:50'], 'cursor' => ['nullable', 'string', 'size:26']]);
        $per = (int) ($v['per_page'] ?? 25);
        $own = fn () => Visit::where('patient_id', $request->user()->patient?->id ?? 0)->where('status', 'Completed');
        $query = $own();
        if (! empty($v['cursor'])) {
            $query->where('id', '<', $own()->select('id')->where('public_id', strtolower($v['cursor']))->limit(1));
        }
        $rows = $query->with('treatment.procedures')->orderByDesc('id')->limit($per + 1)->get();
        $page = $rows->take($per)->values();

        return response()->json(['data' => $page->map(fn ($visit) => FeedbackVisit::for($visit))->all(), 'meta' => ['per_page' => $per, 'next_cursor' => $rows->count() > $per ? $page->last()->public_id : null]]);
    }

    public function store(SubmitFeedbackRequest $request): JsonResponse
    {
        abort_unless($request->user()->patient !== null, 403);

        return $this->feedback->submit($request->user(), $request->validated('visit_id'), $request->validated('body'), $this->idempotencyKey($request, true), $request->validated('rating'));
    }

    /** The Patient's own submissions, newest first, keyset-paged; a foreign cursor is looked up inside the Patient's own rows only. */
    public function mine(Request $request): JsonResponse
    {
        $v = $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE], 'cursor' => ['nullable', 'string', 'size:26'], 'patient_id' => ['prohibited']]);
        $per = (int) ($v['per_page'] ?? 25);
        $own = fn () => PatientFeedback::where('patient_id', $request->user()->patient?->id ?? 0);
        $query = $own();
        if (! empty($v['cursor'])) {
            $query->where('id', '<', $own()->select('id')->where('public_id', strtolower($v['cursor']))->limit(1));
        }
        $rows = $query->with('visit.treatment.procedures')->orderByDesc('id')->limit($per + 1)->get();
        $page = $rows->take($per)->values();

        return response()->json(['data' => PatientFeedbackResource::collection($page)->resolve($request), 'meta' => ['per_page' => $per, 'next_cursor' => $rows->count() > $per ? $page->last()->public_id : null]]);
    }

    /** Owner review screen: filtered by branch, dentist, and rating. */
    public function review(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === \App\Enums\Role::Owner, 403);
        $v = $request->validate([
            'branch_id' => ['nullable', 'string', 'max:50'],
            'dentist_id' => ['nullable', 'string', 'max:50'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
            'cursor' => ['nullable', 'string', 'size:26'],
        ]);
        $per = (int) ($v['per_page'] ?? 25);
        $query = PatientFeedback::with(['patient.person', 'visit.branch', 'visit.dentist.person', 'visit.treatment.procedures']);
        if (! empty($v['branch_id'])) {
            $query->whereHas('visit', function ($q) use ($v) {
                $q->whereIn('branch_id', \App\Models\Branch::select('id')
                    ->where('id', is_numeric($v['branch_id']) ? (int) $v['branch_id'] : 0)
                    ->orWhere('legacy_ref', $v['branch_id'])
                    ->orWhere('public_id', strtolower($v['branch_id'])));
            });
        }
        if (! empty($v['dentist_id'])) {
            $query->whereHas('visit', function ($q) use ($v) {
                $q->whereIn('dentist_profile_id', \App\Models\DentistProfile::select('id')
                    ->where('id', is_numeric($v['dentist_id']) ? (int) $v['dentist_id'] : 0)
                    ->orWhere('legacy_ref', $v['dentist_id'])
                    ->orWhere('public_id', strtolower($v['dentist_id'])));
            });
        }
        if (! empty($v['rating'])) {
            $query->where('rating', (int) $v['rating']);
        }
        if (! empty($v['cursor'])) {
            $query->where('id', '<', PatientFeedback::select('id')->where('public_id', strtolower($v['cursor']))->limit(1));
        }
        $rows = $query->orderByDesc('id')->limit($per + 1)->get();
        $page = $rows->take($per)->values();

        return response()->json([
            'data' => $page->map(fn (PatientFeedback $f) => [
                'id' => $f->public_id,
                'rating' => $f->rating,
                'body' => $f->body,
                'created_at' => $f->created_at?->toIso8601String(),
                'patient' => $f->patient?->person ? ['id' => $f->patient->public_id, 'name' => $f->patient->person->fullName()] : null,
                'branch' => $f->visit?->branch ? ['id' => $f->visit->branch->legacy_ref, 'name' => $f->visit->branch->name] : null,
                'dentist' => $f->visit?->dentist?->person ? ['id' => $f->visit->dentist->legacy_ref, 'name' => $f->visit->dentist->person->fullName()] : null,
                'visit' => $f->visit ? ['id' => $f->visit->public_id, 'clinic_date' => $f->visit->clinic_date?->format('Y-m-d')] : null,
            ])->values(),
            'meta' => [
                'per_page' => $per,
                'next_cursor' => $rows->count() > $per ? $page->last()->public_id : null,
            ],
        ]);
    }
}
