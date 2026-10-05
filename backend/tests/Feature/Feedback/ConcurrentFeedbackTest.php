<?php

namespace Tests\Feature\Feedback;

use App\Models\PatientFeedback;
use App\Models\Visit;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Real PHP processes (separate PostgreSQL connections, real commits) race M26 submissions. Rebuilds the dedicated test database before and
// after itself (never the dev database). A Completed Visit cannot change state, so there is no eligibility race to test.
class ConcurrentFeedbackTest extends TestCase
{
    use SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('dental_clinic_test', config('database.connections.pgsql.database'), 'refusing to run outside the test database');
        $this->artisan('migrate:fresh')->assertSuccessful();
        $this->setUpSchedulingWorld();
        $this->travelBack();
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    private function completedVisit(): Visit
    {
        $visit = Visit::create(['patient_id' => $this->p['A']->id, 'branch_id' => $this->b['b1']->id, 'source' => 'walk_in', 'status' => 'Checked In', 'responsible_dentist_profile_id' => $this->d['d1']->id,
            'requested_service_id' => $this->svc['svc1']->id, 'arrived_at' => now(), 'clinic_date' => now()->format('Y-m-d'), 'revision' => 1, 'created_by_user_id' => $this->u['staffB1']->id, 'updated_by_user_id' => $this->u['staffB1']->id]);
        DB::transaction(fn () => $visit->update(['status' => 'Completed', 'closed_at' => now(), 'revision' => 2]));

        return $visit->fresh();
    }

    /** @param list<array{0:array,1:string}> $requests [body, key] */
    private function race(array $requests): array
    {
        $token = $this->u['patientA']->createToken('concurrency-test')->plainTextToken;
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($requests as [$body, $key]) {
            $process = proc_open([PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, '/api/feedback', json_encode($body), (string) $startAt, json_encode(['Idempotency-Key' => $key])],
                [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path(),
                array_merge(getenv(), ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'dental_clinic_test', 'DB_URL' => '', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'BCRYPT_ROUNDS' => '4']));
            $children[] = [$process, $pipes];
        }
        $results = [];
        foreach ($children as [$process, $pipes]) {
            $out = stream_get_contents($pipes[1]);
            $err = stream_get_contents($pipes[2]);
            proc_close($process);
            $results[] = json_decode($out, true) ?? $this->fail("child process failed: {$out} {$err}");
        }

        return $results;
    }

    public function test_a_double_submitted_request_with_one_key_is_stored_once(): void
    {
        $visit = $this->completedVisit();
        $body = ['visit_id' => $visit->public_id, 'body' => 'Thank you'];
        $results = $this->race([[$body, 'same'], [$body, 'same']]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertContains($statuses, [[201, 201], [201, 409]], json_encode($results));
        $this->assertSame(1, PatientFeedback::count());
        if ($statuses === [201, 201]) {
            $this->assertSame($results[0]['body']['data']['id'], $results[1]['body']['data']['id']);
        }
    }

    public function test_separate_legitimate_submissions_racing_are_all_kept(): void
    {
        $visit = $this->completedVisit();
        $results = $this->race([[['visit_id' => $visit->public_id, 'body' => 'same text'], 'k1'], [['visit_id' => $visit->public_id, 'body' => 'same text'], 'k2'], [['visit_id' => $visit->public_id, 'body' => 'other'], 'k3']]);
        $this->assertSame([201, 201, 201], array_column($results, 'status'), json_encode($results));
        $this->assertSame(3, PatientFeedback::where('visit_id', $visit->id)->count());
        $this->assertSame(3, PatientFeedback::pluck('public_id')->unique()->count());
    }
}
