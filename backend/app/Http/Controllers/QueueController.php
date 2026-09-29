<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Requests\Queue\QueuePriorityRequest;
use App\Http\Requests\Queue\QueueTransitionRequest;
use App\Http\Resources\QueueEntryResource;
use App\Models\QueueEntry;
use App\Services\Queue\QueueService;
use App\Support\ClinicClock;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

// M9 Queue API. Controllers only resolve references and authorize; every rule and state change lives in QueueService's
// named commands (no generic status PATCH). Queue entries are created only by M8 arrival.
class QueueController extends Controller
{
    use ReadsIdempotencyKey;

    public function __construct(private readonly QueueService $queue) {}

    /** One clinic day's queue (default today), role-scoped; positions are computed by the server. */
    public function index(Request $request)
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'branch_ref' => ['nullable', 'string'],
            'dentist_ref' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);
        $date = $validated['date'] ?? ClinicClock::today();
        $entries = QueueEntry::visibleTo($request->user())->with(QueueService::RELATIONS)
            ->whereHas('dentistQueue', function (Builder $q) use ($date, $validated) {
                $q->where('clinic_date', $date)
                    ->when($validated['branch_ref'] ?? null, fn ($b, $ref) => $b->whereHas('branch', fn ($x) => $x->where('legacy_ref', $ref)))
                    ->when($validated['dentist_ref'] ?? null, fn ($d, $ref) => $d->whereHas('dentist', fn ($x) => $x->where('legacy_ref', $ref)));
            })
            ->when($validated['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderBy('dentist_queue_id')->orderBy('queue_number')
            ->limit(500)->get();
        $this->queue->withPositions($entries);

        return QueueEntryResource::collection($entries);
    }

    public function show(QueueEntry $queueEntry): QueueEntryResource
    {
        Gate::authorize('view', $queueEntry);
        $entry = $queueEntry->load([...QueueService::RELATIONS, 'history']);
        $this->queue->withPositions([$entry]);

        return new QueueEntryResource($entry);
    }

    public function transition(QueueTransitionRequest $request, QueueEntry $queueEntry, string $command): JsonResponse
    {
        Gate::authorize($command === 'call' ? 'call' : 'operate', $queueEntry);

        return $this->queue->transition($request->user(), $queueEntry, $command, (int) $request->validated('expected_revision'), $this->idempotencyKey($request, true));
    }

    public function priority(QueuePriorityRequest $request, QueueEntry $queueEntry): JsonResponse
    {
        Gate::authorize('operate', $queueEntry);

        return $this->queue->priority($request->user(), $queueEntry, $request->validated('priority'), $request->validated('reason'),
            (int) $request->validated('expected_revision'), $this->idempotencyKey($request, true));
    }

    /** The authenticated Patient's own current queue state (identity from the session; no Patient id is accepted). */
    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === Role::Patient && $user->patient !== null, 403, 'Forbidden.');

        return response()->json(['data' => $this->queue->patientCurrent($user->patient)]);
    }
}
