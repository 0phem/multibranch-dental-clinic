<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Requests\Appointment\AvailabilityRequest;
use App\Http\Requests\Appointment\CancelAppointmentRequest;
use App\Http\Requests\Appointment\RecommendationRequest;
use App\Http\Requests\Appointment\RescheduleAppointmentRequest;
use App\Http\Requests\Appointment\StoreAppointmentRequest;
use App\Http\Requests\Appointment\TransitionAppointmentRequest;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\Patient;
use App\Models\Service;
use App\Services\Appointments\AppointmentService;
use App\Services\Scheduling\SchedulingService;
use App\Services\Scheduling\SlotRequest;
use App\Support\ClinicClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

// M6 Appointment API. Controllers only resolve references and authorize; every scheduling rule lives in
// SchedulingService and every state change in AppointmentService's named commands.
class AppointmentController extends Controller
{
    private const RELATIONS = ['patient.person', 'branch', 'service', 'dentist.person'];

    public function __construct(
        private readonly AppointmentService $appointments,
        private readonly SchedulingService $scheduling,
    ) {}

    // Longest clinic-date range one list request may cover (about three months back and three ahead); results stay
    // paginated within it, so there is no unbounded "return everything" request.
    private const MAX_RANGE_DAYS = 184;

    public function index(Request $request)
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d', 'prohibits:from,to'],
            'from' => ['nullable', 'date_format:Y-m-d', 'required_with:to'],
            'to' => ['nullable', 'date_format:Y-m-d', 'required_with:from', 'after_or_equal:from'],
            'status' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        [$from, $to] = isset($validated['date']) ? [$validated['date'], $validated['date']] : [$validated['from'] ?? null, $validated['to'] ?? null];
        if ($from && ClinicClock::at($from, '00:00')->diffInDays(ClinicClock::at($to, '00:00')) >= self::MAX_RANGE_DAYS) {
            throw ValidationException::withMessages(['to' => 'A date range may cover at most '.self::MAX_RANGE_DAYS.' days.']);
        }
        $query = Appointment::visibleTo($request->user())->with(self::RELATIONS)
            ->when($validated['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($from, fn ($q) => $q->where('starts_at', '>=', SchedulingService::ts(ClinicClock::at($from, '00:00')))
                ->where('starts_at', '<', SchedulingService::ts(ClinicClock::at($to, '00:00')->addDay())))
            ->orderBy('starts_at')->orderBy('id');

        return AppointmentResource::collection($query->paginate($validated['per_page'] ?? 50)->withQueryString());
    }

    public function show(Request $request, Appointment $appointment): AppointmentResource
    {
        Gate::authorize('view', $appointment);

        return new AppointmentResource($appointment->load([...self::RELATIONS, 'history']));
    }

    public function store(StoreAppointmentRequest $request): JsonResponse
    {
        $user = $request->user();
        $branch = Branch::where('legacy_ref', $request->validated('branch_ref'))->firstOrFail();
        Gate::authorize('book', [Appointment::class, $branch]);

        $patient = $user->role === Role::Patient
            ? $user->patient
            : Patient::where('public_id', $request->validated('patient_id'))->firstOrFail();
        $dentistRef = $request->validated('dentist_ref');

        return $this->appointments->create(
            $user,
            $patient,
            $branch,
            Service::where('legacy_ref', $request->validated('service_ref'))->firstOrFail(),
            $dentistRef ? DentistProfile::where('legacy_ref', $dentistRef)->firstOrFail() : null,
            $request->safe()->only(['date', 'start_time', 'notes']),
            $this->idempotencyKey($request),
        );
    }

    public function reschedule(RescheduleAppointmentRequest $request, Appointment $appointment): JsonResponse
    {
        Gate::authorize('reschedule', $appointment);
        $dentistRef = $request->validated('dentist_ref');

        return $this->appointments->reschedule(
            $request->user(),
            $appointment,
            $dentistRef ? DentistProfile::where('legacy_ref', $dentistRef)->firstOrFail() : null,
            $request->safe()->only(['date', 'start_time', 'expected_revision']),
            $this->idempotencyKey($request),
        );
    }

    public function cancel(CancelAppointmentRequest $request, Appointment $appointment): JsonResponse
    {
        Gate::authorize('cancel', $appointment);

        return $this->appointments->cancel($request->user(), $appointment, $request->safe()->only(['expected_revision']), $this->idempotencyKey($request));
    }

    /** Named lifecycle commands: check-in, no-show, start-treatment, complete (see AppointmentService::TRANSITIONS). */
    public function transition(TransitionAppointmentRequest $request, Appointment $appointment, string $command): JsonResponse
    {
        Gate::authorize('transition', [$appointment, $command]);

        return $this->appointments->transition($request->user(), $appointment, $command, $request->safe()->only(['expected_revision']), $this->idempotencyKey($request));
    }

