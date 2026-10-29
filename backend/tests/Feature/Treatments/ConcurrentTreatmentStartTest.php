<?php

namespace Tests\Feature\Treatments;

use App\Models\QueueEntry;
use App\Models\Treatment;
use App\Models\TreatmentProcedure;
use App\Models\Visit;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Real PHP processes (separate PostgreSQL connections) race the M5 start command, and the parent then documents and
// completes with REAL commits, so the deferred commit-time constraints (Visit/Treatment consistency, renumbered line
// uniqueness) are exercised. Rebuilds the dedicated test database before and after itself (never the dev database).
class ConcurrentTreatmentStartTest extends TestCase
{
    use SchedulingFixture;

    private int $keys = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('dental_clinic_scratch', config('database.connections.pgsql.database'), 'refusing to run outside the test database');
        $this->artisan('migrate:fresh')->assertSuccessful();
        $this->setUpSchedulingWorld();
        $this->travelBack(); // the child processes use the real clock
        foreach (['d1', 'd2'] as $d) {
            $this->d[$d]->update(['shift_start' => '00:00', 'shift_end' => '23:59']);
        }
        $this->b['b1']->update(['open_time' => '00:00', 'close_time' => '23:59']);
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    private function calledWalkIn(string $patient): Visit
    {
        $this->actingAsUser('staffB1');
        $id = $this->postJson('/api/visits/walk-in', ['patient_id' => $this->p[$patient]->public_id, 'branch_ref' => 'b1', 'service_ref' => 'svc1', 'dentist_ref' => 'd1'],
            ['Idempotency-Key' => 'arrive-'.(++$this->keys)])->assertCreated()->json('data.id');
        $visit = Visit::where('public_id', $id)->sole();
        $entry = $visit->queueEntry;
        $this->postJson("/api/queue/{$entry->public_id}/call", ['expected_revision' => $entry->revision], ['Idempotency-Key' => 'call-'.$this->keys])->assertOk();

        return $visit->fresh();
    }

