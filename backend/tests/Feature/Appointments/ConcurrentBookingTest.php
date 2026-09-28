<?php

namespace Tests\Feature\Appointments;

use App\Models\Appointment;
use App\Support\ClinicClock;
use Tests\TestCase;

// Two real PHP processes, each with its own PostgreSQL connection, submit competing bookings for the same Dentist and
// time at the same instant. Exactly one may succeed. This needs committed data, so it does not use RefreshDatabase:
// it rebuilds the dedicated test database before and after itself (never the development database).
class ConcurrentBookingTest extends TestCase
{
    use SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('dental_clinic_test', config('database.connections.pgsql.database'), 'refusing to run outside the test database');
        $this->artisan('migrate:fresh')->assertSuccessful();
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    public function test_simultaneous_competing_bookings_only_one_succeeds(): void
    {
        $this->setUpSchedulingWorld();
        $this->travelBack(); // the child processes use the real clock
        $date = ClinicClock::now()->addDays(7)->toDateString();
        $token = $this->u['staffB1']->createToken('concurrency-test')->plainTextToken;

        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ([$this->p['A']->public_id, $this->p['B']->public_id] as $patient) {
            $payload = json_encode(['patient_id' => $patient, 'branch_ref' => 'b1', 'service_ref' => 'svc1', 'dentist_ref' => 'd1', 'date' => $date, 'start_time' => '10:00']);
            $process = proc_open(
                [PHP_BINARY, base_path('tests/Support/concurrent_booking.php'), $token, $payload, (string) $startAt],
                [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
                $pipes,
                base_path(),
                array_merge(getenv(), ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'dental_clinic_test', 'DB_URL' => '',
                    'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'BCRYPT_ROUNDS' => '4'])
            );
            $children[] = [$process, $pipes];
        }

        $results = [];
        foreach ($children as [$process, $pipes]) {
            $out = stream_get_contents($pipes[1]);
            $err = stream_get_contents($pipes[2]);
            proc_close($process);
            $results[] = json_decode($out, true) ?? $this->fail("child process failed: {$out} {$err}");
        }

        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame(201, $statuses[0], json_encode($results));
        $this->assertContains($statuses[1], [409, 422], json_encode($results));
        $this->assertSame(1, Appointment::active()->where('dentist_profile_id', $this->d['d1']->id)->count());
    }
}
