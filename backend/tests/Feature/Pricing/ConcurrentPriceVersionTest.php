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
}
