<?php

namespace Tests\Feature\Appointments;

use App\Models\Appointment;
use App\Models\AppointmentHistory;
use App\Models\Visit;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Backend additions for the M6 React cutover: bounded list ranges, the server-owned appointment_code, the minimal
// Patient directory and the appointment-only lifecycle command (the pre-arrival No-show). Check-In and the clinical
// progression moved to Visit commands in M8 (tests/Feature/Visits).
class AppointmentCutoverSupportTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    private function command(Appointment $a, string $command, ?int $revision = null)
    {
        return $this->postJson("/api/appointments/{$a->public_id}/{$command}", ['expected_revision' => $revision ?? $a->fresh()->revision]);
    }

    // ---- LIST RANGE ------------------------------------------------------------------------------------------

    public function test_list_supports_a_bounded_date_range_with_pagination(): void
    {
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '09:00');
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-10-05', '09:00');
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-11-20', '09:00');
        $this->actingAsUser('owner');

        $this->getJson('/api/appointments?from=2026-09-29&to=2026-10-05')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2);
        $this->getJson('/api/appointments?from=2026-09-29&to=2026-10-05&per_page=1')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.last_page', 2);
        $this->getJson('/api/appointments?from=2026-09-29&to=2027-04-15')->assertStatus(422)->assertJsonValidationErrors('to');
        $this->getJson('/api/appointments?from=2026-10-05&to=2026-09-29')->assertStatus(422)->assertJsonValidationErrors('to');
        $this->getJson('/api/appointments?from=2026-09-29')->assertStatus(422)->assertJsonValidationErrors('to');
        $this->getJson('/api/appointments?per_page=500')->assertStatus(422)->assertJsonValidationErrors('per_page');

        // Scope still applies inside a range.
        $this->existing('B', 'd3', 'b2', 'svc1', '2026-09-30', '09:00');
        $this->actingAsUser('staffB1');
        $this->getJson('/api/appointments?from=2026-09-29&to=2026-10-05')->assertOk()->assertJsonCount(2, 'data');
    }

    // ---- APPOINTMENT CODE ------------------------------------------------------------------------------------

    public function test_appointment_code_is_server_generated_unique_and_immutable(): void
    {
        $this->actingAsUser('patientA');
        $first = $this->book()->assertCreated()->json('data.code');
        $second = $this->book(['date' => '2026-09-30'])->assertCreated()->json('data.code');
        $this->assertMatchesRegularExpression('/^APT-2026-\d{6}$/', $first);
        $this->assertNotSame($first, $second);

        $direct = $this->existing('B', 'd2', 'b1', 'svc1', '2026-10-02', '09:00');
        $this->assertMatchesRegularExpression('/^APT-\d{4}-\d{6}$/', $direct->fresh()->appointment_code, 'every insert path gets a code');

        // A client cannot supply one...
        $this->book(['date' => '2026-10-01', 'appointment_code' => 'APT-2026-999999'])->assertCreated()
            ->assertJsonPath('data.code', fn ($code) => $code !== 'APT-2026-999999');
        // ...and the database refuses to change one.
        $this->expectException(QueryException::class);
        DB::table('appointments')->where('id', $direct->id)->update(['appointment_code' => 'APT-2026-000001']);
    }

    public function test_appointment_code_backfills_existing_rows(): void
    {
        $existing = [$this->existing('A', 'd1', 'b1', 'svc1', '2026-10-01', '09:00'), $this->existing('B', 'd2', 'b1', 'svc1', '2026-10-01', '09:00')];
        $migration = require database_path('migrations/2026_09_29_000200_add_appointment_code_to_appointments_table.php');
        $migration->down();
        $migration->up();

        $codes = DB::table('appointments')->orderBy('id')->pluck('appointment_code')->all();
        $this->assertCount(2, array_unique($codes));
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^APT-\d{4}-\d{6}$/', $code);
        }
        $this->assertCount(count($existing), $codes);
    }

    // ---- PATIENT DIRECTORY -----------------------------------------------------------------------------------

    public function test_patient_directory_returns_public_ids_for_staff_and_owner_only(): void
    {
        $this->actingAsUser('staffB1');
        $rows = $this->getJson('/api/patients')->assertOk()->json('data');
        $this->assertCount(2, $rows);
        foreach ($rows as $row) {
            $this->assertSame(['id', 'code', 'name', 'first_name', 'last_name', 'phone', 'date_of_birth'], array_keys($row));
            $this->assertMatchesRegularExpression('/^[0-9a-hjkmnp-tv-z]{26}$/', $row['id']);
        }
        $this->getJson('/api/patients?search=PAT-0002')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $this->p['B']->public_id);
        $name = strtolower($this->p['A']->person->last_name);
        $this->getJson('/api/patients?search='.urlencode($name))->assertOk()->assertJsonPath('data.0.id', $this->p['A']->public_id);
        $this->getJson('/api/patients?search=x')->assertStatus(422)->assertJsonValidationErrors('search');

        $this->actingAsUser('owner');
        $this->getJson('/api/patients')->assertOk()->assertJsonCount(2, 'data');

        foreach (['patientA', 'dentist1', 'staffNone'] as $who) {
            $this->actingAsUser($who);
            $this->getJson('/api/patients')->assertForbidden();
        }
    }

    public function test_patient_directory_requires_authentication(): void
    {
        $this->getJson('/api/patients')->assertUnauthorized();
    }

    public function test_patient_reschedule_availability_is_limited_to_the_current_dentist(): void
    {
        $mine = $this->existing('A', 'd1', 'b1', 'svc1', '2026-10-01', '09:00');
        $this->existing('B', 'd1', 'b1', 'svc1', '2026-10-02', '10:00'); // d1 busy at 10:00 on 10-02, d2 free
        $this->actingAsUser('patientA');
        $slots = collect($this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-10-02&appointment_id='.$mine->public_id)
            ->assertOk()->json('data.slots'));
        $this->assertNotContains('10:00', $slots->pluck('start_time')->all(), 'd2 would be free, but a Patient reschedule keeps d1');
        $this->assertSame(['d1'], $slots->pluck('dentist.id')->unique()->values()->all());
        $this->postJson("/api/appointments/{$mine->public_id}/reschedule", ['expected_revision' => 1, 'date' => '2026-10-02', 'start_time' => $slots->first()['start_time']])->assertOk();
    }

    public function test_staff_availability_can_be_limited_to_one_dentist_but_patients_cannot_choose(): void
    {
        $this->existing('B', 'd1', 'b1', 'svc1', '2026-10-02', '10:00');
        $this->actingAsUser('staffB1');
        $slots = collect($this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-10-02&dentist_ref=d1')->assertOk()->json('data.slots'));
        $this->assertSame(['d1'], $slots->pluck('dentist.id')->unique()->values()->all());
        $this->assertNotContains('10:00', $slots->pluck('start_time')->all());
        // An ineligible Dentist yields no slots rather than a guess.
        $this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-10-02&dentist_ref=d3')->assertOk()->assertJsonCount(0, 'data.slots');

        $this->actingAsUser('patientA');
        $this->getJson('/api/appointments/availability?branch_ref=b1&service_ref=svc1&date=2026-10-02&dentist_ref=d1')->assertStatus(422)->assertJsonValidationErrors('dentist_ref');
    }

    // ---- APPOINTMENT LIFECYCLE (after M8) ---------------------------------------------------------------------

    public function test_retired_appointment_commands_no_longer_exist(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        foreach (['staffB1', 'dentist1', 'owner'] as $who) {
            $this->actingAsUser($who);
            foreach (['check-in', 'start-treatment', 'complete', 'set-status'] as $retired) {
                $this->command($a, $retired)->assertNotFound();
            }
        }
        $this->assertSame('Confirmed', $a->fresh()->status);
        $this->assertSame(0, AppointmentHistory::where('appointment_id', $a->id)->count());
    }

    public function test_no_show_is_a_pre_arrival_same_day_decision_and_creates_no_visit(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $this->actingAsUser('staffB1');
        $this->command($a, 'no-show')->assertOk()->assertJsonPath('data.status', 'No-show')->assertJsonPath('data.revision', 2);
        $this->assertSame(['appointment.no_show'], AppointmentHistory::where('appointment_id', $a->id)->pluck('event')->all());
        $this->assertSame(0, Visit::count());
        // Terminal: it cannot be checked in afterwards.
        $this->postJson('/api/visits/check-in', ['appointment_id' => $a->public_id, 'expected_revision' => 2], ['Idempotency-Key' => 'late'])
            ->assertStatus(422)->assertJsonPath('code', 'invalid_transition');

        $future = $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-29', '11:00');
        $this->command($future, 'no-show')->assertStatus(422)->assertJsonPath('code', 'not_today');
    }

    public function test_no_show_and_cancel_are_refused_once_a_visit_exists(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $this->actingAsUser('staffB1');
        $this->postJson('/api/visits/check-in', ['appointment_id' => $a->public_id, 'expected_revision' => 1], ['Idempotency-Key' => 'arrive'])->assertCreated();

        $this->command($a, 'no-show')->assertStatus(422)->assertJsonPath('code', 'invalid_transition');
        $this->postJson("/api/appointments/{$a->public_id}/cancel", ['expected_revision' => 2])->assertStatus(422)->assertJsonPath('code', 'appointment_admitted');
        $this->assertSame('Checked In', $a->fresh()->status);
        $this->assertSame('Checked In', Visit::sole()->status);
    }

    public function test_stale_no_show_is_rejected_and_replays_are_safe(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $this->actingAsUser('staffB1');
        $this->command($a, 'no-show', 7)->assertStatus(409)->assertJsonPath('code', 'stale_revision');
        $headers = ['Idempotency-Key' => 'noshow-1'];
        $this->postJson("/api/appointments/{$a->public_id}/no-show", ['expected_revision' => 1], $headers)->assertOk();
        $this->postJson("/api/appointments/{$a->public_id}/no-show", ['expected_revision' => 1], $headers)->assertOk()
            ->assertHeader('Idempotent-Replayed', 'true')->assertJsonPath('data.revision', 2);
        // A plain retry after success returns the current record unchanged.
        $this->command($a, 'no-show', 1)->assertOk()->assertJsonPath('data.revision', 2);
        $this->assertSame(1, AppointmentHistory::where('appointment_id', $a->id)->count());
    }

    public function test_no_show_authorization(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $b = $this->existing('B', 'd3', 'b2', 'svc1', '2026-09-28', '11:00');

        $this->postJson("/api/appointments/{$a->public_id}/no-show", ['expected_revision' => 1])->assertUnauthorized();
        $this->actingAsUser('patientA');
        $this->command($a, 'no-show')->assertForbidden();
        $this->actingAsUser('dentist1');
        $this->command($a, 'no-show')->assertForbidden();          // a front-desk decision
        $this->actingAsUser('staffB1');
        $this->command($b, 'no-show')->assertForbidden();          // out of scope
        $this->actingAsUser('owner');
        $this->command($b, 'no-show')->assertOk();                 // documented Owner administrative exception
    }
}
