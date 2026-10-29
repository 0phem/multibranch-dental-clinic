<?php

namespace Tests\Feature\Staffing;

use App\Models\BranchClosure;
use App\Models\DentistSchedule;
use App\Models\DentistScheduleException;
use App\Models\LeaveRequest;
use App\Services\Closures\ClosureCalendar;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

/** STF-07: synthetic branch-scoped duty facts from the same windows booking uses. */
class OnDutyStatusTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    private function row(string $dentist = 'd1', string $branch = 'b1'): array
    {
        $response = $this->getJson('/api/work-schedules')->assertOk();
        $this->assertSame(ClinicClock::today(), $response->json('data.duty.date'));
        $rows = collect($response->json('data.duty.rows'));

        return $rows->first(fn ($row) => $row['dentist_id'] === $dentist && $row['branch_id'] === $branch) ?? [];
    }

    private function week(string $branch, int $weekday, string $start, string $end, ?string $breakStart = null, ?string $breakEnd = null): DentistSchedule
    {
        return DentistSchedule::create(['dentist_profile_id' => $this->d['d1']->id, 'branch_id' => $this->b[$branch]->id,
            'weekday' => $weekday, 'start_time' => $start, 'end_time' => $end, 'break_start' => $breakStart, 'break_end' => $breakEnd, 'status' => 'active']);
    }

    private function exception(string $kind, ?string $branch = null, ?string $start = null, ?string $end = null): DentistScheduleException
    {
        return DentistScheduleException::create(['dentist_profile_id' => $this->d['d1']->id, 'branch_id' => $branch ? $this->b[$branch]->id : null,
            'on_date' => ClinicClock::today(), 'kind' => $kind, 'start_time' => $start, 'end_time' => $end, 'status' => 'active']);
    }

    private function leave(string $start, string $end): LeaveRequest
    {
        return LeaveRequest::create(['requester_user_id' => $this->u['dentist1']->id, 'dentist_profile_id' => $this->d['d1']->id,
            'type' => 'vacation', 'starts_at' => ClinicClock::at(ClinicClock::today(), $start),
            'ends_at' => ClinicClock::at(ClinicClock::today(), $end), 'status' => 'Approved',
            'decided_at' => ClinicClock::now(), 'decided_by_user_id' => $this->u['owner']->id]);
    }

    public function test_weekly_windows_break_and_clinic_midnight_are_distinct_from_working_now(): void
    {
        $this->actingAsUser('staffB1');
        $profile = $this->row();
        $this->assertTrue($profile['on_duty_today']);
        $this->assertTrue($profile['working_now']);
        $this->assertSame(540, $profile['working_minutes']);
        $this->assertTrue($profile['estimated']); // no weekly rows: existing profile-hours fallback

        $this->week('b1', 1, '09:00', '17:00', '12:00', '13:00');
        $scheduled = $this->row();
        $this->assertSame(420, $scheduled['working_minutes']);
        $this->assertFalse($scheduled['estimated']);
        $this->travelTo(CarbonImmutable::parse('2026-09-28 12:30:00', 'Asia/Manila'));
        $this->assertTrue($this->row()['on_duty_today']);
        $this->assertFalse($this->row()['working_now']);
        $this->travelTo(CarbonImmutable::parse('2026-09-28 23:59:00', 'Asia/Manila'));
        $this->assertTrue($this->row()['on_duty_today']);
        $this->assertFalse($this->row()['working_now']);
        $this->travelTo(CarbonImmutable::parse('2026-09-29 00:01:00', 'Asia/Manila'));
        $this->assertFalse($this->row()['on_duty_today']); // Tuesday has no weekly row
    }

    public function test_branch_closure_day_off_custom_hours_and_availability_override(): void
    {
        $this->actingAsUser('staffB1');
        $this->week('b1', 1, '09:00', '17:00');
        $closure = BranchClosure::create(['branch_id' => $this->b['b1']->id, 'closed_on' => ClinicClock::today(), 'status' => 'active']);
        $this->assertFalse($this->row()['on_duty_today']);
        $closure->update(['status' => 'removed']);
        app(ClosureCalendar::class)->flush();
        BranchClosure::create(['branch_id' => $this->b['b1']->id, 'closed_on' => ClinicClock::today(), 'status' => 'active',
            'open_time' => '10:00', 'close_time' => '11:00']);
        app(ClosureCalendar::class)->flush();
        $this->assertSame(60, $this->row()['working_minutes']);

        $off = $this->exception('day_off');
        $this->assertFalse($this->row()['on_duty_today']);
        $off->update(['status' => 'removed']);
        $this->exception('custom_hours', 'b1', '10:30', '11:00');
        $this->assertSame(30, $this->row()['working_minutes']);
        $this->d['d1']->update(['available' => false]);
        $this->assertFalse($this->row()['on_duty_today']);
    }

    public function test_approved_full_and_partial_leave_subtract_minutes_without_exposing_reason(): void
    {
        $this->actingAsUser('staffB1');
        $this->week('b1', 1, '09:00', '17:00');
        $partial = $this->leave('09:00', '11:00');
        $row = $this->row();
        $this->assertSame(360, $row['working_minutes']);
        $this->assertTrue($row['on_duty_today']);
        $this->assertFalse($row['working_now']);
        $this->assertArrayNotHasKey('reason', $row);
        $partial->update(['status' => 'Cancelled']);
        $this->leave('00:00', '23:59');
        $this->assertFalse($this->row()['on_duty_today']);
        $this->assertSame(0, $this->row()['working_minutes']);
    }

    public function test_each_role_sees_only_authorized_dentists_and_branches(): void
    {
        $this->d['d1']->branches()->attach($this->b['b2']->id);
        $this->week('b1', 1, '09:00', '12:00');
        $this->week('b2', 1, '13:00', '17:00');

        $this->actingAsUser('staffB1');
        $this->assertSame(180, $this->row('d1', 'b1')['working_minutes']);
        $this->assertSame([], $this->row('d1', 'b2'));
        $this->actingAsUser('staffB2');
        $this->assertSame(240, $this->row('d1', 'b2')['working_minutes']);
        $this->assertFalse($this->row('d1', 'b2')['working_now']);
        $this->assertSame([], $this->row('d1', 'b1'));
        $this->actingAsUser('staffNone');
        $this->assertSame([], $this->getJson('/api/work-schedules')->assertOk()->json('data.duty.rows'));
        $this->actingAsUser('dentist1');
        $this->assertNotEmpty($this->row('d1', 'b1'));
        $this->assertSame([], $this->row('d2', 'b1'));
        $this->actingAsUser('owner');
        $this->assertNotEmpty($this->row('d1', 'b2'));
        $this->actingAsUser('patientA');
        $this->getJson('/api/work-schedules')->assertForbidden();
    }
}
