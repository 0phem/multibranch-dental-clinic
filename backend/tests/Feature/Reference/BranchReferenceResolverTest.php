<?php

namespace Tests\Feature\Reference;

use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Branch::fromPublicReference is a read-only lookup used by request validation (M21 keeps its own equivalent). It adds no write
// path and widens no access: it only turns an M2 public reference into a row, and refuses everything else.
class BranchReferenceResolverTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    public function test_it_resolves_a_public_ulid_in_any_case_and_a_legacy_reference(): void
    {
        $b1 = $this->b['b1'];
        $this->assertSame($b1->id, Branch::fromPublicReference($b1->public_id)->id);
        $this->assertSame($b1->id, Branch::fromPublicReference(strtoupper($b1->public_id))->id);
        $this->assertSame($b1->id, Branch::fromPublicReference('b1')->id);
        $this->assertSame($this->b['b2']->id, Branch::fromPublicReference('b2')->id);
    }

    public function test_it_refuses_the_internal_id_unknown_values_other_ulids_and_wrong_case_legacy_refs(): void
    {
        foreach ([(string) $this->b['b1']->id, '0', '', ' ', 'b9', 'B1', 'b1 ', '01ARZ3NDEKTSV4RRFFQ69G5FAV', 'BRC-B1', 'Branch B1'] as $bad) {
            $this->assertNull(Branch::fromPublicReference($bad), var_export($bad, true));
        }
    }

    public function test_it_is_unambiguous_and_never_returns_more_than_one_branch(): void
    {
        // legacy_ref is unique at the database level, and a ULID can only match the public_id column.
        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->branch('b1');
    }

    public function test_a_legacy_ref_that_looks_like_another_branchs_id_does_not_resolve_that_branch(): void
    {
        $this->assertNull(Branch::fromPublicReference((string) $this->b['b2']->id));
        $this->assertSame('b1', Branch::fromPublicReference('b1')->legacy_ref);
    }

    public function test_it_does_not_change_the_existing_route_binding_or_write_authority(): void
    {
        $this->actingAsUser('owner');
        $this->getJson('/api/branches')->assertOk();
        $this->patchJson('/api/branches/b1', ['status' => 'Open'])->assertStatus(200);
        $this->actingAsUser('staffB1');
        $this->patchJson('/api/branches/b1', ['status' => 'Open'])->assertStatus(403);
        $this->actingAsUser('owner');
        $this->patchJson('/api/branches/'.$this->b['b1']->id, ['status' => 'Open'])->assertStatus(404);
    }
}
