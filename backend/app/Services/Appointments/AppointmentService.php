<?php

namespace App\Services\Appointments;

use App\Enums\Role;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\AppointmentCommandKey;
use App\Models\AppointmentHistory;
use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\Patient;
use App\Models\Service;
use App\Models\User;
use App\Services\Scheduling\SchedulingService;
use App\Services\Scheduling\SlotRequest;
use App\Support\ClinicClock;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

// M6 named commands: create, reschedule, cancel (src/workflow.js saveAppointment / cancelAppointment). Each runs in
// one transaction, revalidates through SchedulingService, appends history, and is optionally idempotent. The
// PostgreSQL exclusion constraints are the final guard against concurrent overlapping bookings (SQLSTATE 23P01).
final class AppointmentService
{
    private const RELATIONS = ['patient.person', 'branch', 'service', 'dentist.person'];

    // Competing inserts can deadlock while each checks the exclusion constraint against the other's uncommitted
    // row; PostgreSQL aborts one. Laravel re-runs a deadlocked transaction, and the retry revalidates against the
    // now-committed winner.
    private const ATTEMPTS = 3;

    public function __construct(private readonly SchedulingService $scheduling) {}

    public function create(User $actor, Patient $patient, Branch $branch, Service $service, ?DentistProfile $dentist, array $input, ?string $key): JsonResponse
    {
        $payload = ['patient' => $patient->id, 'branch' => $branch->id, 'service' => $service->id, 'dentist' => $dentist?->id] + $input;

        return $this->idempotent($actor, $key, 'appointment.create', $payload, function () use ($actor, $patient, $branch, $service, $dentist, $input) {
            $isPatient = $actor->role === Role::Patient;
            $request = new SlotRequest($patient, $branch, $service, $dentist, $input['date'], $input['start_time'], $isPatient);

            if ($dentist) {
                $result = $this->scheduling->evaluate($request);
                $method = 'selected';
            } else {
                $choice = $this->scheduling->assignDentist($request);
                $result = $choice['result'] ?? null;
                $dentist = $choice['dentist'] ?? null;
                $method = 'auto';
            }
            if (! $result?->valid) {
                $failures = $this->scheduling->evaluate($request)->failures();
                if (! $dentist) {
                    $failures = array_values(array_filter($failures, fn ($f) => ! str_starts_with($f['key'], 'dentist') && $f['key'] !== 'overlap'));
                    $failures[] = ['key' => 'dentist-assignment', 'label' => 'No Dentist is available for this service, branch and time'];
                }
                throw AppointmentCommandException::invalidSchedule($failures, $this->alternatives($request, $dentist));
            }

            $appointment = Appointment::create([
                'patient_id' => $patient->id,
                'branch_id' => $branch->id,
                'service_id' => $service->id,
                'dentist_profile_id' => $dentist->id,
                'starts_at' => $result->startsAt,
                'ends_at' => $result->endsAt,
                'duration_minutes' => $result->duration,
                'status' => 'Confirmed',
                'source' => $isPatient ? 'patient_portal' : 'front_desk',
                'assignment_method' => $method,
                'assignment_rule_version' => $method === 'auto' ? SchedulingService::RULE_VERSION : null,
                'revision' => 1,
                'notes' => $input['notes'] ?? null,
                'created_by_user_id' => $actor->id,
                'updated_by_user_id' => $actor->id,
            ]);
            $this->record($appointment, $actor, 'appointment.created', null);

            return [$appointment, 201];
        });
    }

