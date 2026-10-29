<?php

namespace Tests\Feature\Reference;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\User;
use App\Models\Service;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OwnerBranchAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    private function branch(string $ref = 'b1', string $code = 'BRC-A'): Branch
    {
        return Branch::create(['legacy_ref' => $ref, 'branch_code' => $code, 'name' => "Synthetic branch $ref",
            'city' => 'Test city', 'address' => 'Synthetic address', 'status' => 'Open',
            'open_time' => '08:00', 'close_time' => '17:00', 'capacity_threshold' => 80]);
    }

    public function test_owner_code_update_round_trips_and_duplicate_is_rejected_server_side(): void
    {
        $first = $this->branch();
        $other = $this->branch('b2', 'BRC-B');
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $this->patchJson('/api/branches/b1', ['branch_code' => 'BRC-C'])->assertOk()->assertJsonPath('data.branch_code', 'BRC-C');
        $this->patchJson('/api/branches/b1', ['branch_code' => 'BRC-C'])->assertOk();
        $this->patchJson('/api/branches/b2', ['branch_code' => 'BRC-C'])->assertUnprocessable()->assertJsonValidationErrors('branch_code');
        $this->assertSame('BRC-C', $first->fresh()->branch_code);
        $this->assertSame('BRC-B', $other->fresh()->branch_code);
        $rows = $this->getJson('/api/branches')->assertOk()->json('data');
        $this->assertSame('BRC-C', collect($rows)->firstWhere('id', 'b1')['branch_code']);
    }

    public function test_database_unique_constraint_also_prevents_duplicate_code(): void
    {
        $this->branch();
        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->branch('b2', 'BRC-A');
    }

    public function test_coordinate_pair_round_trips_and_invalid_partial_pair_does_not_change_location(): void
    {
        $branch = $this->branch();
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        // Synthetic test point, never a claim about a clinic location.
        $this->patchJson('/api/branches/b1', ['latitude' => 14.85, 'longitude' => 120.95])->assertOk()
            ->assertJsonPath('data.latitude', 14.85)->assertJsonPath('data.longitude', 120.95);
        $this->getJson('/api/branches')->assertOk()->assertJsonPath('data.0.latitude', 14.85)->assertJsonPath('data.0.longitude', 120.95);
        $this->patchJson('/api/branches/b1', ['latitude' => 14.8])->assertUnprocessable();
        $this->patchJson('/api/branches/b1', ['latitude' => 91, 'longitude' => 181])->assertUnprocessable();
        $this->assertSame('14.8500000', $branch->fresh()->latitude);
        $this->assertSame('120.9500000', $branch->fresh()->longitude);
    }

    public function test_weekday_closure_persists_without_changing_operational_status_or_other_days(): void
    {
        $branch = $this->branch();
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $hours = ['open' => '08:00', 'close' => '17:00'];
        $this->patchJson('/api/branches/b1', ['weekly_hours' => ['1' => $hours, '2' => $hours]])->assertOk();
        $this->patchJson('/api/branches/b1', ['weekly_hours' => ['2' => $hours]])->assertOk()
            ->assertJsonPath('data.weekly_hours.1', null)->assertJsonPath('data.weekly_hours.2', $hours)->assertJsonPath('data.status', 'Open');
        $this->getJson('/api/branches')->assertOk()->assertJsonPath('data.0.weekly_hours.1', null)->assertJsonPath('data.0.weekly_hours.2', $hours);
        $this->patchJson('/api/branches/b1', ['weekly_hours' => []])->assertUnprocessable();
        $this->assertSame(['2' => $hours], $branch->fresh()->weekly_hours);
        $this->assertSame('Open', $branch->fresh()->status);
    }

    public function test_only_owner_may_change_codes_coordinates_hours_or_branch_services(): void
    {
        $branch = $this->branch();
        $payload = ['branch_code' => 'BRC-C', 'latitude' => 14.85, 'longitude' => 120.95,
            'weekly_hours' => ['2' => ['open' => '08:00', 'close' => '17:00']]];
        $this->patchJson('/api/branches/b1', $payload)->assertUnauthorized();
        foreach ([Role::Patient, Role::Staff, Role::Dentist] as $role) {
            Sanctum::actingAs(User::factory()->role($role)->create());
            $this->patchJson('/api/branches/b1', $payload)->assertForbidden();
            $this->postJson('/api/branch-services', ['branch_ref' => 'b1', 'service_ref' => 'missing', 'active' => true])->assertForbidden();
        }
        $this->assertSame('BRC-A', $branch->fresh()->branch_code);
        $this->assertNull($branch->fresh()->latitude);
    }

    public function test_owner_service_toggle_persists_and_round_trips(): void
    {
        $this->branch();
        Service::create(['legacy_ref' => 'svc1', 'code' => 'TEST1', 'name' => 'Synthetic service', 'duration_minutes' => 30,
            'reference_fee_php' => 100, 'category' => 'Test', 'status' => 'Active']);
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        foreach ([true, false] as $active) {
            $this->postJson('/api/branch-services', ['branch_ref' => 'b1', 'service_ref' => 'svc1', 'active' => $active])->assertOk()->assertJsonPath('data.active', $active);
            $this->getJson('/api/branches/b1/services')->assertOk()->assertJsonPath('data.0.active', $active);
        }
    }
}
