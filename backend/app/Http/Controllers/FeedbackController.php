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

        return $this->feedback->submit($request->user(), $request->validated('visit_id'), $request->validated('body'), $this->idempotencyKey($request, true));
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
}
