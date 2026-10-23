<?php

namespace Tests\Feature\Staffing;

use App\Models\AuditLog;
use App\Models\DentistSchedule;
use App\Models\MessageTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

/**
 * M3 Work Schedules, frozen at Monday 2026-09-28 10:00 Asia/Manila (SchedulingFixture: b1 and b2 open 09:00–18:00 every day;
 * d1, d2 at b1 and d3 at b2, profile hours 09:00–18:00).
 */
class WorkSchedulesTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->setUpSchedulingWorld();
    }

    private function slots(string $date, string $dentist = 'd1', string $service = 'svc1'): array
    {
        return collect($this->getJson("/api/appointments/availability?branch_ref=b1&service_ref=$service&date=$date&dentist_ref=$dentist")->assertOk()->json('data.slots'))
            ->pluck('start_time')->all();
    }

    private function week(string $dentist, string $branch, int $weekday, string $start, string $end, ?string $bs = null, ?string $be = null)
    {
        return $this->putJson("/api/work-schedules/$dentist/weekly", ['branch_ref' => $branch, 'weekday' => $weekday, 'start_time' => $start, 'end_time' => $end, 'break_start' => $bs, 'break_end' => $be]);
    }

    public function test_a_schedule_must_fall_inside_the_branch_hours_and_cannot_overlap_another_branch(): void
    {
        $this->actingAsUser('owner');
        $this->week('d1', 'b1', 3, '08:00', '12:00')->assertStatus(422)->assertJsonPath('errors.start_time.0', fn ($m) => str_contains($m, 'inside Branch B1\'s opening hours on Wednesday (9:00 AM–6:00 PM)'));
        $this->week('d1', 'b1', 3, '09:00', '19:00')->assertStatus(422);
        $this->b['b1']->update(['operating_days' => [1, 2, 3, 4, 5]]);
        $this->week('d1', 'b1', 7, '09:00', '12:00')->assertStatus(422)->assertJsonPath('errors.weekday.0', 'Branch B1 is closed on Sundays.');
        $this->week('d1', 'b2', 3, '09:00', '12:00')->assertStatus(422)->assertJsonPath('errors.branch_ref.0', fn ($m) => str_contains($m, 'is not assigned to Branch B2'));
        $this->week('d1', 'b1', 3, '09:00', '13:00', '12:00', '14:00')->assertStatus(422); // break outside the hours

        // Several branches on different hours of one day, never overlapping.
        $this->d['d1']->branches()->attach($this->b['b2']->id);
        $this->week('d1', 'b1', 3, '09:00', '13:00')->assertOk();
        $this->week('d1', 'b2', 3, '12:00', '17:00')->assertStatus(422)->assertJsonPath('errors.start_time.0', fn ($m) => str_contains($m, 'already works at Branch B1 on Wednesday'));
        $this->week('d1', 'b2', 3, '13:00', '17:00')->assertOk();
    }

    public function test_slots_respect_the_schedule_the_break_a_day_off_and_the_service_duration(): void
    {
        $this->actingAsUser('owner');
        // Wednesday 2026-09-30: d1 works 10:00–15:00 with a 12:00–13:00 break.
        $this->week('d1', 'b1', 3, '10:00', '15:00', '12:00', '13:00')->assertOk();
        $this->actingAsUser('staffB1');
        $this->assertSame(['10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30'], $this->slots('2026-09-30'));
        // A 60-minute service cannot start at 11:30 (it would run into the break) nor at 14:30.
        $this->assertSame(['10:00', '10:30', '11:00', '13:00', '13:30', '14:00'], $this->slots('2026-09-30', 'd1', 'svc2'));
        // Thursday has no row: once a dentist has a weekly schedule, a day without a row is a day off.
        $this->assertSame([], $this->slots('2026-10-01'));
        // d2 still uses the hours on their profile (no weekly schedule yet).
        $this->assertCount(18, $this->slots('2026-10-01', 'd2'));

        // A dated day off, and custom hours for one date.
        $this->actingAsUser('owner');
        $this->postJson('/api/work-schedules/d1/exceptions', ['date' => '2026-10-07', 'kind' => 'day_off', 'reason' => 'Seminar'])->assertCreated();
        $this->week('d1', 'b1', 3, '10:00', '15:00')->assertOk();
        $this->assertSame([], $this->slots('2026-10-07'));
        $this->postJson('/api/work-schedules/d1/exceptions', ['date' => '2026-10-14', 'kind' => 'custom_hours', 'branch_ref' => 'b1', 'start_time' => '16:00', 'end_time' => '17:00'])->assertCreated();
        $this->assertSame(['16:00', '16:30'], $this->slots('2026-10-14'));
        $this->postJson('/api/work-schedules/d1/exceptions', ['date' => '2026-10-21', 'kind' => 'custom_hours', 'branch_ref' => 'b1', 'start_time' => '08:00', 'end_time' => '10:00'])
            ->assertStatus(422); // outside the branch hours
    }

    public function test_any_available_uses_only_dentists_scheduled_at_that_time(): void
    {
        $this->actingAsUser('owner');
        $this->week('d1', 'b1', 3, '09:00', '12:00')->assertOk();
        $this->week('d2', 'b1', 3, '13:00', '18:00')->assertOk();
        $this->actingAsUser('staffB1');
        $all = collect($this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-09-30')->assertOk()->json('data.slots'));
        $this->assertSame('d1', $all->firstWhere('start_time', '09:00')['dentist']['id']);
        $this->assertSame('d2', $all->firstWhere('start_time', '13:00')['dentist']['id']);
        $this->assertNull($all->firstWhere('start_time', '12:00')); // nobody scheduled 12:00–13:00
    }

    public function test_a_schedule_change_lists_affected_appointments_and_never_cancels_them(): void
    {
        $booked = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-30', '16:00');
        $this->actingAsUser('owner');
        $res = $this->week('d1', 'b1', 3, '09:00', '13:00')->assertOk();
        $this->assertSame([$booked->public_id], array_column($res->json('data.affected'), 'id'));
        $this->assertSame([['id' => 'd2', 'name' => $res->json('data.affected.0.cover.0.name')]], $res->json('data.affected.0.cover')); // d2 is free then
        $this->assertSame('Confirmed', $booked->fresh()->status);

        // Notify needs the Owner-approved wording; then one email per appointment, once.
        $this->postJson('/api/work-schedules/d1/notify')->assertStatus(422)->assertJsonPath('code', 'wording_not_approved');
        MessageTemplate::where('key', 'dentist_unavailable_notice')->update(['approved_at' => now(), 'approved_by_user_id' => $this->u['owner']->id]);
        $sent = $this->postJson('/api/work-schedules/d1/notify')->assertOk();
        $this->assertSame(1, $sent->json('data.emailed') + $sent->json('data.in_app_only')); // the fixture's test address gets the in-app notice only
        $this->assertTrue(\App\Models\UserNotification::where('kind', 'dentist_unavailable')->where('user_id', $this->u['patientA']->id)->exists());
        $this->postJson('/api/work-schedules/d1/notify')->assertOk()->assertJsonPath('data.already', 1);
        $this->assertSame('Confirmed', $booked->fresh()->status);

        // Staff move it to the cover dentist with the normal reschedule command: no longer affected.
        $this->actingAsUser('staffB1');
        $this->postJson("/api/appointments/{$booked->public_id}/reschedule", ['expected_revision' => $booked->revision, 'date' => '2026-09-30', 'start_time' => '16:00', 'dentist_ref' => 'd2'])->assertOk();
        $this->getJson('/api/work-schedules/d1/affected')->assertOk()->assertJsonCount(0, 'data.affected');
    }

    public function test_front_desk_edits_only_their_branch_while_the_owner_allows_it_and_every_change_is_audited(): void
    {
        $this->actingAsUser('staffB2');
        $this->week('d1', 'b1', 3, '09:00', '12:00')->assertForbidden();
        $this->actingAsUser('staffB1');
        $this->week('d1', 'b1', 3, '09:00', '12:00')->assertOk();
        $this->week('d1', 'b1', 3, '09:00', '13:00')->assertOk();
        $audit = AuditLog::where('action', 'work_schedule.updated')->latest('id')->first();
        $this->assertEquals(['dentist' => 'd1', 'weekday' => 3, 'old' => ['start' => '09:00', 'end' => '12:00', 'break_start' => null, 'break_end' => null], 'new' => ['start' => '09:00', 'end' => '13:00', 'break_start' => null, 'break_end' => null]],
            $audit->payload);
        $this->assertSame($this->u['staffB1']->id, $audit->actor_user_id);

        $this->actingAsUser('owner');
        $this->putJson('/api/automations/staffing', ['expected_revision' => \App\Models\AutomationSetting::find('staffing')->revision, 'settings' => ['front_desk_edits_schedules' => false]])->assertOk();
        $this->actingAsUser('staffB1');
        $this->week('d1', 'b1', 3, '09:00', '14:00')->assertForbidden();
        $this->putJson('/api/work-schedules/d1/weekly', ['branch_ref' => 'b1', 'weekday' => 3, 'remove' => true])->assertForbidden();

        // Removing is a status change, never a delete.
        $this->actingAsUser('owner');
        $this->putJson('/api/work-schedules/d1/weekly', ['branch_ref' => 'b1', 'weekday' => 3, 'remove' => true])->assertOk();
        $this->assertSame('removed', DentistSchedule::where('dentist_profile_id', $this->d['d1']->id)->sole()->status);
        $this->expectException(\Illuminate\Database\QueryException::class);
        DentistSchedule::query()->delete();
    }

    public function test_calendar_capacity_counts_real_hours_and_is_only_estimated_while_someone_uses_profile_hours(): void
    {
        $this->actingAsUser('owner');
        $this->week('d1', 'b1', 3, '09:00', '13:00', '11:00', '11:30')->assertOk(); // 3.5 h
        $this->week('d2', 'b1', 3, '13:00', '18:00')->assertOk(); // 5 h
        $this->actingAsUser('staffB1');
        $load = $this->getJson('/api/calendar/load?branch_ref=b1&from=2026-09-30&to=2026-09-30')->assertOk();
        $this->assertSame(510, $load->json('data.days.0.capacity_minutes'));
        $this->assertFalse($load->json('data.capacity_estimated'));
        $this->assertNull($load->json('data.capacity_note'));
        $this->actingAsUser('owner');
        $this->assertTrue($this->getJson('/api/calendar/load?from=2026-09-30&to=2026-09-30')->json('data.capacity_estimated')); // d3 (b2) has no weekly schedule yet
    }

    public function test_dentists_and_staff_cannot_freely_edit_their_own_assigned_work_schedules(): void
    {
        $staffProfile = \App\Models\StaffProfile::create([
            'legacy_ref' => 's1',
            'legacy_user_ref' => 'u2',
            'title' => 'Receptionist',
            'person_id' => $this->u['staffB1']->person_id,
            'branch_id' => $this->b['b1']->id,
            'shift_start' => '09:00',
            'shift_end' => '18:00',
            'available' => true,
        ]);

        // Dentist cannot mutate their own weekly schedule, profile hours, exceptions, or dentist profile.
        $this->actingAsUser('dentist1');
        $this->getJson('/api/work-schedules')->assertOk()->assertJsonPath('data.dentists.0.branches.0.editable', false);
        $this->week('d1', 'b1', 3, '09:00', '12:00')->assertForbidden();
        $this->postJson('/api/work-schedules/d1/from-profile', ['branch_ref' => 'b1'])->assertForbidden();
        $this->postJson('/api/work-schedules/d1/exceptions', ['date' => '2026-10-07', 'kind' => 'day_off'])->assertForbidden();
        $this->postJson('/api/work-schedules/d1/notify')->assertForbidden();
        $this->patchJson('/api/dentists/d1', ['shift_start' => '10:00', 'shift_end' => '16:00'])->assertForbidden();

        // Staff cannot edit their own assigned StaffProfile shift or branch assignment.
        $this->actingAsUser('staffB1');
        $this->patchJson('/api/staff/'.$staffProfile->legacy_ref, ['shift_start' => '10:00', 'shift_end' => '17:00'])->assertForbidden();
        $this->assertSame('09:00', substr((string) $staffProfile->fresh()->shift_start, 0, 5));
    }
}