    public function reschedule(User $actor, Appointment $appointment, ?DentistProfile $dentist, array $input, ?string $key): JsonResponse
    {
        $payload = ['appointment' => $appointment->id, 'dentist' => $dentist?->id] + $input;

        return $this->idempotent($actor, $key, 'appointment.reschedule', $payload, function () use ($actor, $appointment, $dentist, $input) {
            $current = Appointment::whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            if ($current->revision !== (int) $input['expected_revision']) {
                throw AppointmentCommandException::staleRevision();
            }
            if (! in_array($current->status, ['Pending', 'Confirmed'], true)) {
                throw AppointmentCommandException::rule('appointment_not_reschedulable', 'An admitted or closed appointment cannot be rescheduled.', 'status');
            }
            // A Patient changes only the date and time (the Dentist, branch and service stay fixed).
            $isPatient = $actor->role === Role::Patient;
            $dentist = $isPatient || ! $dentist ? $current->dentist : $dentist;
            $request = new SlotRequest($current->patient, $current->branch, $current->service, $dentist, $input['date'], $input['start_time'], $isPatient, $current->id);
            $result = $this->scheduling->evaluate($request);
            if (! $result->valid) {
                throw AppointmentCommandException::invalidSchedule($result->failures(), $this->alternatives($request, $dentist));
            }
            if ($result->startsAt->equalTo($current->starts_at) && $result->endsAt->equalTo($current->ends_at) && $dentist->id === $current->dentist_profile_id) {
                return [$current, 200];
            }

            $from = $current->status;
            $current->update([
                'starts_at' => $result->startsAt,
                'ends_at' => $result->endsAt,
                'duration_minutes' => $result->duration,
                'dentist_profile_id' => $dentist->id,
                'status' => 'Confirmed',
                'revision' => $current->revision + 1,
                'updated_by_user_id' => $actor->id,
            ]);
            $this->record($current, $actor, 'appointment.rescheduled', $from);

            return [$current, 200];
        });
    }

    public function cancel(User $actor, Appointment $appointment, array $input, ?string $key): JsonResponse
    {
        $payload = ['appointment' => $appointment->id] + $input;

        return $this->idempotent($actor, $key, 'appointment.cancel', $payload, function () use ($actor, $appointment, $input) {
            $current = Appointment::whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            if ($current->status === 'Cancelled') {
                return [$current, 200];
            }
            if ($current->revision !== (int) $input['expected_revision']) {
                throw AppointmentCommandException::staleRevision();
            }
            if (! in_array($current->status, ['Pending', 'Confirmed', 'Checked In'], true)) {
                throw AppointmentCommandException::rule('appointment_not_cancellable', 'This appointment can no longer be cancelled.', 'status');
            }
            $now = ClinicClock::now();
            if ($actor->role === Role::Patient && $current->starts_at->lessThanOrEqualTo($now)) {
                throw AppointmentCommandException::rule('appointment_started', 'This appointment’s scheduled time has passed, so it can’t be cancelled online. Please contact the clinic for assistance.', 'status');
            }

            $from = $current->status;
            $current->update([
                'status' => 'Cancelled',
                'cancelled_at' => $now,
                'revision' => $current->revision + 1,
                'updated_by_user_id' => $actor->id,
            ]);
            $this->record($current, $actor, 'appointment.cancelled', $from);

            return [$current, 200];
        });
    }

    /**
     * Named lifecycle transitions from the frozen appointment state table (CONTRACTS.md): Check-In, No-show, treatment
     * start and completion. M6 keeps the appointment's lifecycle truth; the M8/M9/M5 workflows that decide when these
     * happen stay separate and invoke these commands. A repeat of an already-applied transition returns the current
     * record unchanged (safe retry); anything else needs the expected revision and an allowed source status.
     */
    public function transition(User $actor, Appointment $appointment, string $command, array $input, ?string $key): JsonResponse
    {
        [$from, $to, $event] = self::TRANSITIONS[$command];
        $payload = ['appointment' => $appointment->id] + $input;

        return $this->idempotent($actor, $key, 'appointment.'.$command, $payload, function () use ($actor, $appointment, $command, $from, $to, $event, $input) {
            $current = Appointment::whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            if ($current->status === $to) {
                return [$current, 200];
            }
            if ($current->revision !== (int) $input['expected_revision']) {
                throw AppointmentCommandException::staleRevision();
            }
            if (! in_array($current->status, $from, true)) {
                throw AppointmentCommandException::rule('invalid_transition', "An appointment that is {$current->status} cannot move to {$to}.", 'status');
            }
            // Existing approved Check-In rule (src/workflow.js checkInAppointment): only today's appointments. The
            // earliest-arrival and late-arrival windows remain unresolved clinic policies and are not invented here.
            if ($command === 'check-in' && ClinicClock::local($current->starts_at)->toDateString() !== ClinicClock::today()) {
                throw AppointmentCommandException::rule('not_today', 'Only today’s appointments can be checked in.', 'status');
            }

            $previous = $current->status;
            $current->update([
                'status' => $to,
                'revision' => $current->revision + 1,
                'updated_by_user_id' => $actor->id,
            ]);
            $this->record($current, $actor, $event, $previous);

            return [$current, 200];
        });
    }