    /** @param list<Visit> $visits one child per Visit, all as dentist1, released at the same instant */
    private function race(array $visits): array
    {
        $token = $this->u['dentist1']->createToken('concurrency-test')->plainTextToken;
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($visits as $i => $visit) {
            $process = proc_open(
                [PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, "/api/visits/{$visit->public_id}/treatment",
                    json_encode(['expected_revision' => $visit->revision]), (string) $startAt, json_encode(['Idempotency-Key' => "race-{$i}"])],
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

    public function test_two_tabs_starting_the_same_visit_create_one_treatment(): void
    {
        $visit = $this->calledWalkIn('A');
        $results = $this->race([$visit, $visit]);

        $this->assertSame([201, 409], array_column($results, 'status'), json_encode($results));
        $this->assertSame('treatment_exists', $results[1]['body']['code']);
        $this->assertSame(1, Treatment::count());
        $this->assertSame(['In Treatment', 'Served'], [$visit->fresh()->status, QueueEntry::sole()->status]);
    }

    public function test_one_dentist_cannot_start_two_treatments_at_once_and_real_commits_stay_consistent(): void
    {
        $a = $this->calledWalkIn('A');
        $b = $this->calledWalkIn('B');
        $results = $this->race([$a, $b]);

        $this->assertSame([201, 409], array_column($results, 'status'), json_encode($results));
        $this->assertSame('dentist_busy', $results[1]['body']['code'], json_encode($results));
        $this->assertSame(1, Treatment::where('status', 'In Treatment')->count());
        $loser = $a->fresh()->treatment ? $b : $a;
        $this->assertSame(['Checked In', 'Called'], [$loser->fresh()->status, $loser->fresh()->queueEntry->status]);

        // The winner documents (twice, reordering retained lines) and completes with real commits.
        $t = Treatment::sole();
        $this->actingAsUser('dentist1');
        $body = ['prescription_required' => false, 'followup_required' => false, 'procedure_summary' => 'Consultation and cleaning'];
        $ids = array_column($this->postJson("/api/treatments/{$t->public_id}/document", $body + ['expected_revision' => 1,
            'procedures' => [['service_ref' => 'svc1', 'quantity' => 1], ['service_ref' => 'svc2', 'quantity' => 1]]], ['Idempotency-Key' => 'doc-1'])->assertOk()->json('data.procedures'), 'id');
        $this->postJson("/api/treatments/{$t->public_id}/document", $body + ['expected_revision' => 2,
            'procedures' => [['id' => $ids[1], 'service_ref' => 'svc2', 'quantity' => 1], ['id' => $ids[0], 'service_ref' => 'svc1', 'quantity' => 2]]], ['Idempotency-Key' => 'doc-2'])
            ->assertOk()->assertJsonPath('data.procedures.0.id', $ids[1]);
        $this->assertSame([$ids[1], $ids[0]], TreatmentProcedure::orderBy('line_no')->pluck('public_id')->all());
        $this->postJson("/api/treatments/{$t->public_id}/complete", ['expected_revision' => 3], ['Idempotency-Key' => 'done'])->assertOk()->assertJsonPath('data.visit.status', 'Completed');

        // The same Dentist may now start the other Patient the same day.
        $this->postJson("/api/visits/{$loser->public_id}/treatment", ['expected_revision' => $loser->fresh()->revision], ['Idempotency-Key' => 'next'])->assertCreated();
        $this->assertSame(1, Treatment::where('status', 'In Treatment')->count());
    }

    /** @param list<array{0:string,1:array,2:string,3?:string}> $requests [path, payload, idempotency key, token owner] released together */
    private function raceCommands(array $requests): array
    {
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($requests as $request) {
            [$path, $payload, $key] = $request;
            $who = $request[3] ?? 'dentist1';
            $token = $this->u[$who]->createToken('concurrency-test')->plainTextToken;
            $process = proc_open([PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, $path, json_encode($payload), (string) $startAt, json_encode(['Idempotency-Key' => $key])],
                [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path(),
                array_merge(getenv(), ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'dental_clinic_scratch', 'DB_URL' => '', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'BCRYPT_ROUNDS' => '4']));
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

    private function documented(): Treatment
    {
        $visit = $this->calledWalkIn('A');
        $this->actingAsUser('dentist1');
        $this->postJson("/api/visits/{$visit->public_id}/treatment", ['expected_revision' => $visit->revision], ['Idempotency-Key' => 'start-1'])->assertCreated();
        $t = Treatment::sole();
        $this->postJson("/api/treatments/{$t->public_id}/document", ['expected_revision' => 1, 'prescription_required' => false, 'followup_required' => false, 'procedure_summary' => 'Cleaning',
            'procedures' => [['service_ref' => 'svc1', 'quantity' => 1]]], ['Idempotency-Key' => 'doc-0'])->assertOk();

        return $t->fresh();
    }

    public function test_two_complete_commands_complete_once_with_one_history_row_and_one_audit_event(): void
    {
        $t = $this->documented();
        $path = "/api/treatments/{$t->public_id}/complete";
        $results = $this->raceCommands([[$path, ['expected_revision' => 2], 'c-1'], [$path, ['expected_revision' => 2], 'c-2']]);
        $this->assertSame([200, 200], array_column($results, 'status'), json_encode($results));
        $this->assertSame(['Completed', 3], [$t->fresh()->status, $t->fresh()->revision]);
        $this->assertSame(1, \App\Models\TreatmentHistory::where('treatment_id', $t->id)->where('event', 'treatment.completed')->count());
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'treatment.completed')->count());
        $this->assertSame('Completed', $t->visit->fresh()->status);
    }

    public function test_a_documentation_save_racing_completion_has_exactly_one_consistent_winner(): void
    {
        $t = $this->documented();
        $body = ['expected_revision' => 2, 'prescription_required' => false, 'followup_required' => false, 'procedure_summary' => 'Rewritten after completion?', 'procedures' => [['service_ref' => 'svc1', 'quantity' => 3]]];
        $results = $this->raceCommands([["/api/treatments/{$t->public_id}/complete", ['expected_revision' => 2], 'r-complete'], ["/api/treatments/{$t->public_id}/document", $body, 'r-doc']]);
        $fresh = $t->fresh();
        $statuses = array_column($results, 'status');
        sort($statuses);
        $lines = TreatmentProcedure::where('treatment_id', $t->id)->get();
        if ($fresh->status === 'Completed') {
            // Completion won: the save was refused as stale (its revision is gone) and nothing it carried reached the closed record.
            $this->assertSame([200, 409], $statuses, json_encode($results));
            $this->assertSame(['Cleaning', 1], [$fresh->procedure_summary, $lines->sole()->quantity]);
        } else {
            // The save won: completion saw a changed revision and was refused as stale; the Treatment stays open and consistent.
            $this->assertSame([200, 409], $statuses, json_encode($results));
            $this->assertSame(['In Treatment', 'Rewritten after completion?', 3], [$fresh->status, $fresh->procedure_summary, $lines->sole()->quantity]);
            $this->assertSame('In Treatment', $t->visit->fresh()->status);
        }
        $this->assertSame($fresh->revision, \App\Models\TreatmentHistory::where('treatment_id', $t->id)->max('revision'));
    }

    public function test_another_dentist_cannot_complete_or_document_a_treatment_they_do_not_own_even_when_racing(): void
    {
        $t = $this->documented();
        $results = $this->raceCommands([["/api/treatments/{$t->public_id}/complete", ['expected_revision' => 2], 'o-1', 'dentist2'], ["/api/treatments/{$t->public_id}/complete", ['expected_revision' => 2], 'o-2', 'dentist1']]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 403], $statuses, json_encode($results));
        $this->assertSame('Completed', $t->fresh()->status);
    }
}
