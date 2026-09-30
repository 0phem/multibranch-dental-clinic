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
}
