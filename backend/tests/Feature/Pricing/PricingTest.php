<?php

namespace Tests\Feature\Pricing;

use App\Models\ServicePrice;
use App\Services\Pricing\PriceResolver;
use App\Services\Pricing\PriceUnavailable;
use App\Services\Pricing\ResolvedPrice;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// M13 pricing foundation. Clinic clock frozen at 2026-09-28 10:00 Asia/Manila (SchedulingFixture): b1 offers svc1+svc2,
// b2 offers svc1; every fixture Service carries reference_fee_php = 600 (reference/demo data, never a price).
class PricingTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private int $keys = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    private function price(array $body, string $service = 'svc1', ?string $key = null)
    {
        return $this->postJson("/api/services/{$service}/prices", $body + ['kind' => 'priced', 'effective_from' => '2026-09-28'], ['Idempotency-Key' => $key ?? 'pk-'.(++$this->keys)]);
    }

    private function retract(string $id, ?string $key = null)
    {
        return $this->postJson("/api/service-prices/{$id}/retract", [], ['Idempotency-Key' => $key ?? 'rk-'.(++$this->keys)]);
    }

    private function resolveApi(string $branch = 'b1', string $service = 'svc1', ?string $date = null)
    {
        return $this->getJson('/api/prices/resolve?service_ref='.$service.'&branch_ref='.$branch.($date ? '&date='.$date : ''));
    }

    private function resolve(string $branch, string $service, string $date): ResolvedPrice|PriceUnavailable
    {
        return app(PriceResolver::class)->resolve($this->svc[$service], $this->b[$branch], $date);
    }

    /** Arrange a version directly (bypassing the "not in the past" command rule) to build price history. */
    private function version(string $service, ?string $branch, string $from, ?string $amount, string $kind = 'priced'): ServicePrice
    {
        return ServicePrice::create([
            'service_id' => $this->svc[$service]->id, 'branch_id' => $branch ? $this->b[$branch]->id : null, 'kind' => $kind,
            'amount' => $amount, 'effective_from' => $from, 'source' => 'owner_confirmed',
            'created_by_user_id' => $this->u['owner']->id, 'created_at' => now(),
        ]);
    }

    // ---- CREATE ------------------------------------------------------------------------------------------------------

    public function test_the_owner_creates_base_and_branch_versions_with_exact_decimal_amounts(): void
    {
        $this->actingAsUser('owner');
        $base = $this->price(['amount' => '1234.56'])->assertCreated()
            ->assertJsonPath('data.amount', '1234.56')->assertJsonPath('data.level', 'base')->assertJsonPath('data.branch', null)
            ->assertJsonPath('data.source', 'owner_confirmed')->assertJsonPath('data.effective_from', '2026-09-28')
            ->assertJsonPath('data.service.id', 'svc1')->json('data');
        $this->assertMatchesRegularExpression('/^[0-9a-hjkmnp-tv-z]{26}$/', $base['id']);
        $this->price(['amount' => '1500', 'branch_ref' => 'b1'])->assertCreated()->assertJsonPath('data.level', 'branch')
            ->assertJsonPath('data.branch.id', 'b1')->assertJsonPath('data.amount', '1500.00');

        $this->assertSame('1234.56', DB::table('service_prices')->whereNull('branch_id')->value('amount'));
        $this->assertSame('numeric', DB::selectOne("select data_type from information_schema.columns where table_name='service_prices' and column_name='amount'")->data_type);
        $json = json_encode($this->getJson('/api/service-prices')->assertOk()->json());
        foreach (['"service_id"', '"branch_id"', '"created_by_user_id"', '"retracted_by_user_id"'] as $internal) {
            $this->assertStringNotContainsString($internal, $json);
        }
    }

    public function test_invalid_amounts_dates_sources_and_branches_are_refused(): void
    {
        $this->actingAsUser('owner');
        foreach (['0', '0.00', '-5', '12.345', 'abc', '1e3', '0x10', '1,500', ''] as $bad) {
            $this->price(['amount' => $bad])->assertStatus(422)->assertJsonValidationErrors('amount');
        }
        $this->price(['amount' => 1500])->assertStatus(422)->assertJsonValidationErrors('amount');    // a JSON number is not decimal text
        $this->price(['amount' => '100', 'effective_from' => '2026-09-27'])->assertStatus(422)->assertJsonPath('code', 'effective_from_past');
        $this->price(['amount' => '100', 'source' => 'demo_seed'])->assertStatus(422)->assertJsonValidationErrors('source');
        $this->price(['amount' => '100', 'created_by_user_id' => 1])->assertStatus(422)->assertJsonValidationErrors('created_by_user_id');
        $this->price(['amount' => '100', 'branch_ref' => 'b2'], 'svc2')->assertStatus(422)->assertJsonPath('code', 'branch_service_missing');
        $this->price(['kind' => 'ended', 'amount' => '100'])->assertStatus(422)->assertJsonValidationErrors('amount');
        $this->price([], 'svc1', '')->assertStatus(422);
        $this->assertSame(0, ServicePrice::count());
        // The database rejects what the API would anyway.
        foreach ([['amount' => '0.00'], ['amount' => null], ['kind' => 'ended', 'amount' => '5.00'], ['source' => 'demo_seed'], ['kind' => 'other']] as $row) {
            try {
                DB::transaction(fn () => ServicePrice::create($row + ['service_id' => $this->svc['svc1']->id, 'kind' => 'priced', 'amount' => '5.00',
                    'effective_from' => '2026-10-01', 'source' => 'owner_confirmed', 'created_by_user_id' => $this->u['owner']->id, 'created_at' => now()]));
                $this->fail('expected the database to reject '.json_encode($row));
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        }
    }

    // ---- REFERENCE FIREWALL ------------------------------------------------------------------------------------------

    public function test_the_reference_fee_is_never_an_authoritative_price(): void
    {
        $this->assertSame('600.00', (string) $this->svc['svc1']->fresh()->reference_fee_php);
        $this->assertSame(0, ServicePrice::count(), 'the migration creates no price, and nothing is copied from reference_fee_php');
        $this->assertInstanceOf(PriceUnavailable::class, $this->resolve('b1', 'svc1', '2026-09-28'));
        $this->actingAsUser('owner');
        $this->resolveApi()->assertOk()->assertJsonPath('data.available', false)->assertJsonPath('data.reason', 'price_unavailable')
            ->assertJsonMissingPath('data.amount');
        $source = file_get_contents(app_path('Services/Pricing/PriceResolver.php')).file_get_contents(app_path('Services/Pricing/PricingService.php'));
        $this->assertStringNotContainsString('reference_fee', preg_replace('#//.*#', '', $source), 'no pricing code reads the reference fee');
    }

    // ---- RESOLUTION --------------------------------------------------------------------------------------------------

    public function test_resolution_order_effective_dates_and_levels(): void
    {
        $this->version('svc1', null, '2026-09-01', '500.00');
        $this->version('svc1', null, '2026-10-01', '700.00');                 // future base change
        $this->version('svc1', 'b1', '2026-09-15', '650.00');                 // branch override
        $this->version('svc1', 'b1', '2026-09-20', null, 'ended');            // branch override ended -> base

        $this->assertSame('500.00', $this->resolve('b1', 'svc1', '2026-09-10')->amount());         // base (before override)
        $at16 = $this->resolve('b1', 'svc1', '2026-09-16');
        $this->assertSame(['650.00', 'branch'], [$at16->amount(), $at16->level()]);                    // branch beats base
        $this->assertSame(['500.00', 'base'], [$this->resolve('b1', 'svc1', '2026-09-28')->amount(), $this->resolve('b1', 'svc1', '2026-09-28')->level()]); // branch ended
        $this->assertSame('500.00', $this->resolve('b2', 'svc1', '2026-09-16')->amount());        // another branch gets the base
        $this->assertSame('500.00', $this->resolve('b1', 'svc1', '2026-09-30')->amount());        // future not used early
        $this->assertSame('700.00', $this->resolve('b1', 'svc1', '2026-10-01')->amount());        // applies on its date
        $this->assertInstanceOf(PriceUnavailable::class, $this->resolve('b1', 'svc1', '2026-08-31'));

        // Base ended -> unavailable unless a branch price applies first.
        $this->version('svc2', null, '2026-09-01', '1200.00');
        $this->version('svc2', null, '2026-09-10', null, 'ended');
        $this->version('svc2', 'b1', '2026-09-12', '1100.00');
        $this->assertInstanceOf(PriceUnavailable::class, $this->resolve('b1', 'svc2', '2026-09-11'));
        $this->assertSame('1100.00', $this->resolve('b1', 'svc2', '2026-09-12')->amount());
        $this->assertSame('1200.00', $this->resolve('b1', 'svc2', '2026-09-05')->amount(), 'an old date resolves its old version');

        // Retracted versions are ignored.
        $retracted = $this->version('svc1', null, '2026-09-25', '999.00');
        DB::table('service_prices')->where('id', $retracted->id)->update(['retracted_at' => now(), 'retracted_by_user_id' => $this->u['owner']->id]);
        $this->assertSame('500.00', $this->resolve('b2', 'svc1', '2026-09-26')->amount());

        $contract = $this->resolve('b1', 'svc1', '2026-10-01')->toArray();
        $this->assertSame(['available', 'price_public_id', 'level', 'service', 'branch', 'date', 'effective_from', 'amount', 'source'], array_keys($contract));
        $this->assertSame(['700.00', 'base', 'owner_confirmed', ['id' => 'svc1', 'code' => 'SVC1', 'name' => 'Service svc1']],
            [$contract['amount'], $contract['level'], $contract['source'], $contract['service']]);
        $this->assertIsString($contract['amount']);
    }

    // ---- VERSIONING --------------------------------------------------------------------------------------------------

    public function test_versions_are_append_only_and_only_future_versions_may_be_retracted_once(): void
    {
        $this->actingAsUser('owner');
        $current = $this->price(['amount' => '800.00'])->assertCreated()->json('data.id');
        $future = $this->price(['amount' => '900.00', 'effective_from' => '2026-10-15'])->assertCreated()->json('data.id');
        $this->price(['amount' => '950.00', 'effective_from' => '2026-10-15'])->assertStatus(409)->assertJsonPath('code', 'price_version_exists');
        $this->price(['amount' => '850.00', 'effective_from' => '2026-10-15', 'branch_ref' => 'b1'])->assertCreated();   // base + branch coexist

        $this->retract($current)->assertStatus(422)->assertJsonPath('code', 'price_effective');
        $this->retract($future, 'r1')->assertOk()->assertJsonPath('data.retracted_by.name', $this->u['owner']->person->fullName());
        $this->retract($future, 'r1')->assertOk()->assertHeader('Idempotent-Replayed', 'true');
        $this->retract($future)->assertStatus(409)->assertJsonPath('code', 'price_already_retracted');
        // The retracted row is kept (auditable), and its date is free again.
        $this->assertNotNull(ServicePrice::where('public_id', $future)->value('retracted_at'));
        $this->price(['amount' => '950.00', 'effective_from' => '2026-10-15'])->assertCreated();

        // The database keeps effective rows immutable: no amount/date change, no second update, no delete.
        $row = ServicePrice::where('public_id', $current)->sole();
        foreach ([['amount' => '1.00'], ['effective_from' => '2026-12-01'], ['source' => 'owner_confirmed', 'kind' => 'ended', 'amount' => null]] as $change) {
            try {
                DB::transaction(fn () => DB::table('service_prices')->where('id', $row->id)->update($change));
                $this->fail('expected the append-only trigger to reject '.json_encode($change));
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        }
        foreach ([fn () => DB::table('service_prices')->where('public_id', $future)->update(['retracted_at' => now()]), fn () => DB::table('service_prices')->delete()] as $write) {
            try {
                DB::transaction($write);
                $this->fail('expected a second update / delete to be rejected');
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        }
        $this->assertSame('800.00', ServicePrice::where('public_id', $current)->value('amount'));
    }

    // ---- AUTHORIZATION -----------------------------------------------------------------------------------------------

    public function test_access_by_role(): void
    {
        $this->getJson('/api/service-prices')->assertUnauthorized();
        $this->resolveApi()->assertUnauthorized();
        $this->version('svc1', null, '2026-09-01', '500.00');
        $this->version('svc1', null, '2026-10-01', '700.00');
        $id = ServicePrice::orderByDesc('id')->value('public_id');

        $this->actingAsUser('owner');
        $this->getJson('/api/services/svc1/prices')->assertOk()->assertJsonCount(2, 'data');
        $this->resolveApi('b2', 'svc1', '2026-10-02')->assertOk()->assertJsonPath('data.amount', '700.00');   // arbitrary date

        $this->actingAsUser('staffB1');
        $this->resolveApi('b1')->assertOk()->assertJsonPath('data.amount', '500.00')->assertJsonPath('data.date', '2026-09-28');
        $this->resolveApi('b1', 'svc1', '2026-09-28')->assertOk();
        $this->resolveApi('b1', 'svc1', '2026-10-02')->assertForbidden()->assertJsonPath('code', 'date_not_allowed');
        $this->resolveApi('b1', 'svc1', '2026-09-02')->assertForbidden();
        $this->resolveApi('b2')->assertForbidden();                                                      // other branch
        $this->getJson('/api/service-prices')->assertForbidden();
        $this->getJson('/api/services/svc1/prices')->assertForbidden();
        $this->price(['amount' => '1.00'])->assertForbidden();
        $this->retract($id)->assertForbidden();

        foreach (['dentist1', 'patientA'] as $who) {
            $this->actingAsUser($who);
            $this->resolveApi('b1')->assertForbidden();
            $this->getJson('/api/service-prices')->assertForbidden();
            $this->price(['amount' => '1.00'])->assertForbidden();
            $this->retract($id)->assertForbidden();
        }
        $this->assertSame(2, ServicePrice::count());
    }

    // ---- IDEMPOTENCY -------------------------------------------------------------------------------------------------

    public function test_create_replays_and_refuses_a_reused_key_for_another_request(): void
    {
        $this->actingAsUser('owner');
        $first = $this->price(['amount' => '1500.00'], 'svc1', 'same')->assertCreated()->json('data.id');
        $this->price(['amount' => '1500.00'], 'svc1', 'same')->assertCreated()->assertHeader('Idempotent-Replayed', 'true')->assertJsonPath('data.id', $first);
        $this->price(['amount' => '1600.00'], 'svc1', 'same')->assertStatus(422)->assertJsonPath('code', 'idempotency_key_reused');
        $this->assertSame(1, ServicePrice::count());
    }

    public function test_money_has_no_floating_point_drift(): void
    {
        $this->actingAsUser('owner');
        $this->price(['amount' => '0.10'])->assertCreated();
        $this->price(['amount' => '0.20', 'branch_ref' => 'b1'])->assertCreated();
        $sum = DB::selectOne('select sum(amount)::text as total from service_prices')->total;
        $this->assertSame('0.30', $sum);
        $this->assertSame('9999999999.99', $this->price(['amount' => '9999999999.99', 'effective_from' => '2026-12-01'])->assertCreated()->json('data.amount'));
        $this->assertTrue(Schema::hasTable('service_prices'));
    }

    // ---- M13 production hardening ---------------------------------------------------------------------------------------

    public function test_business_dates_follow_asia_manila_not_utc_around_midnight(): void
    {
        // 2026-09-28 16:30 UTC is already 2026-09-29 00:30 in Manila: "today" is the 29th.
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-09-28 16:30:00', 'UTC'));
        $this->actingAsUser('owner');
        $this->price(['amount' => '500.00', 'effective_from' => '2026-09-28'])->assertStatus(422)->assertJsonPath('code', 'effective_from_past');
        $id = $this->price(['amount' => '500.00', 'effective_from' => '2026-09-29'])->assertCreated()->json('data.id');
        $this->assertSame('2026-09-29', $this->resolveApi('b1')->assertOk()->json('data.date'), 'the default resolve date is the Manila date');
        $this->assertSame('500.00', $this->resolveApi('b1', 'svc1', '2026-09-29')->json('data.amount'), 'effective exactly on its date');
        $this->assertSame(false, $this->resolveApi('b1', 'svc1', '2026-09-28')->json('data.available'), 'the day before is unavailable');
        // A version starting today (Manila) is already in effect and cannot be retracted, even though UTC says it is still the 28th.
        $this->retract($id)->assertStatus(422)->assertJsonPath('code', 'price_effective');
        $this->actingAsUser('staffB1');
        $this->resolveApi('b1', 'svc1', '2026-09-28')->assertForbidden();   // Staff see only Manila-today
        $this->resolveApi('b1', 'svc1', '2026-09-29')->assertOk();
    }

    public function test_exact_decimal_amounts_survive_storage_resolution_and_the_api(): void
    {
        $this->actingAsUser('owner');
        foreach (['19.99', '0.29', '999.95', '0.01'] as $i => $amount) {
            $svc = ['svc1', 'svc2'][$i % 2];
            $date = now('Asia/Manila')->addDays($i + 1)->format('Y-m-d');
            $this->assertSame($amount, $this->price(['amount' => $amount, 'effective_from' => $date], $svc)->assertCreated()->json('data.amount'));
            $this->assertSame($amount, $this->resolve('b1', $svc, $date)->amount());
            $this->assertSame($amount, $this->resolveApi('b1', $svc, $date)->json('data.amount'));
        }
        $this->assertSame('39.98', DB::selectOne("select (amount * 2)::text as t from service_prices where amount = 19.99")->t);
        foreach (['19.999', '-1', '1e3', '0x10', '00.50', '', 'abc', '1,000.00'] as $bad) {
            $this->price(['amount' => $bad, 'effective_from' => '2026-12-01'])->assertStatus(422);
        }
        $this->price(['amount' => 19.99, 'effective_from' => '2026-12-01'])->assertStatus(422);      // a JSON number is never accepted as money
    }

    public function test_identity_scope_ownership_and_clock_fields_are_refused_and_ids_resolve_safely(): void
    {
        $this->actingAsUser('owner');
        foreach (['id' => 'x', 'public_id' => '01ARZ3NDEKTSV4RRFFQ69G5FAV', 'service_id' => 1, 'branch_id' => 1, 'created_at' => '2020-01-01T00:00:00Z', 'created_by_user_id' => 1,
            'retracted_at' => '2020-01-01T00:00:00Z', 'retracted_by_user_id' => 1, 'source' => 'owner_confirmed', 'status' => 'Active', 'is_current' => true] as $field => $value) {
            $this->price([$field => $value, 'amount' => '500.00'])->assertStatus(422, "must refuse {$field}");
        }
        $this->assertSame(0, ServicePrice::count());
        // Numeric / malformed / unknown identifiers are 404 or 422, never another record.
        $this->postJson('/api/services/1/prices', ['kind' => 'priced', 'amount' => '5.00', 'effective_from' => '2026-12-01'], ['Idempotency-Key' => 'n-1'])->assertNotFound();
        $this->postJson('/api/services/'.$this->svc['svc1']->id.'/prices', ['kind' => 'priced', 'amount' => '5.00', 'effective_from' => '2026-12-01'], ['Idempotency-Key' => 'n-2'])->assertNotFound();
        foreach (['1', 'not-a-ulid', '01ARZ3NDEKTSV4RRFFQ69G5FAV'] as $bad) {
            $this->retract($bad)->assertNotFound();
        }
        $this->price(['amount' => '5.00', 'branch_ref' => '1'])->assertStatus(422);
        $this->assertSame(0, ServicePrice::count());
    }

    public function test_price_versions_write_minimal_m22_events_and_a_replay_writes_one(): void
    {
        $this->actingAsUser('owner');
        $date = now('Asia/Manila')->addDays(5)->format('Y-m-d');
        $id = $this->price(['amount' => '1500.50', 'branch_ref' => 'b1', 'effective_from' => $date], 'svc1', 'audit-1')->assertCreated()->json('data.id');
        $this->price(['amount' => '1500.50', 'branch_ref' => 'b1', 'effective_from' => $date], 'svc1', 'audit-1')->assertCreated();   // same key replays
        $this->retract($id, 'audit-r')->assertOk();
        $this->retract($id, 'audit-r')->assertOk();
        $events = \App\Models\AuditLog::whereIn('action', ['pricing.price_version_created', 'pricing.price_version_retracted'])->orderBy('id')->get();
        $this->assertSame(['pricing.price_version_created', 'pricing.price_version_retracted'], $events->pluck('action')->all());
        $this->assertSame(['financial', 'owner', $id, $this->b['b1']->id], [$events[0]->category, $events[0]->actor_role, $events[0]->auditable_public_id, $events[0]->branch_id]);
        $this->assertEquals(['service' => 'svc1', 'branch' => 'b1', 'level' => 'branch', 'kind' => 'priced', 'amount' => '1500.50', 'effective_from' => $date], $events[0]->payload);
        $this->assertEqualsCanonicalizing(['service', 'branch', 'effective_from'], array_keys($events[1]->payload));
    }

    public function test_an_audit_failure_rolls_the_price_change_back(): void
    {
        $this->actingAsUser('owner');
        \App\Models\AuditLog::creating(fn () => throw new \RuntimeException('audit down'));
        $this->withoutExceptionHandling();
        try {
            $this->price(['amount' => '500.00', 'effective_from' => '2026-12-01']);
            $this->fail('expected the simulated failure');
        } catch (\RuntimeException) {
        }
        $this->assertSame(0, ServicePrice::count());
        $this->assertSame(0, DB::table('command_keys')->where('command', 'pricing.create')->count());
    }

    public function test_a_historical_date_still_resolves_its_old_version_after_a_newer_one_takes_effect(): void
    {
        $old = $this->version('svc1', null, '2026-09-01', '500.00');
        $this->actingAsUser('owner');
        $this->price(['amount' => '650.00', 'effective_from' => '2026-09-28'])->assertCreated();   // today
        $this->assertSame('650.00', $this->resolve('b1', 'svc1', '2026-09-28')->amount());
        $this->assertSame('500.00', $this->resolve('b1', 'svc1', '2026-09-27')->amount(), 'a date before the change keeps the old price');
        $this->assertSame('500.00', $old->fresh()->amount, 'the old version row is unchanged and still listed');
        $this->assertSame(2, collect($this->getJson('/api/services/svc1/prices')->assertOk()->json('data'))->count());
        try {
            DB::table('service_prices')->where('id', $old->id)->update(['amount' => '1.00']);
            $this->fail('the database must refuse editing a price version');
        } catch (\Illuminate\Database\QueryException) {
            $this->assertTrue(true);
        }
    }

    public function test_changing_branch_availability_writes_one_event_only_when_it_changes(): void
    {
        $this->actingAsUser('owner');
        $body = ['branch_ref' => 'b2', 'service_ref' => 'svc2', 'active' => true];
        $this->postJson('/api/branch-services', $body)->assertOk();
        $this->postJson('/api/branch-services', $body)->assertOk();             // no change
        $this->postJson('/api/branch-services', ['active' => false] + $body)->assertOk();
        $events = \App\Models\AuditLog::where('action', 'service.branch_availability_changed')->orderBy('id')->get();
        $this->assertCount(2, $events);
        $this->assertSame([null, true], [$events[0]->payload['from_active'], $events[0]->payload['to_active']]);
        $this->assertSame([true, false], [$events[1]->payload['from_active'], $events[1]->payload['to_active']]);
        $this->actingAsUser('staffB1');
        $this->postJson('/api/branch-services', $body)->assertForbidden();
    }

    // ---- final gate: paging and retries ---------------------------------------------------------------------------------

    public function test_the_price_version_list_is_cursor_paged_newest_first_without_gaps_or_repeats(): void
    {
        $ids = [];
        foreach (range(1, 5) as $n) {
            $ids[] = $this->version('svc1', $n % 2 ? null : 'b1', "2026-09-0{$n}", "{$n}00.00")->public_id;
        }
        $this->version('svc2', null, '2026-09-01', '1200.00');
        $newest = array_reverse($ids);
        $this->actingAsUser('owner');

        $one = $this->getJson('/api/service-prices?per_page=2&service_ref=svc1')->assertOk();
        $two = $this->getJson('/api/service-prices?per_page=2&service_ref=svc1&cursor='.$one->json('meta.next_cursor'))->assertOk();
        $three = $this->getJson('/api/service-prices?per_page=2&service_ref=svc1&cursor='.$two->json('meta.next_cursor'))->assertOk();
        $this->assertSame($newest, [...array_column($one->json('data'), 'id'), ...array_column($two->json('data'), 'id'), ...array_column($three->json('data'), 'id')]);
        $this->assertSame($newest[1], $one->json('meta.next_cursor'), 'the cursor is a public id');
        $this->assertNull($three->json('meta.next_cursor'));
        $this->assertSame(50, $this->getJson('/api/service-prices')->json('meta.per_page'));
        $this->assertCount(6, $this->getJson('/api/service-prices?per_page=100')->json('data'));
        // a version created while paging neither shifts nor repeats the pages already read
        $late = $this->version('svc1', null, '2026-10-20', '999.00')->public_id;
        $again = $this->getJson('/api/service-prices?per_page=2&service_ref=svc1&cursor='.$one->json('meta.next_cursor'))->assertOk();
        $this->assertSame(array_slice($newest, 2, 2), array_column($again->json('data'), 'id'));
        $this->assertSame($late, $this->getJson('/api/service-prices?per_page=1')->json('data.0.id'));
        // filters only narrow; the per-service history is paged the same way
        $this->assertCount(2, $this->getJson('/api/service-prices?branch_ref=b1&service_ref=svc1')->json('data'));
        $this->assertCount(2, $this->getJson('/api/services/svc1/prices?per_page=2')->json('data'));
        $this->assertNotNull($this->getJson('/api/services/svc1/prices?per_page=2')->json('meta.next_cursor'));
        // malformed input is a validation error; an unknown cursor is an empty page
        foreach (['per_page=0', 'per_page=101', 'per_page=x', 'per_page[]=1', 'cursor=short', 'cursor[]=a', 'service_ref=nope', 'service_ref[]=svc1', 'branch_ref=nope'] as $bad) {
            $this->getJson('/api/service-prices?'.$bad)->assertStatus(422);
        }
        $this->assertSame([], $this->getJson('/api/service-prices?cursor=01ARZ3NDEKTSV4RRFFQ69G5FAV')->assertOk()->json('data'));
        // authorization comes first: other roles never reach the filters or the cursor
        foreach (['staffB1', 'dentist1', 'patientA'] as $who) {
            $this->actingAsUser($who);
            $this->getJson('/api/service-prices?per_page=1&cursor='.$one->json('meta.next_cursor'))->assertForbidden();
            $this->getJson('/api/services/svc1/prices?service_ref=nope')->assertForbidden();
        }
    }

    public function test_a_lost_response_retry_with_the_same_key_replays_and_never_creates_a_second_version(): void
    {
        $this->actingAsUser('owner');
        $date = now('Asia/Manila')->addDays(4)->format('Y-m-d');
        $body = ['amount' => '1500.00', 'effective_from' => $date];
        $first = $this->price($body, 'svc1', 'lost-response-1')->assertCreated();
        $retry = $this->price($body, 'svc1', 'lost-response-1')->assertCreated();   // the client never saw the first response
        $this->assertSame($first->json('data'), $retry->json('data'), 'a stable replay of the same logical result');
        $this->assertSame(1, ServicePrice::count());
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'pricing.price_version_created')->count());
        // The same key for a different request is refused, never silently reused.
        $this->price(['amount' => '1600.00', 'effective_from' => $date], 'svc1', 'lost-response-1')->assertStatus(422)->assertJsonPath('code', 'idempotency_key_reused');
        // A new key for the same level and date is a distinct command: the unique invariant refuses it with a stable 409.
        $this->price($body, 'svc1', 'lost-response-2')->assertStatus(409)->assertJsonPath('code', 'price_version_exists');
        $this->assertSame(1, ServicePrice::count());
        // The key is mandatory.
        $this->postJson('/api/services/svc1/prices', ['kind' => 'priced'] + $body)->assertStatus(422);
    }

    public function test_the_reference_fee_cannot_become_a_price_in_m5_m11_or_any_server_projection(): void
    {
        // M5 owns no money at all.
        foreach (['treatments', 'treatment_procedures'] as $table) {
            foreach (Schema::getColumnListing($table) as $column) {
                $this->assertDoesNotMatchRegularExpression('/price|amount|fee|total|cost/i', $column, "{$table}.{$column}");
            }
        }
        // M11 / the resolver / the pricing service never read the reference column.
        foreach (['Services/Billing/BillingService.php', 'Services/Pricing/PriceResolver.php', 'Services/Pricing/PricingService.php', 'Http/Controllers/PricingController.php', 'Http/Controllers/BillingController.php', 'Http/Resources/InvoiceResource.php'] as $file) {
            $this->assertStringNotContainsString('reference_fee', preg_replace('#//.*#', '', file_get_contents(app_path($file))), $file);
        }
        // With a reference fee present and NO M13 price, M11 refuses; and no Service projection carries a fee to any role.
        $this->assertSame('600.00', (string) $this->svc['svc1']->fresh()->reference_fee_php);
        $this->assertInstanceOf(PriceUnavailable::class, $this->resolve('b1', 'svc1', '2026-09-28'));
        foreach (['owner', 'staffB1', 'dentist1', 'patientA'] as $who) {
            $this->actingAsUser($who);
            $this->assertStringNotContainsString('fee', strtolower(json_encode($this->getJson('/api/services')->assertOk()->json())));
            $this->assertStringNotContainsString('fee', strtolower(json_encode($this->getJson('/api/branch-services')->assertOk()->json())));
        }
    }
}