    public function availability(AvailabilityRequest $request): JsonResponse
    {
        $user = $request->user();
        $branch = Branch::where('legacy_ref', $request->validated('branch_ref'))->firstOrFail();
        Gate::authorize('book', [Appointment::class, $branch]);
        $service = Service::where('legacy_ref', $request->validated('service_ref'))->firstOrFail();
        $isPatient = $user->role === Role::Patient;
        $patientId = $request->validated('patient_id');
        $patient = $isPatient ? $user->patient : ($patientId ? Patient::where('public_id', $patientId)->first() : null);

        $ignore = null;
        if ($publicId = $request->validated('appointment_id')) {
            $ignore = Appointment::where('public_id', $publicId)->firstOrFail();
            Gate::authorize('reschedule', $ignore);
        }

        $date = $request->validated('date');
        $base = new SlotRequest($patient, $branch, $service, null, null, null, $isPatient, $ignore?->id, requirePatient: false);
        // A Patient reschedule keeps the same Dentist (AppointmentService::reschedule), so its search is limited to
        // that Dentist; Staff/Owner may move an appointment to any eligible Dentist.
        $dentistRef = $request->validated('dentist_ref');
        $pool = $isPatient && $ignore ? collect([$ignore->dentist])
            : ($dentistRef ? collect([DentistProfile::where('legacy_ref', $dentistRef)->firstOrFail()]) : null);
        $slots = $this->scheduling->slotsOn($base, $date, $pool);

        return response()->json(['data' => [
            'date' => $date,
            'branch' => ['id' => $branch->legacy_ref, 'name' => $branch->name],
            'service' => ['id' => $service->legacy_ref, 'name' => $service->name, 'duration_minutes' => $this->scheduling->duration($branch, $service)],
            'rules' => $this->rules($isPatient),
            'slots' => array_map(fn (array $slot) => $this->slot($slot), $slots),
        ]]);
    }

    public function recommendation(RecommendationRequest $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->patient !== null, 403, 'Forbidden.');
        $service = Service::where('legacy_ref', $request->validated('service_ref'))->firstOrFail();
        $branchRef = $request->validated('branch_ref');
        $branch = $branchRef ? Branch::where('legacy_ref', $branchRef)->firstOrFail() : null;
        $lat = $request->validated('latitude');
        $lng = $request->validated('longitude');

        $outcome = $this->scheduling->recommend(
            new SlotRequest($user->patient, $branch, $service, null, null, null, true),
            $lat === null ? null : (float) $lat,
            $lng === null ? null : (float) $lng,
        );
        $found = $outcome['recommendation'];

        return response()->json(['data' => [
            'service' => ['id' => $service->legacy_ref, 'name' => $service->name],
            'location_ranking' => $outcome['location_ranking'],
            'eligible_branches' => $outcome['eligible_branches']->map(fn (Branch $b) => [
                'id' => $b->legacy_ref,
                'name' => $b->name,
                'has_coordinates' => $b->latitude !== null && $b->longitude !== null,
            ])->values(),
            'rules' => $this->rules(true),
            // A recommendation reserves nothing; the create command revalidates everything.
            'recommendation' => $found ? [
                'branch' => ['id' => $found['branch']->legacy_ref, 'name' => $found['branch']->name],
                'duration_minutes' => $found['result']->duration,
                'reserved' => false,
            ] + $this->slot($found) : null,
        ]]);
    }

    private function slot(array $slot): array
    {
        return [
            'date' => $slot['date'],
            'start_time' => $slot['start_time'],
            'end_time' => ClinicClock::local($slot['result']->endsAt)->format('H:i'),
            'starts_at' => ClinicClock::local($slot['result']->startsAt)->toIso8601String(),
            'ends_at' => ClinicClock::local($slot['result']->endsAt)->toIso8601String(),
            'dentist' => ['id' => $slot['dentist']->legacy_ref, 'name' => $slot['dentist']->person?->fullName()],
        ];
    }

    private function rules(bool $patient): array
    {
        [$first, $last] = $this->scheduling->patientWindow();

        return $patient
            ? ['start_grid_minutes' => SchedulingService::PATIENT_GRID_MINUTES, 'window' => ['first_date' => $first, 'last_date' => $last]]
            : ['start_grid_minutes' => SchedulingService::STAFF_GRID_MINUTES, 'window' => null];
    }

    private function idempotencyKey(Request $request): ?string
    {
        $key = $request->header('Idempotency-Key');
        if ($key === null) {
            return null;
        }
        if (! is_string($key) || $key === '' || strlen($key) > 255 || preg_match('/[^\x21-\x7E]/', $key)) {
            throw ValidationException::withMessages(['idempotency_key' => 'The Idempotency-Key header must be 1–255 visible ASCII characters.']);
        }

        return $key;
    }
}
