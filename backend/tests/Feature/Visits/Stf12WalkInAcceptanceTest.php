<?php

namespace Tests\Feature\Visits;

use App\Models\QueueEntry;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

/** Fictional, scratch-guarded Staff acceptance for STF-12's existing walk-in form. */
class Stf12WalkInAcceptanceTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    private function admit(string $key = 'stf12-admission', array $changes = [])
    {
        return $this->postJson('/api/visits/walk-in', $changes + [
            'patient_id' => $this->p['A']->public_id,
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'dentist_ref' => 'd1',
        ], ['Idempotency-Key' => $key]);
    }

    public function test_staff_admits_existing_patient_and_replay_preserves_one_visit_and_queue_entry(): void
    {
        $this->actingAsUser('staffB1');
        $response = $this->admit()->assertCreated()
            ->assertJsonPath('data.patient.id', $this->p['A']->public_id)
            ->assertJsonPath('data.branch.id', 'b1')
            ->assertJsonPath('data.service.id', 'svc1')
            ->assertJsonPath('data.dentist.id', 'd1')
            ->assertJsonPath('data.clinic_date', '2026-09-28')
            ->assertJsonPath('data.arrived_at', '2026-09-28T10:00:00+08:00')
            ->assertJsonPath('data.queue.status', 'Waiting')
            ->assertJsonPath('data.queue.queue_number', 1);

        $visit = Visit::sole();
        $queue = QueueEntry::sole();
        $this->assertSame($response->json('data.id'), $visit->public_id);
        $this->assertSame($response->json('data.queue.id'), $queue->public_id);
        $this->assertSame($visit->id, $queue->visit_id);
        $this->assertSame($this->p['A']->id, $visit->patient_id);
        $this->assertSame($this->b['b1']->id, $visit->branch_id);
        $this->assertSame($this->d['d1']->id, $visit->responsible_dentist_profile_id);
        $this->assertSame($this->svc['svc1']->id, $visit->requested_service_id);
        $this->assertNull($visit->appointment_id);

        $this->admit()->assertCreated()->assertHeader('Idempotent-Replayed', 'true')
            ->assertJsonPath('data.id', $visit->public_id)
            ->assertJsonPath('data.queue.id', $queue->public_id);
        $this->admit('stf12-new-key')->assertStatus(409)->assertJsonPath('code', 'active_visit_exists');
        $this->assertSame(1, Visit::count());
        $this->assertSame(1, QueueEntry::count());
    }

    public function test_off_shift_unavailable_and_out_of_scope_admissions_are_rejected_without_writes(): void
    {
        $this->actingAsUser('staffB1');
        $this->d['d1']->update(['shift_start' => '13:00']);
        $this->admit('off-shift')->assertStatus(422)->assertJsonPath('failed_checks', ['dentist-shift']);
        $this->d['d1']->update(['shift_start' => '09:00', 'available' => false]);
        $this->admit('unavailable')->assertStatus(422)->assertJsonPath('failed_checks', ['dentist-eligible']);
        $this->admit('out-of-scope', ['branch_ref' => 'b2', 'dentist_ref' => 'd3'])->assertForbidden();
        $this->assertSame(0, Visit::count());
        $this->assertSame(0, QueueEntry::count());
    }
}
