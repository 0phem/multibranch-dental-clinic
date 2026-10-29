<?php

namespace Tests\Feature\Inquiries;

use App\Models\Inquiry;
use App\Models\InquiryHistory;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Real PHP processes (separate PostgreSQL connections, real commits) race M16 commands. Rebuilds the dedicated test database before
// and after itself (never the dev database).
class ConcurrentInquiryTest extends TestCase
{
    use SchedulingFixture;

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

    /** @param list<array{0:string,1:array,2:string}> $requests [path, body, key] */
    private function race(array $requests, string $who = 'staffB1'): array
    {
        $token = $this->u[$who]->createToken('concurrency-test')->plainTextToken;
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($requests as [$path, $body, $key]) {
            $process = proc_open([PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, $path, json_encode($body), (string) $startAt, json_encode(['Idempotency-Key' => $key])],
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

    private function inquiry(): Inquiry
    {
        return Inquiry::create(['source' => 'Facebook', 'capture_method' => 'staff_manual', 'contact_name' => 'Maria', 'topic' => 'Braces', 'branch_id' => $this->b['b1']->id,
            'assigned_user_id' => $this->u['staffB1']->id, 'created_by_user_id' => $this->u['staffB1']->id, 'status' => 'Open', 'revision' => 1, 'received_at' => now()]);
    }

    public function test_two_conversions_to_different_appointments_link_exactly_one(): void
    {
        $inquiry = $this->inquiry();
        $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-10-30', '09:00');
        $b = $this->existing('B', 'd1', 'b1', 'svc1', '2026-10-30', '10:00');
        $results = $this->race([["/api/inquiries/{$inquiry->public_id}/convert", ['expected_revision' => 1, 'appointment_id' => $a->public_id], 'c-a'], ["/api/inquiries/{$inquiry->public_id}/convert", ['expected_revision' => 1, 'appointment_id' => $b->public_id], 'c-b']]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 422], $statuses, json_encode($results));
        $fresh = $inquiry->fresh();
        $this->assertSame(['Converted', 2], [$fresh->status, $fresh->revision]);
        $this->assertContains($fresh->appointment_id, [$a->id, $b->id]);
        $this->assertSame($fresh->appointment_id === $a->id ? $this->p['A']->id : $this->p['B']->id, $fresh->patient_id, 'the Patient is always the linked appointment’s Patient');
        $this->assertSame(1, InquiryHistory::where('inquiry_id', $inquiry->id)->where('event', 'inquiry.linked_to_appointment')->count());
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'inquiry.linked_to_patient')->count());
    }

    public function test_respond_racing_close_ends_in_one_consistent_final_state_with_matching_history(): void
    {
        $inquiry = $this->inquiry();
        $results = $this->race([["/api/inquiries/{$inquiry->public_id}/respond", ['expected_revision' => 1], 'r-1'], ["/api/inquiries/{$inquiry->public_id}/close", ['expected_revision' => 1], 'r-2']]);
        $fresh = $inquiry->fresh();
        $events = InquiryHistory::where('inquiry_id', $inquiry->id)->orderBy('id')->pluck('event')->all();
        $statuses = array_column($results, 'status');
        sort($statuses);
        if ($fresh->status === 'Closed') {
            // close won; respond then saw a final inquiry (422) or ran first (200) and close followed on a stale revision.
            $this->assertContains($statuses, [[200, 422], [200, 409], [200, 200]], json_encode($results));
            $this->assertSame('inquiry.closed', end($events));
        } else {
            $this->assertSame('Responded', $fresh->status);
            $this->assertSame([200, 409], $statuses, json_encode($results));
            $this->assertSame(['inquiry.responded'], $events);
        }
        $this->assertSame($fresh->revision - 1, count($events), 'one history row per committed transition');
    }

    public function test_a_double_submitted_capture_with_one_key_makes_one_inquiry(): void
    {
        $body = ['branch_ref' => 'b1', 'source' => 'Facebook', 'name' => 'Maria Santos', 'contact' => '@m', 'topic' => 'Braces'];
        $results = $this->race([['/api/inquiries', $body, 'same'], ['/api/inquiries', $body, 'same']]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertContains($statuses, [[201, 201], [201, 409]], json_encode($results));
        $this->assertSame(1, Inquiry::count());
    }
}
