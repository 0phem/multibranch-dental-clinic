<?php

namespace Tests\Feature\Appointments;

use App\Models\DentistProfile;
use Database\Seeders\RealBranchSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The clinic's real opening hours (given 2026-10-17): Monday to Friday 8:00 AM to 8:00 PM, Saturday 8:00 AM to 5:00 PM, Sunday
 * closed. Booking, availability and the calendar follow each day's own hours, and the last slot leaves room for the service.
 * Today in the fixture is Monday, September 28, 2026. Dentist shifts are widened here so the branch hours are what is tested.
 */
class BranchHoursTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        $this->b['b1']->update(['weekly_hours' => RealBranchSeeder::HOURS, 'open_time' => '08:00', 'close_time' => '20:00', 'operating_days' => [1, 2, 3, 4, 5, 6]]);
        DentistProfile::query()->update(['shift_start' => '07:00', 'shift_end' => '21:00']);
        $this->actingAsUser('patientA');
    }

    private function times(string $date, string $service = 'svc1'): array
    {
        return array_column($this->getJson("/api/appointments/availability?branch_ref=b1&service_ref={$service}&date={$date}")->assertOk()->json('data.slots'), 'start_time');
    }

    public function test_sunday_is_closed_for_booking_availability_and_the_calendar(): void
    {
        $this->book(['date' => '2026-10-04', 'start_time' => '10:00'])->assertStatus(422)->assertJsonPath('code', 'schedule_invalid');
        $this->assertSame([], $this->times('2026-10-04'));
        $days = collect($this->getJson('/api/appointments/calendar?branch_ref=b1&service_ref=svc1&month=2026-10')->json('data.days'))->keyBy('date');
        $this->assertSame('closed', $days['2026-10-04']['status']);
        $this->assertSame('available', $days['2026-10-03']['status'], 'Saturday is open');
    }

    public function test_weekday_slots_run_from_8_am_until_the_service_ends_by_8_pm(): void
    {
        $duration = $this->svc['svc1']->duration_minutes;
        $times = $this->times('2026-09-30'); // a Wednesday
        $this->assertSame('08:00', $times[0]);
        $last = end($times);
        $this->assertLessThanOrEqual(20 * 60, $this->minutes($last) + $duration, 'the last slot ends by 8:00 PM');
        $this->assertGreaterThan(20 * 60, $this->minutes($last) + 60 + $duration, 'no later hourly slot would fit');
        $this->book(['date' => '2026-09-30', 'start_time' => '20:00'])->assertStatus(422);
        $this->book(['date' => '2026-09-30', 'start_time' => '07:00'])->assertStatus(422);
        $this->book(['date' => '2026-09-30', 'start_time' => $last])->assertCreated();
    }

    public function test_saturday_slots_stop_so_the_visit_ends_by_5_pm(): void
    {
        $duration = $this->svc['svc1']->duration_minutes;
        $times = $this->times('2026-10-03'); // a Saturday
        $last = end($times);
        $this->assertLessThanOrEqual(17 * 60, $this->minutes($last) + $duration);
        $this->assertNotContains('17:00', $times);
        $this->assertNotContains('18:00', $times);
        $this->book(['date' => '2026-10-03', 'start_time' => '17:00'])->assertStatus(422);
        $this->book(['date' => '2026-10-03', 'start_time' => '18:00'])->assertStatus(422);
        $this->book(['date' => '2026-10-03', 'start_time' => $last])->assertCreated();
    }

    public function test_the_owner_can_set_per_day_hours_and_the_rules_follow_at_once(): void
    {
        $this->actingAsUser('owner');
        $week = RealBranchSeeder::HOURS;
        $week['6'] = ['open' => '08:00', 'close' => '12:00'];
        $this->patchJson('/api/branches/b1', ['weekly_hours' => $week])->assertOk()
            ->assertJsonPath('data.weekly_hours.6.close', '12:00')->assertJsonPath('data.weekly_hours.7', null)->assertJsonPath('data.operating_days', [1, 2, 3, 4, 5, 6]);
        $this->patchJson('/api/branches/b1', ['weekly_hours' => ['1' => ['open' => '10:00', 'close' => '09:00']]])->assertStatus(422);
        $this->patchJson('/api/branches/b1', ['weekly_hours' => ['8' => ['open' => '10:00', 'close' => '12:00']]])->assertStatus(422);
        $this->actingAsUser('patientA');
        $this->assertNotContains('12:00', $this->times('2026-10-03'));
        $this->assertContains('10:00', $this->times('2026-10-03'));
    }

    private function minutes(string $hhmm): int
    {
        [$h, $m] = array_map('intval', explode(':', $hhmm));

        return $h * 60 + $m;
    }
}
