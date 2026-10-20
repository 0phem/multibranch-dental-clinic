<?php

namespace Tests\Feature\Prescriptions;

use App\Models\Prescription;
use App\Models\Visit;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Real PHP processes (separate PostgreSQL connections, real commits) issue prescriptions at the same instant: the numbers are
// consecutive with no gap and no duplicate. Rebuilds the dedicated test database before and after itself.
class ConcurrentPrescriptionTest extends TestCase
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

    public function test_concurrent_issues_get_consecutive_numbers_without_gaps(): void
    {
        $visit = Visit::create(['patient_id' => $this->p['A']->id, 'branch_id' => $this->b['b1']->id, 'source' => 'walk_in', 'status' => 'Checked In', 'responsible_dentist_profile_id' => $this->d['d1']->id,
            'requested_service_id' => $this->svc['svc1']->id, 'arrived_at' => now(), 'clinic_date' => now()->format('Y-m-d'), 'revision' => 1, 'created_by_user_id' => $this->u['staffB1']->id, 'updated_by_user_id' => $this->u['staffB1']->id]);
        $ids = [];
        for ($i = 0; $i < 5; $i++) {
            $p = Prescription::create(['patient_id' => $visit->patient_id, 'branch_id' => $visit->branch_id, 'visit_id' => $visit->id, 'dentist_profile_id' => $this->d['d1']->id,
                'created_by_user_id' => $this->u['dentist1']->id, 'status' => 'Draft']);
            $p->lines()->create(['line_no' => 1, 'medicine' => "Medicine $i"]);
            $ids[] = $p->public_id;
        }
        $token = $this->u['dentist1']->createToken('concurrency-test')->plainTextToken;
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($ids as $id) {
            $process = proc_open([PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, "/api/prescriptions/$id/issue", json_encode(['expected_revision' => 1]), (string) $startAt],
                [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path(),
                array_merge(getenv(), ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'dental_clinic_test', 'DB_URL' => '', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'MAIL_MAILER' => 'array', 'BCRYPT_ROUNDS' => '4']));
            $children[] = [$process, $pipes];
        }
        $statuses = [];
        foreach ($children as [$process, $pipes]) {
            $out = stream_get_contents($pipes[1]);
            $err = stream_get_contents($pipes[2]);
            proc_close($process);
            $statuses[] = (json_decode($out, true) ?? $this->fail("child process failed: $out $err"))['status'];
        }
        $this->assertSame([200, 200, 200, 200, 200], $statuses);
        $year = now('Asia/Manila')->format('Y');
        $this->assertSame(array_map(fn ($n) => sprintf('RX-%s-%06d', $year, $n), range(1, 5)), Prescription::orderBy('number')->pluck('number')->all());
    }
}
