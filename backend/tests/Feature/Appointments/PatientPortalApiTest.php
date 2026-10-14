<?php

namespace Tests\Feature\Appointments;

use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Patient portal APIs: opening days, the month calendar, branch options and real-event notifications. Today is Mon Sep 28, 2026. */
class PatientPortalApiTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    public function test_booking_is_refused_on_a_day_the_branch_is_closed(): void
    {
        $this->b['b1']->update(['operating_days' => [1, 2, 3, 4, 5]]); // Monday to Friday
        $this->actingAsUser('patientA');
        $this->book(['date' => '2026-10-03', 'start_time' => '10:00'])->assertStatus(422); // a Saturday
        $this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-10-03')->assertOk()->assertJsonCount(0, 'data.slots');
        $this->book(['date' => '2026-10-02', 'start_time' => '10:00'])->assertCreated(); // a Friday
    }

    public function test_the_month_calendar_marks_past_closed_full_available_and_outside_days(): void
    {
        $this->b['b1']->update(['operating_days' => [1, 2, 3, 4, 5]]);
        $this->actingAsUser('patientA');
        $days = collect($this->getJson('/api/appointments/calendar?branch_ref=b1&service_ref=svc1&month=2026-10')->assertOk()
            ->assertJsonPath('data.window.first_date', '2026-09-29')->assertJsonPath('data.previous_month', '2026-09')
            ->json('data.days'))->keyBy('date');
        $this->assertSame('closed', $days['2026-10-03']['status']);
        $this->assertSame('closed', $days['2026-10-04']['status']);
        $this->assertSame('available', $days['2026-10-01']['status']);
        $this->assertSame('outside', $days['2026-10-30']['status'], 'past the one-month online window');
        $september = collect($this->getJson('/api/appointments/calendar?branch_ref=b1&service_ref=svc1&month=2026-09')->json('data.days'))->keyBy('date');
        $this->assertSame('past', $september['2026-09-28']['status'], 'today cannot be booked online');
        $this->actingAsUser('owner');
        $this->patchJson('/api/branches/b1', ['operating_days' => [8]])->assertStatus(422);
        $this->patchJson('/api/branches/b1', ['operating_days' => null])->assertOk();
        $this->actingAsUser('patientA');
        $open = collect($this->getJson('/api/appointments/calendar?branch_ref=b1&service_ref=svc1&month=2026-10')->json('data.days'))->keyBy('date');
        $this->assertNotSame('closed', $open['2026-10-03']['status'], 'with no closed days set, weekends open (interview Q10)');
    }

    public function test_branch_options_rank_by_distance_only_with_a_location_and_never_store_it(): void
    {
        $this->b['b1']->update(['latitude' => 14.800254, 'longitude' => 120.9233274]);
        $this->actingAsUser('patientA');
        $without = $this->getJson('/api/appointments/branch-options?service_ref=svc1')->assertOk()->json('data');
        $this->assertFalse($without['location_used']);
        $recommended = collect($without['branches'])->firstWhere('recommended', true);
        $this->assertStringStartsWith('earliest slot', $recommended['reason']);
        $with = $this->getJson('/api/appointments/branch-options?service_ref=svc1&latitude=14.80&longitude=120.92')->assertOk()->json('data');
        $this->assertTrue($with['location_used']);
        $this->assertStringStartsWith('Closest to you, earliest slot', collect($with['branches'])->firstWhere('recommended', true)['reason']);
        $this->assertNotNull($with['branches'][0]['distance_km']);
        $this->assertStringNotContainsString('120.92', json_encode(\Illuminate\Support\Facades\DB::table('audit_logs')->get()), 'the location is not stored');
        $this->getJson('/api/appointments/branch-options?service_ref=svc1&latitude=200&longitude=1')->assertStatus(422);
    }

    public function test_notifications_come_only_from_real_events_and_belong_to_one_person(): void
    {
        $this->actingAsUser('patientA');
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.unread', 0);
        $id = $this->book(['date' => '2026-09-30', 'start_time' => '10:00'])->assertCreated()->json('data.id');
        $list = $this->getJson('/api/notifications')->assertOk()->assertJsonPath('meta.unread', 1)->json('data');
        $this->assertSame(['appointment_booked', 'Appointment confirmed', 'visits', $id], [$list[0]['kind'], $list[0]['title'], $list[0]['target']['page'], $list[0]['target']['id']]);
        // Stored with its offset: the time shown is now in Manila, not 8 hours off.
        $this->assertSame(\App\Support\ClinicClock::now()->toIso8601String(), $list[0]['created_at']);
        $this->actingAsUser('patientB');
        $this->getJson('/api/notifications')->assertJsonCount(0, 'data');
        $this->postJson("/api/notifications/{$list[0]['id']}/read")->assertNotFound();
        $this->actingAsUser('patientA');
        $this->postJson("/api/notifications/{$list[0]['id']}/read")->assertOk()->assertJsonPath('meta.unread', 0);
        $this->postJson('/api/appointments/'.$id.'/cancel', ['expected_revision' => 1])->assertOk();
        $this->assertSame(['appointment_cancelled', 'appointment_booked'], UserNotification::orderByDesc('id')->pluck('kind')->all());
        $this->postJson('/api/notifications/read-all')->assertOk()->assertJsonPath('meta.unread', 0);
    }

    public function test_a_message_from_the_clinic_notifies_the_patient_without_its_text(): void
    {
        $this->actingAsUser('patientA');
        $conversation = $this->postJson('/api/conversations', ['branch_id' => strtolower($this->b['b1']->public_id), 'body' => 'Hello clinic'], ['Idempotency-Key' => (string) \Illuminate\Support\Str::uuid()])
            ->assertCreated()->json('data.conversation.id');
        $this->assertSame(0, UserNotification::count(), 'the Patient\'s own message notifies nobody here');
        $this->actingAsUser('staffB1');
        $this->postJson("/api/conversations/{$conversation}/messages", ['body' => 'PRIVATE-REPLY-TEXT'], ['Idempotency-Key' => (string) \Illuminate\Support\Str::uuid()])->assertCreated();
        $note = UserNotification::sole();
        $this->assertSame(['message_received', 'messages', $conversation], [$note->kind, $note->target_page, $note->target_id]);
        $this->assertStringNotContainsString('PRIVATE-REPLY-TEXT', json_encode($note->toArray()));
    }

    public function test_changing_the_sign_in_email_requires_the_current_password_on_the_server(): void
    {
        $this->actingAsUser('patientA');
        $this->postJson('/api/account/email', ['new_email' => 'new.address@example.test'])->assertStatus(422)->assertJsonValidationErrors('current_password');
        $this->postJson('/api/account/email', ['new_email' => 'new.address@example.test', 'current_password' => 'not-the-password'])->assertStatus(422)->assertJsonPath('code', 'invalid_password');
    }
}
