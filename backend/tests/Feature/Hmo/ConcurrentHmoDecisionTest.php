<?php

namespace Tests\Feature\Hmo;

use App\Models\HmoCase;
use App\Models\HmoCaseEvent;
use App\Models\Visit;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Real PHP processes (separate PostgreSQL connections, real commits) race conflicting M12 decisions on the same case.
// Exactly one wins; the case never holds two outcomes. Rebuilds the dedicated test database before and after itself.
class ConcurrentHmoDecisionTest extends TestCase
{
    use SchedulingFixture;

    private int $keys = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('dental_clinic_test', config('database.connections.pgsql.database'), 'refusing to run outside the test database');
        $this->artisan('migrate:fresh')->assertSuccessful();
        $this->setUpSchedulingWorld();
        $this->travelBack(); // the child processes use the real clock
        $this->d['d1']->update(['shift_start' => '00:00', 'shift_end' => '23:59']);
        $this->b['b1']->update(['open_time' => '00:00', 'close_time' => '23:59']);
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    /** A committed Ready-for-Submission case for Patient $patient (arranged directly after the real open command). */
    private function readyCase(string $patient): HmoCase
    {
        $this->actingAsUser('staffB1');
        $id = $this->postJson('/api/visits/walk-in', ['patient_id' => $this->p[$patient]->public_id, 'branch_ref' => 'b1', 'service_ref' => 'svc1', 'dentist_ref' => 'd1'],
            ['Idempotency-Key' => 'w-'.(++$this->keys)])->assertCreated()->json('data.id');
        $visit = Visit::where('public_id', $id)->sole();
        $this->postJson("/api/visits/{$visit->public_id}/hmo-membership", ['provider_name' => 'Insurer', 'member_number' => 'M-1', 'expected_active_id' => null],
            ['Idempotency-Key' => 'm-'.$this->keys])->assertCreated();
        $case = HmoCase::where('public_id', $this->postJson("/api/visits/{$visit->public_id}/hmo-case", [], ['Idempotency-Key' => 'o-'.$this->keys])->assertCreated()->json('data.id'))->sole();
        DB::table('hmo_case_requirements')->where('hmo_case_id', $case->id)->update(['state' => 'Validated', 'validated_at' => now()]);
        DB::table('hmo_cases')->where('id', $case->id)->update(['status' => 'Ready for Submission']);

        return $case->fresh();
    }

    private function race(array $requests): array
    {
        $token = $this->u['staffB1']->createToken('concurrency-test')->plainTextToken;
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($requests as $i => [$path, $body]) {
            $process = proc_open(
                [PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, $path, json_encode($body), (string) $startAt, json_encode(['Idempotency-Key' => 'race-'.$i.'-'.(++$this->keys)])],
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
        usort($results, fn ($a, $b) => $a['status'] <=> $b['status']);

        return $results;
    }

    public function test_approve_versus_reject_leaves_exactly_one_final_outcome(): void
    {
        $case = $this->readyCase('A');
        $this->postJson("/api/hmo-cases/{$case->public_id}/submit", ['expected_revision' => $case->revision, 'method' => 'Portal', 'note' => 'sent'], ['Idempotency-Key' => 'submit'])->assertOk();
        $case = $case->fresh();
        $base = ['expected_revision' => $case->revision, 'submission_cycle' => 1, 'method' => 'Email', 'note' => 'provider reply'];
        $results = $this->race([
            ["/api/hmo-cases/{$case->public_id}/response", $base + ['outcome' => 'Approved', 'approved_amount' => '1200.00']],
            ["/api/hmo-cases/{$case->public_id}/response", $base + ['outcome' => 'Rejected']],
        ]);

        $this->assertSame(200, $results[0]['status'], json_encode($results));
        $this->assertContains($results[1]['status'], [409, 422], json_encode($results));
        $this->assertContains($case->fresh()->status, ['Approved', 'Rejected']);
        $this->assertSame(1, HmoCaseEvent::where('hmo_case_id', $case->id)->where('kind', 'response')->count());
    }

    public function test_withdrawal_versus_submission_cannot_both_happen(): void
    {
        $case = $this->readyCase('B');
        $results = $this->race([
            ["/api/hmo-cases/{$case->public_id}/withdraw", ['expected_revision' => $case->revision, 'reason' => 'Patient will self-pay']],
            ["/api/hmo-cases/{$case->public_id}/submit", ['expected_revision' => $case->revision, 'method' => 'Portal', 'note' => 'sent']],
        ]);

        $this->assertSame(200, $results[0]['status'], json_encode($results));
        $this->assertContains($results[1]['status'], [409, 422], json_encode($results));
        $final = $case->fresh();
        $this->assertContains($final->status, ['Withdrawn', 'Pending']);
        $this->assertSame($final->status === 'Withdrawn' ? 0 : 1, $final->submission_cycle);
        $this->assertSame(1, HmoCaseEvent::where('hmo_case_id', $case->id)->whereIn('kind', ['withdrawal', 'submission'])->count());
    }
}
