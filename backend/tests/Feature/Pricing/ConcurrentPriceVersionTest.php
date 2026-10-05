<?php

namespace Tests\Feature\Pricing;

use App\Models\ServicePrice;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Two real PHP processes (separate PostgreSQL connections, real commits) create a base version for the same Service and
// date at the same instant with different keys. The NULL-safe unique index lets exactly one win; the other gets 409.
// Rebuilds the dedicated test database before and after itself (never the dev database).
class ConcurrentPriceVersionTest extends TestCase
{
    use SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('dental_clinic_test', config('database.connections.pgsql.database'), 'refusing to run outside the test database');
        $this->artisan('migrate:fresh')->assertSuccessful();
        $this->setUpSchedulingWorld();
        $this->travelBack(); // the child processes use the real clock
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    private function race(array $bodies, ?string $branch = null): array
    {
        $token = $this->u['owner']->createToken('concurrency-test')->plainTextToken;
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($bodies as $i => $body) {
            $process = proc_open(
                [PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, '/api/services/svc1/prices',
                    json_encode($body + ($branch ? ['branch_ref' => $branch] : [])), (string) $startAt, json_encode(['Idempotency-Key' => "race-{$branch}-{$i}"])],
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

    public function test_two_owners_racing_on_the_same_level_and_date_create_one_version(): void
    {
        $date = now('Asia/Manila')->addDays(3)->format('Y-m-d');
        $base = $this->race([['kind' => 'priced', 'amount' => '1500.00', 'effective_from' => $date], ['kind' => 'priced', 'amount' => '1600.00', 'effective_from' => $date]]);
        $this->assertSame([201, 409], array_column($base, 'status'), json_encode($base));
        $this->assertSame('price_version_exists', $base[1]['body']['code']);

        $branch = $this->race([['kind' => 'priced', 'amount' => '1700.00', 'effective_from' => $date], ['kind' => 'ended', 'effective_from' => $date]], 'b1');
        $this->assertSame([201, 409], array_column($branch, 'status'), json_encode($branch));

        $this->assertSame(1, ServicePrice::whereNull('branch_id')->count(), 'one base version');
        $this->assertSame(1, ServicePrice::whereNotNull('branch_id')->count(), 'one branch version; base and branch coexist');
    }

    /** @param list<array{0:string,1:array,2:string}> $requests [path, body, key] released together */
    private function raceRequests(array $requests): array
    {
        $token = $this->u['owner']->createToken('concurrency-test')->plainTextToken;
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($requests as [$path, $body, $key]) {
            $process = proc_open([PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, $path, json_encode($body), (string) $startAt, json_encode(['Idempotency-Key' => $key])],
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

    public function test_retracting_one_future_version_while_another_is_created_keeps_pricing_unambiguous(): void
    {
        $a = now('Asia/Manila')->addDays(3)->format('Y-m-d');
        $b = now('Asia/Manila')->addDays(6)->format('Y-m-d');
        $existing = ServicePrice::create(['service_id' => $this->svc['svc1']->id, 'branch_id' => null, 'kind' => 'priced', 'amount' => '1500.00', 'effective_from' => $a,
            'source' => 'owner_confirmed', 'created_by_user_id' => $this->u['owner']->id, 'created_at' => now()]);
        $results = $this->raceRequests([
            ["/api/service-prices/{$existing->public_id}/retract", [], 'race-retract'],
            ['/api/services/svc1/prices', ['kind' => 'priced', 'amount' => '1600.00', 'effective_from' => $b], 'race-create-b'],
            ['/api/services/svc1/prices', ['kind' => 'priced', 'amount' => '1700.00', 'effective_from' => $a], 'race-create-a'],
        ]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        // The retraction and the later-dated version always succeed; the same-date create is 201 if it ran after the retraction
        // (the retracted row no longer holds the slot) or 409 if it ran before it.
        $this->assertContains($statuses, [[200, 201, 201], [200, 201, 409]], json_encode($results));
        $live = ServicePrice::whereNull('retracted_at')->whereNull('branch_id')->orderBy('effective_from')->get();
        $this->assertSame($live->pluck('effective_from')->map->format('Y-m-d')->unique()->count(), $live->count(), 'never two live versions on one level and date');
        $this->assertNotNull($existing->fresh()->retracted_at);
        $this->assertSame(1, ServicePrice::where('service_id', $this->svc['svc1']->id)->where('amount', '1600.00')->count());
    }

    public function test_a_double_submitted_create_with_one_key_makes_one_version_and_one_audit_event(): void
    {
        $date = now('Asia/Manila')->addDays(4)->format('Y-m-d');
        $body = ['kind' => 'priced', 'amount' => '1500.00', 'effective_from' => $date];
        $results = $this->raceRequests([['/api/services/svc1/prices', $body, 'same-key'], ['/api/services/svc1/prices', $body, 'same-key']]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertContains($statuses, [[201, 201], [201, 409]], json_encode($results));
        $this->assertSame(1, ServicePrice::count());
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'pricing.price_version_created')->count());
        if ($statuses === [201, 201]) {
            $this->assertSame($results[0]['body']['data']['id'], $results[1]['body']['data']['id'], 'the replay returns the same logical version');
        }
    }
}
