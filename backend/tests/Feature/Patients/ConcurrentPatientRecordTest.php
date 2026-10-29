<?php

namespace Tests\Feature\Patients;

use App\Models\Patient;
use App\Models\Person;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Real PHP processes (separate PostgreSQL connections, real commits) race the M4 identity commands. Rebuilds the dedicated
// test database before and after itself (TestCase refuses any other database).
class ConcurrentPatientRecordTest extends TestCase
{
    use SchedulingFixture;

    private int $keys = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('dental_clinic_scratch', config('database.connections.pgsql.database'), 'refusing to run outside the test database');
        $this->artisan('migrate:fresh')->assertSuccessful();
        $this->setUpSchedulingWorld();
        $this->travelBack();
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    private function race(array $requests, string $method = 'POST'): array
    {
        $token = $this->u['staffB1']->createToken('concurrency-test')->plainTextToken;
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($requests as $i => [$path, $body]) {
            $process = proc_open(
                [PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, $path, json_encode($body), (string) $startAt, json_encode(['Idempotency-Key' => 'race-'.$i.'-'.(++$this->keys)]), $method],
                [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
                $pipes,
                base_path(),
                array_merge(getenv(), ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'dental_clinic_scratch', 'DB_URL' => '',
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
        usort($results, fn ($a, $b) => $a['status'] <=> $b['status']);

        return $results;
    }

    public function test_two_simultaneous_registrations_with_the_same_email_create_one_patient(): void
    {
        $before = Patient::count();
        $body = ['first_name' => 'Ana', 'last_name' => 'Cruz', 'email' => 'race@example.test'];
        $results = $this->race([['/api/patients', $body], ['/api/patients', $body]]);

        $this->assertSame([201, 422], array_column($results, 'status'), json_encode($results));
        $this->assertSame('patient_email_exists', $results[1]['body']['code']);
        $this->assertSame($before + 1, Patient::count());
        $this->assertSame(1, Person::where('email', 'race@example.test')->count());
    }

    public function test_simultaneous_registrations_of_different_people_get_distinct_codes(): void
    {
        $results = $this->race([
            ['/api/patients', ['first_name' => 'Ana', 'last_name' => 'Cruz', 'email' => 'a@race.test']],
            ['/api/patients', ['first_name' => 'Ben', 'last_name' => 'Diaz', 'email' => 'b@race.test']],
        ]);

        $this->assertSame([201, 201], array_column($results, 'status'), json_encode($results));
        $codes = array_map(fn ($r) => $r['body']['data']['code'], $results);
        $this->assertCount(2, array_unique($codes));
        $this->assertEqualsCanonicalizing(['PAT-0003', 'PAT-0004'], $codes);
    }

    public function test_two_edits_from_the_same_revision_cannot_both_win(): void
    {
        $patient = $this->p['A'];
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-30', '10:00'); // gives staffB1 the full-profile tier
        $path = '/api/patients/'.$patient->public_id;
        $results = $this->race([
            [$path, ['expected_revision' => 1, 'phone' => '+639171111111']],
            [$path, ['expected_revision' => 1, 'phone' => '+639172222222']],
        ], 'PATCH');

        $this->assertSame([200, 409], array_column($results, 'status'), json_encode($results));
        $this->assertSame('stale_revision', $results[1]['body']['code']);
        $this->assertSame(2, $patient->fresh()->revision, 'exactly one edit was applied');
        $this->assertContains($patient->person->fresh()->phone, ['+639171111111', '+639172222222']);
    }
}
