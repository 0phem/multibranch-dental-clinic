<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Requests\Treatment\DocumentTreatmentRequest;
use App\Http\Requests\Treatment\TreatmentCommandRequest;
use App\Http\Resources\PatientTreatmentResource;
use App\Http\Resources\TreatmentResource;
use App\Models\Treatment;
use App\Models\Visit;
use App\Services\Treatments\TreatmentService;
use App\Support\ClinicClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

// M5 Treatment API. Controllers only resolve references and authorize; every rule and state change lives in
// TreatmentService's named commands (no generic PATCH). Reads are role-scoped (Treatment::scopeVisibleTo) and projected
// per role (TreatmentResource / PatientTreatmentResource).
class TreatmentController extends Controller
{
    use ReadsIdempotencyKey;

    // Same bounded window as the appointment and Visit lists.
    private const MAX_RANGE_DAYS = 184;

    public function __construct(private readonly TreatmentService $treatments) {}

    public function index(Request $request)
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d', 'prohibits:from,to'],
            'from' => ['nullable', 'date_format:Y-m-d', 'required_with:to'],
            'to' => ['nullable', 'date_format:Y-m-d', 'required_with:from', 'after_or_equal:from'],
            'status' => ['nullable', 'in:In Treatment,Completed'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        [$from, $to] = isset($validated['date']) ? [$validated['date'], $validated['date']] : [$validated['from'] ?? null, $validated['to'] ?? null];
        if (! $from) {
            $from = $to = ClinicClock::today();
        }
        if (ClinicClock::at($from, '00:00')->diffInDays(ClinicClock::at($to, '00:00')) >= self::MAX_RANGE_DAYS) {
            throw ValidationException::withMessages(['to' => 'A date range may cover at most '.self::MAX_RANGE_DAYS.' days.']);
        }
        $query = Treatment::visibleTo($request->user())->with(TreatmentService::RELATIONS)
            ->whereHas('visit', fn ($v) => $v->whereBetween('clinic_date', [$from, $to]))
            ->when($validated['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderBy('started_at')->orderBy('id');

        return TreatmentResource::collection($query->paginate($validated['per_page'] ?? 50)->withQueryString());
    }

    public function show(Treatment $treatment): TreatmentResource
    {
        $treatment->load([...TreatmentService::RELATIONS, 'history']);
        Gate::authorize('view', $treatment);

        return new TreatmentResource($treatment);
    }

    /** The signed-in Patient's own COMPLETED Treatments (safe subset). The Patient comes from the account, never a parameter. */
    public function mine(Request $request)
    {
        $user = $request->user();
        abort_unless($user->role === Role::Patient && $user->patient !== null, 403, 'Forbidden.');
        $request->validate(['patient_id' => ['prohibited']]);
        $rows = Treatment::where('status', 'Completed')
            ->whereHas('visit', fn ($v) => $v->where('patient_id', $user->patient->id))
            ->with(['visit', 'dentist.person', 'procedures'])
            ->orderByDesc('completed_at')->orderByDesc('id')->limit(200)->get();

        return PatientTreatmentResource::collection($rows);
    }

    public function start(TreatmentCommandRequest $request, Visit $visit): JsonResponse
    {
        $visit->load('dentist');
        Gate::authorize('start', [Treatment::class, $visit]);

        return $this->treatments->start($request->user(), $visit, (int) $request->validated('expected_revision'), $this->idempotencyKey($request, true), $this->presenter($request));
    }

    public function document(DocumentTreatmentRequest $request, Treatment $treatment): JsonResponse
    {
        $treatment->load(['dentist', 'visit']);
        Gate::authorize('author', $treatment);

        return $this->treatments->document($request->user(), $treatment, (int) $request->validated('expected_revision'), $request->documentation(), $this->idempotencyKey($request, true), $this->presenter($request));
    }

    public function complete(TreatmentCommandRequest $request, Treatment $treatment): JsonResponse
    {
        $treatment->load(['dentist', 'visit']);
        Gate::authorize('author', $treatment);

        return $this->treatments->complete($request->user(), $treatment, (int) $request->validated('expected_revision'), $this->idempotencyKey($request, true), $this->presenter($request));
    }

    private function presenter(Request $request): \Closure
    {
        return fn (Treatment $treatment) => (new TreatmentResource($treatment))->response($request)->getData(true);
    }
}