    /** command => [allowed source statuses, target status, history event] */
    public const TRANSITIONS = [
        'check-in' => [['Pending', 'Confirmed'], 'Checked In', 'appointment.checked_in'],
        'no-show' => [['Checked In'], 'No-show', 'appointment.no_show'],
        'start-treatment' => [['Checked In'], 'In Treatment', 'appointment.treatment_started'],
        'complete' => [['In Treatment'], 'Completed', 'appointment.completed'],
    ];

    /** Up to five valid start times on the requested date (src/logic.js alternatives). */
    private function alternatives(SlotRequest $request, ?DentistProfile $dentist): array
    {
        if (! ClinicClock::validDate($request->date) || ! $request->branch || ! $request->service) {
            return [];
        }
        $pool = $dentist ? collect([$dentist]) : null;

        return array_map(fn (array $slot) => $slot['start_time'], $this->scheduling->slotsOn($request, $request->date, $pool, null, null, 5));
    }

    private function record(Appointment $appointment, User $actor, string $event, ?string $from): void
    {
        AppointmentHistory::create([
            'appointment_id' => $appointment->id,
            'event' => $event,
            'from_status' => $from,
            'to_status' => $appointment->status,
            'revision' => $appointment->revision,
            'branch_id' => $appointment->branch_id,
            'dentist_profile_id' => $appointment->dentist_profile_id,
            'starts_at' => $appointment->starts_at,
            'ends_at' => $appointment->ends_at,
            'actor_user_id' => $actor->id,
            'actor_role' => $actor->role->value,
            'assignment_rule_version' => $appointment->assignment_rule_version,
            'occurred_at' => ClinicClock::now(),
        ]);
    }

    /**
     * Runs a command once per (account, Idempotency-Key). A replay with the same request returns the stored original
     * response; the same key with a different request is refused (422 idempotency_key_reused). Failed commands store
     * nothing, so they can be retried with the same key.
     */
    private function idempotent(User $actor, ?string $key, string $command, array $payload, Closure $work): JsonResponse
    {
        ksort($payload);
        $hash = hash('sha256', json_encode([$command, $payload]));
        if ($key !== null && ($replay = $this->replay($actor, $key, $hash))) {
            return $replay;
        }

        try {
            [$body, $status] = DB::transaction(function () use ($actor, $key, $command, $hash, $work) {
                $record = $key === null ? null : AppointmentCommandKey::create([
                    'user_id' => $actor->id, 'idempotency_key' => $key, 'command' => $command, 'request_hash' => $hash, 'created_at' => now(),
                ]);
                [$appointment, $status] = $work();
                $body = (new AppointmentResource($appointment->fresh(self::RELATIONS)))->response()->getData(true);
                $record?->update(['appointment_id' => $appointment->id, 'response_status' => $status, 'response_body' => $body]);

                return [$body, $status];
            }, self::ATTEMPTS);
        } catch (UniqueConstraintViolationException $e) {
            if ($key !== null && ($replay = $this->replay($actor, $key, $hash))) {
                return $replay;
            }
            throw $e;
        } catch (QueryException $e) {
            // 23P01 exclusion violation: another request took the time first. 40P01/40001: two competing inserts
            // deadlocked on each other's exclusion check and retries were exhausted — also a lost race.
            if (in_array($e->getCode(), ['23P01', '40P01', '40001'], true)) {
                throw AppointmentCommandException::conflict();
            }
            throw $e;
        }

        return response()->json($body, $status);
    }

    private function replay(User $actor, string $key, string $hash): ?JsonResponse
    {
        $existing = AppointmentCommandKey::where('user_id', $actor->id)->where('idempotency_key', $key)->first();
        if (! $existing) {
            return null;
        }
        if (! hash_equals($existing->request_hash, $hash)) {
            throw AppointmentCommandException::rule('idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'idempotency_key');
        }

        return response()->json($existing->response_body, $existing->response_status)->header('Idempotent-Replayed', 'true');
    }
}
