<?php

namespace Tests\Feature\Visits;

use App\Models\Visit;
use App\Support\ClinicClock;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Two real PHP processes (two Staff sessions, two PostgreSQL connections) check in the same appointment at the same
// instant with different Idempotency-Keys. Exactly one Visit may exist afterwards. Like ConcurrentBookingTest it needs
// committed data, so it rebuilds the dedicated test database before and after itself (never the development database).
class ConcurrentCheckInTest extends TestCase
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

    public function test_simultaneous_check_ins_of_one_appointment_create_one_visit(): void
    {
        $this->setUpSchedulingWorld();
        $this->travelBack(); // the child processes use the real clock
        $appointment = $this->existing('A', 'd1', 'b1', 'svc1', ClinicClock::today(), '12:00');

        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach (['staffB1', 'staffBoth'] as $i => $who) {
            $token = $this->u[$who]->createToken('concurrency-test')->plainTextToken;
            $payload = json_encode(['appointment_id' => $appointment->public_id, 'expected_revision' => 1]);
            $process = proc_open(
                [PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, '/api/visits/check-in', $payload, (string) $startAt, json_encode(['Idempotency-Key' => "race-{$i}"])],
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
        $this->assertSame([201, 409], $statuses, json_encode($results));
        $this->assertSame(1, Visit::where('appointment_id', $appointment->id)->count());
        $this->assertSame('Checked In', $appointment->fresh()->status);
        $this->assertSame(2, $appointment->fresh()->revision);
    }
}
