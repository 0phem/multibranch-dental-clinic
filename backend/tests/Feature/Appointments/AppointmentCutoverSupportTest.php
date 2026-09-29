<?php

namespace Tests\Feature\Appointments;

use App\Models\Appointment;
use App\Models\AppointmentHistory;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Backend additions for the M6 React cutover: bounded list ranges, the server-owned appointment_code, the minimal
// Patient directory and the named lifecycle transitions (check-in, no-show, start-treatment, complete).
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

    // ---- LIFECYCLE -------------------------------------------------------------------------------------------

    public function test_check_in_start_and_complete_follow_the_state_table_with_history(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');

        $this->actingAsUser('staffB1');
        $this->command($a, 'check-in')->assertOk()->assertJsonPath('data.status', 'Checked In')->assertJsonPath('data.revision', 2);

        $this->actingAsUser('dentist1');
        $this->command($a, 'start-treatment')->assertOk()->assertJsonPath('data.status', 'In Treatment');
        $this->command($a, 'complete')->assertOk()->assertJsonPath('data.status', 'Completed')->assertJsonPath('data.revision', 4);

        $this->assertSame(['appointment.checked_in', 'appointment.treatment_started', 'appointment.completed'],
            AppointmentHistory::where('appointment_id', $a->id)->orderBy('id')->pluck('event')->all());
        // Completed frees the slot for others (terminal statuses never occupy time).
        $this->assertSame('Completed', $a->fresh()->status);
    }

    public function test_no_show_only_from_checked_in(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $this->actingAsUser('staffB1');
        $this->command($a, 'no-show')->assertStatus(422)->assertJsonPath('code', 'invalid_transition');
        $this->command($a, 'check-in')->assertOk();
        $this->command($a, 'no-show')->assertOk()->assertJsonPath('data.status', 'No-show');
        $this->command($a, 'check-in', 3)->assertStatus(422)->assertJsonPath('code', 'invalid_transition');
    }

    public function test_invalid_transitions_and_stale_revisions_are_rejected(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $this->actingAsUser('dentist1');
        $this->command($a, 'complete')->assertStatus(422)->assertJsonPath('code', 'invalid_transition');
        $this->command($a, 'start-treatment')->assertStatus(422)->assertJsonPath('code', 'invalid_transition');

        $this->actingAsUser('staffB1');
        $this->command($a, 'check-in', 7)->assertStatus(409)->assertJsonPath('code', 'stale_revision');
        $this->command($a, 'check-in')->assertOk();
        // Once admitted the appointment can no longer be rescheduled (admitted-appointment protection).
        $this->postJson("/api/appointments/{$a->public_id}/reschedule", ['expected_revision' => 2, 'date' => '2026-09-29', 'start_time' => '10:00'])
            ->assertStatus(422)->assertJsonPath('code', 'appointment_not_reschedulable');
        $this->postJson("/api/appointments/{$a->public_id}/set-status", ['expected_revision' => 2])->assertNotFound();
    }

    public function test_repeating_an_applied_transition_is_a_safe_no_op_and_keys_replay(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $this->actingAsUser('staffB1');
        $headers = ['Idempotency-Key' => 'checkin-1'];
        $this->withHeaders($headers)->postJson("/api/appointments/{$a->public_id}/check-in", ['expected_revision' => 1])->assertOk();
        $this->withHeaders($headers)->postJson("/api/appointments/{$a->public_id}/check-in", ['expected_revision' => 1])->assertOk()
            ->assertHeader('Idempotent-Replayed', 'true')->assertJsonPath('data.revision', 2);
        // A plain retry after success returns the current record unchanged.
        $this->command($a, 'check-in', 1)->assertOk()->assertJsonPath('data.revision', 2);
        $this->assertSame(1, AppointmentHistory::where('appointment_id', $a->id)->count());
    }

    public function test_check_in_is_limited_to_todays_appointments(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '11:00');
        $this->actingAsUser('staffB1');
        $this->command($a, 'check-in')->assertStatus(422)->assertJsonPath('code', 'not_today');
    }

    public function test_transition_authorization(): void
    {
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $b = $this->existing('B', 'd3', 'b2', 'svc1', '2026-09-28', '11:00');

        $this->postJson("/api/appointments/{$a->public_id}/check-in", ['expected_revision' => 1])->assertUnauthorized();

        $this->actingAsUser('patientA');
        $this->command($a, 'check-in')->assertForbidden();
        $this->actingAsUser('staffB1');
        $this->command($b, 'check-in')->assertForbidden();           // out of scope
        $this->command($a, 'start-treatment')->assertForbidden();    // clinical transitions are Dentist-only
        $this->actingAsUser('dentist1');
        $this->command($a, 'check-in')->assertForbidden();           // arrival is a front-desk action
        $this->command($b, 'start-treatment')->assertForbidden();    // not this Dentist's appointment

        $this->actingAsUser('owner');
        $this->command($b, 'check-in')->assertOk();                  // documented Owner administrative exception
        $this->command($b, 'start-treatment')->assertForbidden();
    }
}
