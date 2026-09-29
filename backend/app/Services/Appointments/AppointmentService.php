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
use App\Support\IdempotentCommand;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;

// M6 named commands: create, reschedule, cancel and the pre-arrival No-show. Each runs in one transaction,
// revalidates through SchedulingService, appends history, and is optionally idempotent. The PostgreSQL exclusion
// constraints are the final guard against concurrent overlapping bookings (SQLSTATE 23P01). Arrival (Check-In) and the
// clinical progression (treatment start/completion) are Visit commands (App\Services\Visits\VisitService), which
// move the linked appointment in the same transaction — there is no second path for them here.
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
            // Once the Patient has arrived there is a Visit, and leaving or cancelling after Check-In needs a future
            // Visit/Queue clinic-policy decision (no Visit Cancelled state exists yet), so it is refused here.
            if ($current->status === 'Checked In' || $current->visit()->exists()) {
                throw AppointmentCommandException::rule('appointment_admitted', 'This patient has already checked in. Cancelling after Check-In isn’t available yet — the clinic needs to decide how an admitted visit is closed.', 'status');
            }
            if (! in_array($current->status, ['Pending', 'Confirmed'], true)) {
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
     * Appointment-only lifecycle transitions (CONTRACTS.md): today only the pre-arrival No-show — the scheduled Patient
     * did not arrive, so no Visit exists or is created. It is a manual same-day Staff decision; no lateness threshold
     * is applied (unresolved policy P4). A repeat of an already-applied transition returns the current record unchanged
     * (safe retry); anything else needs the expected revision and an allowed source status.
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
            if ($current->visit()->exists()) {
                throw AppointmentCommandException::rule('appointment_admitted', 'This patient has already checked in, so the appointment can’t be marked No-show.', 'status');
            }
            if (ClinicClock::local($current->starts_at)->toDateString() !== ClinicClock::today()) {
                throw AppointmentCommandException::rule('not_today', 'Only today’s appointments can be marked No-show.', 'status');
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
        'no-show' => [['Pending', 'Confirmed'], 'No-show', 'appointment.no_show'],
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

    /** Appends appointment history; also used by VisitService when a Visit command moves the linked appointment. */
    public function record(Appointment $appointment, User $actor, string $event, ?string $from): void
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

    /** One command per (account, Idempotency-Key) — the shared mechanism in App\Support\IdempotentCommand. */
    private function idempotent(User $actor, ?string $key, string $command, array $payload, Closure $work): JsonResponse
    {
        return IdempotentCommand::run(
            AppointmentCommandKey::class, $actor, $key, $command, $payload,
            function () use ($work) {
                [$appointment, $status] = $work();
                $body = (new AppointmentResource($appointment->fresh(self::RELATIONS)))->response()->getData(true);

                return [$body, $status, ['appointment_id' => $appointment->id]];
            },
            fn () => AppointmentCommandException::rule('idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'idempotency_key'),
            function (QueryException $e) {
                // 23P01 exclusion violation: another request took the time first. 40P01/40001: two competing inserts
                // deadlocked on each other's exclusion check and retries were exhausted — also a lost race.
                if (in_array($e->getCode(), ['23P01', '40P01', '40001'], true)) {
                    throw AppointmentCommandException::conflict();
                }
            },
            self::ATTEMPTS,
        );
    }
}
