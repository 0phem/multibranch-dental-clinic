<?php

namespace App\Services\Visits;

use App\Models\Appointment;
use App\Models\AppointmentHistory;
use App\Models\Visit;
use App\Models\VisitHistory;
use App\Support\ClinicClock;
use Illuminate\Support\Facades\DB;

// Server-data-only backfill of Visits for appointments that were checked in through the M6 lifecycle commands before
// the M8 Visit existed (decision D6). Every fact comes from the appointment row and its append-only history:
//   - arrived_at     = the exact `appointment.checked_in` history event;
//   - In Treatment   = requires the `appointment.treatment_started` event;
//   - Completed      = requires the `appointment.completed` event (its time becomes closed_at);
//   - Patient / branch / responsible Dentist = the appointment's canonical foreign keys.
// Nothing is guessed: an appointment whose required facts are missing, or that would give its Patient a second active
// Visit, is skipped and reported as an anomaly. Appointments that were checked in and later closed as Cancelled or
// No-show have no Visit state in this wave (D1) and are reported, not backfilled. Browser-local records are never used.
//
// Deterministic (appointment id order) and idempotent (appointments that already have a Visit are skipped). Every
// backfilled Visit carries a final `visit.backfilled` history marker so the migration can be rolled back exactly.
final class VisitBackfill
{
    public const MARKER = 'visit.backfilled';

    private const VISIT_STATUSES = ['Checked In', 'In Treatment', 'Completed'];

    /** @return array{created:int, anomalies:list<array{appointment:string, code:?string, status:string, reason:string}>} */
    public function run(): array
    {
        $created = 0;
        $anomalies = [];
        $candidates = Appointment::query()
            ->whereDoesntHave('visit')
            ->whereIn('status', [...self::VISIT_STATUSES, 'Cancelled', 'No-show'])
            ->orderBy('id')
            ->get();

        foreach ($candidates as $appointment) {
            $history = AppointmentHistory::where('appointment_id', $appointment->id)->orderBy('id')->get();
            $event = fn (string $name) => $history->firstWhere('event', $name);
            $checkedIn = $event('appointment.checked_in');
            $report = function (string $reason) use (&$anomalies, $appointment) {
                $anomalies[] = ['appointment' => $appointment->public_id, 'code' => $appointment->appointment_code, 'status' => $appointment->status, 'reason' => $reason];
            };

            if (! in_array($appointment->status, self::VISIT_STATUSES, true)) {
                if ($checkedIn) {
                    $report('closed_after_check_in');
                }

                continue;
            }
            if (! $checkedIn) {
                $report('missing_check_in_event');

                continue;
            }
            $started = $event('appointment.treatment_started');
            $completed = $event('appointment.completed');
            if ($appointment->status !== 'Checked In' && ! $started) {
                $report('missing_treatment_started_event');

                continue;
            }
            if ($appointment->status === 'Completed' && ! $completed) {
                $report('missing_completed_event');

                continue;
            }
            if ($appointment->status !== 'Completed'
                && Visit::where('patient_id', $appointment->patient_id)->whereIn('status', Visit::ACTIVE_STATUSES)->exists()) {
                $report('patient_has_active_visit');

                continue;
            }

            DB::transaction(function () use ($appointment, $checkedIn, $started, $completed) {
                $steps = [['visit.checked_in', null, 'Checked In', $checkedIn]];
                if ($appointment->status !== 'Checked In') {
                    $steps[] = ['visit.treatment_started', 'Checked In', 'In Treatment', $started];
                }
                if ($appointment->status === 'Completed') {
                    $steps[] = ['visit.completed', 'In Treatment', 'Completed', $completed];
                }
                $last = end($steps)[3];
                $arrivedAt = ClinicClock::local($checkedIn->occurred_at);

                $visit = Visit::create([
                    'patient_id' => $appointment->patient_id,
                    'branch_id' => $appointment->branch_id,
                    'appointment_id' => $appointment->id,
                    'source' => 'appointment',
                    'status' => $appointment->status,
                    'responsible_dentist_profile_id' => $appointment->dentist_profile_id,
                    'arrived_at' => $arrivedAt,
                    'clinic_date' => $arrivedAt->toDateString(),
                    'revision' => count($steps),
                    'created_by_user_id' => $checkedIn->actor_user_id,
                    'updated_by_user_id' => $last->actor_user_id,
                    'closed_at' => $appointment->status === 'Completed' ? $completed->occurred_at : null,
                ]);
                foreach ($steps as $i => [$name, $from, $to, $source]) {
                    VisitHistory::create([
                        'visit_id' => $visit->id, 'event' => $name, 'from_status' => $from, 'to_status' => $to, 'revision' => $i + 1,
                        'responsible_dentist_profile_id' => $appointment->dentist_profile_id,
                        'actor_user_id' => $source->actor_user_id, 'actor_role' => $source->actor_role, 'occurred_at' => $source->occurred_at,
                    ]);
                }
                VisitHistory::create([
                    'visit_id' => $visit->id, 'event' => self::MARKER, 'from_status' => $appointment->status, 'to_status' => $appointment->status,
                    'revision' => count($steps), 'responsible_dentist_profile_id' => $appointment->dentist_profile_id,
                    'actor_user_id' => null, 'actor_role' => 'system', 'occurred_at' => ClinicClock::now(),
                ]);
            });
            $created++;
        }

        return ['created' => $created, 'anomalies' => $anomalies];
    }

    /** Removes exactly the backfilled Visits (identified by their marker) and their history. */
    public function rollback(): int
    {
        $ids = VisitHistory::where('event', self::MARKER)->pluck('visit_id')->unique()->values()->all();
        if (! $ids) {
            return 0;
        }
        DB::transaction(function () use ($ids) {
            // The history trigger forbids deletes during normal operation; a schema rollback is the one exception.
            DB::statement('ALTER TABLE visit_history DISABLE TRIGGER visit_history_no_update_delete');
            VisitHistory::whereIn('visit_id', $ids)->delete();
            DB::statement('ALTER TABLE visit_history ENABLE TRIGGER visit_history_no_update_delete');
            Visit::whereIn('id', $ids)->delete();
        });

        return count($ids);
    }
}
