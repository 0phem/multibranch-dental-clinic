<?php

namespace Tests\Feature\Visits;

use App\Models\Appointment;
use App\Models\AppointmentHistory;
use App\Models\Visit;
use App\Models\VisitHistory;
use App\Services\Visits\VisitBackfill;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// D6: Visits are backfilled only from authoritative server data (appointment row + its append-only history).
class VisitBackfillTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        foreach (['C', 'D', 'E'] as $i => $key) {
            [, $this->p[$key]] = $this->patient('PAT-000'.($i + 3));
        }
    }

    /** An appointment moved through the retired M6 lifecycle commands, with exactly the given history events. */
    private function progressed(string $patient, string $dentist, string $time, string $status, array $events): Appointment
    {
        $a = $this->existing($patient, $dentist, 'b1', 'svc1', '2026-09-28', $time, 30, $status);
        foreach ($events as $i => [$event, $at]) {
            AppointmentHistory::create([
                'appointment_id' => $a->id, 'event' => $event, 'from_status' => null, 'to_status' => $status, 'revision' => $i + 2,
                'branch_id' => $a->branch_id, 'dentist_profile_id' => $a->dentist_profile_id, 'starts_at' => $a->starts_at, 'ends_at' => $a->ends_at,
                'actor_user_id' => $this->u['staffB1']->id, 'actor_role' => 'staff',
                'occurred_at' => CarbonImmutable::parse("2026-09-28 {$at}", 'Asia/Manila'),
            ]);
        }

        return $a;
    }

    public function test_backfill_uses_exact_history_facts_reports_anomalies_and_is_idempotent_and_reversible(): void
    {
        $checkedIn = $this->progressed('A', 'd1', '09:30', 'Checked In', [['appointment.checked_in', '09:41']]);
        $completed = $this->progressed('B', 'd2', '09:00', 'Completed', [
            ['appointment.checked_in', '08:55'], ['appointment.treatment_started', '09:05'], ['appointment.completed', '09:32'],
        ]);
        $missing = $this->progressed('C', 'd1', '10:00', 'In Treatment', [['appointment.treatment_started', '10:02']]);
        $noShowAfterArrival = $this->progressed('D', 'd2', '10:00', 'No-show', [['appointment.checked_in', '09:58'], ['appointment.no_show', '10:30']]);
        $untouched = $this->existing('E', 'd3', 'b2', 'svc1', '2026-09-28', '11:00');

        $report = app(VisitBackfill::class)->run();

        $this->assertSame(2, $report['created']);
        $this->assertEqualsCanonicalizing([
            [$missing->public_id, 'missing_check_in_event'],
            [$noShowAfterArrival->public_id, 'closed_after_check_in'],
        ], array_map(fn ($r) => [$r['appointment'], $r['reason']], $report['anomalies']));

        $a = Visit::where('appointment_id', $checkedIn->id)->sole();
        $this->assertSame(['appointment', 'Checked In', $checkedIn->patient_id, $checkedIn->branch_id, $checkedIn->dentist_profile_id],
            [$a->source, $a->status, $a->patient_id, $a->branch_id, $a->responsible_dentist_profile_id]);
        $this->assertSame('2026-09-28T09:41:00+08:00', $a->arrived_at->setTimezone('Asia/Manila')->toIso8601String());
        $this->assertNull($a->closed_at);

        $b = Visit::where('appointment_id', $completed->id)->sole();
        $this->assertSame('Completed', $b->status);
        $this->assertSame(3, $b->revision);
        $this->assertSame('2026-09-28T09:32:00+08:00', $b->closed_at->setTimezone('Asia/Manila')->toIso8601String());
        $this->assertSame(['visit.checked_in', 'visit.treatment_started', 'visit.completed', VisitBackfill::MARKER],
            VisitHistory::where('visit_id', $b->id)->orderBy('id')->pluck('event')->all());
        $this->assertFalse(Visit::where('appointment_id', $untouched->id)->exists());

        // Idempotent: nothing new on a second run.
        $this->assertSame(0, app(VisitBackfill::class)->run()['created']);
        $this->assertSame(2, Visit::count());

        // Reversible: only the backfilled Visits go; a Visit created through the API stays.
        $this->actingAsUser('staffBoth');
        $this->postJson('/api/visits/walk-in', ['patient_id' => $this->p['E']->public_id, 'branch_ref' => 'b2'], ['Idempotency-Key' => 'w'])->assertCreated();
        $this->assertSame(2, app(VisitBackfill::class)->rollback());
        $this->assertSame(1, Visit::count());
        $this->assertSame('walk_in', Visit::sole()->source);
    }

    public function test_backfill_never_gives_a_patient_a_second_active_visit(): void
    {
        $this->actingAsUser('staffB1');
        $this->postJson('/api/visits/walk-in', ['patient_id' => $this->p['A']->public_id, 'branch_ref' => 'b1'], ['Idempotency-Key' => 'w'])->assertCreated();
        $appointment = $this->progressed('A', 'd1', '09:30', 'Checked In', [['appointment.checked_in', '09:41']]);

        $report = app(VisitBackfill::class)->run();
        $this->assertSame(0, $report['created']);
        $this->assertSame('patient_has_active_visit', $report['anomalies'][0]['reason']);
        $this->assertSame($appointment->public_id, $report['anomalies'][0]['appointment']);
    }
}
