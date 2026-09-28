<?php

namespace Tests\Feature\Appointments;

use App\Models\Appointment;
use App\Models\Branch;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// M6 production scheduling rules: normal booking, Patient window, start grid, conflicts and eligibility.
class AppointmentBookingTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    private function assertRejected($response, string $check): void
    {
        $response->assertStatus(422)->assertJsonPath('code', 'schedule_invalid');
        $this->assertContains($check, $response->json('failed_checks'), json_encode($response->json()));
    }

    // ---- NORMAL ----------------------------------------------------------------------------------------------

    public function test_valid_patient_booking_is_confirmed_with_auto_assignment_and_history(): void
    {
        $this->actingAsUser('patientA');

        $response = $this->book()->assertCreated()
            ->assertJsonPath('data.status', 'Confirmed')
            ->assertJsonPath('data.source', 'patient_portal')
            ->assertJsonPath('data.assignment_method', 'auto')
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.date', '2026-09-29')
            ->assertJsonPath('data.start_time', '09:00')
            ->assertJsonPath('data.end_time', '09:30')
            ->assertJsonPath('data.starts_at', '2026-09-29T09:00:00+08:00')
            ->assertJsonPath('data.duration_minutes', 30)
            ->assertJsonPath('data.patient.code', 'PAT-0001')
            ->assertJsonPath('data.patient.id', $this->p['A']->public_id)
            ->assertJsonPath('data.dentist.id', 'd1');

        $appointment = Appointment::where('public_id', $response->json('data.id'))->firstOrFail();
        $this->assertSame('2026-09-29 01:00:00', $appointment->starts_at->utc()->format('Y-m-d H:i:s'), 'stored as the UTC instant');
        $this->assertSame('dentist-assignment-v1', $appointment->assignment_rule_version);
        $this->assertSame(1, $appointment->history()->count());
        $this->assertSame('appointment.created', $appointment->history()->first()->event);
        $this->assertMatchesRegularExpression('/^[0-9a-hjkmnp-tv-z]{26}$/', $response->json('data.id'), 'public id is a ULID, never the bigint');
    }

    public function test_deterministic_assignment_prefers_fewest_booked_minutes_then_lowest_dentist(): void
    {
        // d1 already has 30 booked minutes on 09-29 (for another Patient), d2 has none → d2 wins at 09:00.
        $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-29', '14:00');
        $this->actingAsUser('patientA');
        $this->book()->assertCreated()->assertJsonPath('data.dentist.id', 'd2');

        // Same state again on another date → tie at zero minutes → lowest id (d1).
        $this->book(['date' => '2026-09-30'])->assertCreated()->assertJsonPath('data.dentist.id', 'd1');
    }

    public function test_service_duration_and_branch_override_decide_the_end_time(): void
    {
        $this->actingAsUser('patientA');
        $this->book(['service_ref' => 'svc2', 'start_time' => '10:00'])->assertCreated()
            ->assertJsonPath('data.duration_minutes', 60)->assertJsonPath('data.end_time', '11:00');

        $this->b['b1']->branchServices()->where('service_id', $this->svc['svc1']->id)->update(['duration_override_minutes' => 45]);
        $this->book(['date' => '2026-09-30'])->assertCreated()
            ->assertJsonPath('data.duration_minutes', 45)->assertJsonPath('data.end_time', '09:45');
    }

    public function test_valid_staff_booking_same_day_half_hour_with_selected_dentist(): void
    {
        $this->actingAsUser('staffB1');
        $this->staffBook(['date' => '2026-09-28', 'start_time' => '14:30', 'dentist_ref' => 'd2'])->assertCreated()
            ->assertJsonPath('data.source', 'front_desk')
            ->assertJsonPath('data.assignment_method', 'selected')
            ->assertJsonPath('data.dentist.id', 'd2')
            ->assertJsonPath('data.start_time', '14:30');

        // Without a Dentist the same deterministic assignment applies.
        $this->staffBook(['date' => '2026-09-28', 'start_time' => '15:00', 'patient_id' => $this->p['B']->public_id])->assertCreated()
            ->assertJsonPath('data.patient.id', $this->p['B']->public_id)
            ->assertJsonPath('data.assignment_method', 'auto');
    }

    // ---- PATIENT WINDOW --------------------------------------------------------------------------------------

    public function test_patient_window_is_tomorrow_through_one_calendar_month_after_tomorrow(): void
    {
        $this->actingAsUser('patientA');
        $this->assertRejected($this->book(['date' => '2026-09-28', 'start_time' => '15:00']), 'date-window');
        $this->book(['date' => '2026-09-29'])->assertCreated();
        $this->book(['date' => '2026-10-29'])->assertCreated();
        $this->assertRejected($this->book(['date' => '2026-10-30']), 'date-window');
    }

    public function test_patient_window_clamps_to_month_end(): void
    {
        // Tomorrow is 2027-01-31; one calendar month later clamps to 2027-02-28.
        $this->travelTo(CarbonImmutable::parse('2027-01-30 10:00:00', 'Asia/Manila'));
        $this->actingAsUser('patientA');
        $this->book(['date' => '2027-02-28'])->assertCreated();
        $this->assertRejected($this->book(['date' => '2027-03-01']), 'date-window');
    }

    public function test_staff_is_not_bound_by_the_patient_window_but_cannot_book_the_past(): void
    {
        $this->actingAsUser('staffB1');
        $this->staffBook(['date' => '2026-12-15'])->assertCreated();
        $this->assertRejected($this->staffBook(['date' => '2026-09-28', 'start_time' => '09:30']), 'time');
        $this->assertRejected($this->staffBook(['date' => '2026-09-27']), 'date');
    }

    // ---- GRID --------------------------------------------------------------------------------------------------

    public function test_patient_start_times_are_hourly(): void
    {
        $this->actingAsUser('patientA');
        $this->book(['start_time' => '11:00'])->assertCreated();
        $this->assertRejected($this->book(['start_time' => '11:30', 'date' => '2026-09-30']), 'grid');
    }

    public function test_staff_start_times_follow_the_half_hour_grid(): void
    {
        $this->actingAsUser('staffB1');
        $this->staffBook(['start_time' => '11:30'])->assertCreated();
        $this->assertRejected($this->staffBook(['start_time' => '12:15']), 'grid');
    }

    public function test_existing_half_hour_appointments_stay_valid_and_listed(): void
    {
        $historical = $this->existing('A', 'd1', 'b1', 'svc1', '2026-10-01', '10:30');
        $this->actingAsUser('patientA');
        $this->getJson('/api/appointments/'.$historical->public_id)->assertOk()->assertJsonPath('data.start_time', '10:30');
    }

    // ---- CONFLICT / ELIGIBILITY ------------------------------------------------------------------------------

    public function test_dentist_overlap_is_blocked(): void
    {
        $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-29', '09:00');
        $this->actingAsUser('staffB1');
        $response = $this->staffBook(['dentist_ref' => 'd1', 'start_time' => '09:00']);
        $this->assertRejected($response, 'overlap');
        $this->assertNotEmpty($response->json('alternatives'));
        $this->assertNotContains('09:00', $response->json('alternatives'));
    }

    public function test_patient_overlap_is_blocked_even_with_another_dentist(): void
    {
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '09:00');
        $this->actingAsUser('staffB1');
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd2', 'start_time' => '09:00']), 'patient-overlap');
    }

    public function test_patient_auto_assignment_skips_a_busy_dentist_and_fails_when_nobody_is_free(): void
    {
        $this->existing('B', 'd1', 'b1', 'svc2', '2026-09-29', '09:00', 60);
        $this->actingAsUser('patientA');
        // svc2 is only performed by d1, who is busy.
        $response = $this->book(['service_ref' => 'svc2']);
        $this->assertRejected($response, 'dentist-assignment');
        $this->assertContains('10:00', $response->json('alternatives'));
    }

    public function test_unavailable_dentist_is_blocked(): void
    {
        $this->d['d2']->update(['available' => false]);
        $this->actingAsUser('staffB1');
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd2']), 'dentist-active');
    }

    // ---- DENTIST RESOURCE vs LOGIN IDENTITY --------------------------------------------------------------------

    public function test_eligible_dentist_without_a_login_is_bookable(): void
    {
        [$this->d['d4']] = $this->dentist('d4', ['b1'], ['svc1', 'svc2'], login: false);
        $this->assertNull($this->d['d4']->person->user, 'd4 has no User account');

        $this->actingAsUser('staffB1');
        $this->staffBook(['dentist_ref' => 'd4'])->assertCreated()->assertJsonPath('data.dentist.id', 'd4');
    }

    public function test_login_state_never_changes_auto_assignment(): void
    {
        // d1 already has 30 minutes on 09-29; the free Dentist wins, whatever its login state.
        $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-29', '14:00');
        $this->u['dentist2']->forceFill(['account_status' => 'Inactive'])->save();
        $this->actingAsUser('patientA');
        $this->book()->assertCreated()->assertJsonPath('data.dentist.id', 'd2');

        // Same arrangement on another day with d2's login soft-deleted: still the same deterministic result.
        $this->u['dentist2']->delete();
        $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-30', '14:00');
        $this->book(['date' => '2026-09-30'])->assertCreated()->assertJsonPath('data.dentist.id', 'd2');
    }

    public function test_dentist_without_login_is_a_candidate_in_availability_and_recommendation(): void
    {
        // Only a login-less Dentist performs svc2 once d1 is removed from it.
        $this->d['d1']->services()->detach($this->svc['svc2']->id);
        [$this->d['d4']] = $this->dentist('d4', ['b1'], ['svc2'], login: false);

        $this->actingAsUser('patientA');
        $slots = $this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc2&date=2026-09-29')->assertOk()->json('data.slots');
        $this->assertSame('d4', $slots[0]['dentist']['id']);
        $this->getJson('/api/appointments/recommendation?service_ref=svc2&branch_ref=b1')->assertOk()
            ->assertJsonPath('data.recommendation.dentist.id', 'd4');
    }

    public function test_ineligible_dentist_is_blocked(): void
    {
        $this->actingAsUser('staffB1');
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd3']), 'dentist-branch');
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd2', 'service_ref' => 'svc2']), 'dentist-service');
    }

    public function test_unavailable_branch_or_service_is_blocked(): void
    {
        $this->actingAsUser('staffB1');
        $this->b['b1']->update(['status' => 'Closed']);
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd1']), 'branch-status');
        $this->b['b1']->update(['status' => 'Open']);

        $this->svc['svc2']->update(['status' => 'Inactive']);
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd1', 'service_ref' => 'svc2']), 'service-exists');

        $this->b['b1']->branchServices()->where('service_id', $this->svc['svc1']->id)->update(['active' => false]);
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd1']), 'service');
    }

    public function test_branch_hours_and_dentist_shift_are_enforced(): void
    {
        $this->actingAsUser('staffB1');
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd1', 'start_time' => '17:30', 'service_ref' => 'svc2']), 'branch-hours');
        $this->d['d1']->update(['shift_start' => '13:00']);
        $this->assertRejected($this->staffBook(['dentist_ref' => 'd1', 'start_time' => '10:00']), 'dentist-shift');
    }

    public function test_cancelled_appointments_do_not_occupy_time(): void
    {
        $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-29', '09:00', 30, 'Cancelled');
        $this->actingAsUser('staffB1');
        $this->staffBook(['dentist_ref' => 'd1'])->assertCreated();
    }

    public function test_client_cannot_choose_status_source_or_patient_dentist_fields(): void
    {
        $this->actingAsUser('patientA');
        $this->book(['dentist_ref' => 'd2'])->assertStatus(422)->assertJsonValidationErrors('dentist_ref');
        $this->book(['patient_code' => 'PAT-0002'])->assertStatus(422)->assertJsonValidationErrors('patient_code');
        $this->book(['patient_id' => $this->p['B']->public_id])->assertStatus(422)->assertJsonValidationErrors('patient_id');
        $this->book(['status' => 'Completed'])->assertStatus(422)->assertJsonValidationErrors('status');
        $this->book(['start_time' => '9am'])->assertStatus(422)->assertJsonValidationErrors('start_time');
        $this->book(['date' => '2026-02-30'])->assertStatus(422)->assertJsonValidationErrors('date');
        $this->assertSame(0, Appointment::count());
    }

    // ---- AVAILABILITY / SMART SCHEDULING ---------------------------------------------------------------------

    public function test_availability_lists_hourly_patient_slots_with_the_assigned_dentist(): void
    {
        $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-29', '09:00');
        $this->existing('B', 'd2', 'b1', 'svc1', '2026-09-29', '10:00');
        $this->actingAsUser('patientA');

        $response = $this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-09-29')->assertOk()
            ->assertJsonPath('data.rules.start_grid_minutes', 60)
            ->assertJsonPath('data.rules.window.first_date', '2026-09-29')
            ->assertJsonPath('data.rules.window.last_date', '2026-10-29');
        $slots = collect($response->json('data.slots'));
        // 09:00 and 10:00 are blocked for Patient B only, so Patient A still sees them (other Dentist free).
        $this->assertSame(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'], $slots->pluck('start_time')->all());
        $this->assertSame('d2', $slots->first()['dentist']['id']);
        $this->assertSame('2026-09-29T09:00:00+08:00', $slots->first()['starts_at']);

        $this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-09-28')->assertOk()->assertJsonCount(0, 'data.slots');
    }

    public function test_staff_availability_uses_the_half_hour_grid(): void
    {
        $this->actingAsUser('staffB1');
        $slots = $this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-09-28')->assertOk()->json('data.slots');
        $this->assertSame('10:30', $slots[0]['start_time'], 'same day, after now (10:00), half-hour grid');
    }

    public function test_recommendation_without_coordinates_degrades_to_manual_branch_selection(): void
    {
        $this->actingAsUser('patientA');
        $this->getJson('/api/appointments/recommendation?service_ref=svc1&latitude=14.8&longitude=120.9')->assertOk()
            ->assertJsonPath('data.location_ranking', 'unavailable')
            ->assertJsonPath('data.recommendation', null)
            ->assertJsonPath('data.eligible_branches.0.has_coordinates', false)
            ->assertJsonCount(2, 'data.eligible_branches');
    }

    public function test_recommendation_for_a_chosen_branch_is_the_earliest_valid_slot_and_reserves_nothing(): void
    {
        $this->actingAsUser('patientA');
        $this->getJson('/api/appointments/recommendation?service_ref=svc2&branch_ref=b1')->assertOk()
            ->assertJsonPath('data.location_ranking', 'branch_selected')
            ->assertJsonPath('data.recommendation.branch.id', 'b1')
            ->assertJsonPath('data.recommendation.date', '2026-09-29')
            ->assertJsonPath('data.recommendation.start_time', '09:00')
            ->assertJsonPath('data.recommendation.end_time', '10:00')
            ->assertJsonPath('data.recommendation.duration_minutes', 60)
            ->assertJsonPath('data.recommendation.dentist.id', 'd1')
            ->assertJsonPath('data.recommendation.reserved', false);
        $this->assertSame(0, Appointment::count());
    }

    public function test_recommendation_ranks_by_distance_only_between_branches_with_real_coordinates(): void
    {
        // Test-fixture coordinates only (never seeded): b2 is nearer the Patient than b1.
        $this->b['b1']->update(['latitude' => 14.9000000, 'longitude' => 121.0000000]);
        $this->b['b2']->update(['latitude' => 14.8000000, 'longitude' => 120.9000000]);
        $this->actingAsUser('patientA');
        $this->getJson('/api/appointments/recommendation?service_ref=svc1&latitude=14.79&longitude=120.9')->assertOk()
            ->assertJsonPath('data.location_ranking', 'distance')
            ->assertJsonPath('data.recommendation.branch.id', 'b2')
            ->assertJsonPath('data.recommendation.dentist.id', 'd3');

        // A branch that does not offer the service is never ranked, however near.
        $near = Branch::create(['legacy_ref' => 'b9', 'branch_code' => 'BRC-B9', 'name' => 'Branch B9', 'city' => 'X', 'address' => 'Y',
            'open_time' => '09:00', 'close_time' => '18:00', 'status' => 'Open', 'latitude' => 14.79, 'longitude' => 120.9]);
        $this->getJson('/api/appointments/recommendation?service_ref=svc1&latitude=14.79&longitude=120.9')->assertOk()
            ->assertJsonPath('data.recommendation.branch.id', 'b2');
        $this->assertNotNull($near);
    }
}
