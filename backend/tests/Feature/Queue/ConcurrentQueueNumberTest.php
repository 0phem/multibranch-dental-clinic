<?php

namespace Tests\Feature\Queue;

use App\Models\QueueEntry;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Two real PHP processes (two Staff sessions, two PostgreSQL connections) admit two different walk-in Patients into the
// same Dentist queue at the same instant. The atomic dentist_queues upsert must hand out distinct numbers 1 and 2.
// Needs committed data, so it rebuilds the dedicated test database before and after itself (never the dev database).
class ConcurrentQueueNumberTest extends TestCase
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

    public function test_simultaneous_arrivals_get_distinct_queue_numbers(): void
    {
        $this->setUpSchedulingWorld();
        $this->travelBack(); // the child processes use the real clock
        $this->d['d1']->update(['shift_start' => '00:00', 'shift_end' => '23:59']);
        $this->b['b1']->update(['open_time' => '00:00', 'close_time' => '23:59']);

        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ([['staffB1', 'A'], ['staffBoth', 'B']] as $i => [$who, $patient]) {
            $token = $this->u[$who]->createToken('concurrency-test')->plainTextToken;
            $payload = json_encode(['patient_id' => $this->p[$patient]->public_id, 'branch_ref' => 'b1', 'service_ref' => 'svc1', 'dentist_ref' => 'd1']);
            $process = proc_open(
                [PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, '/api/visits/walk-in', $payload, (string) $startAt, json_encode(['Idempotency-Key' => "race-{$i}"])],
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

        $this->assertSame([201, 201], array_column($results, 'status'), json_encode($results));
        $numbers = QueueEntry::orderBy('queue_number')->pluck('queue_number')->all();
        $this->assertSame([1, 2], $numbers);
    }
}
