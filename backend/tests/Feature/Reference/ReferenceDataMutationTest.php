<?php

namespace Tests\Feature\Reference;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\BranchService;
use App\Models\DentistProfile;
use App\Models\Person;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Phase 2A: uniqueness/FK/validation behavior, and the dentist branch_ids replace-set contract
// (plan section H/L/N).
class ReferenceDataMutationTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create([
            'person_id' => Person::factory()->create()->id,
            'role' => Role::Owner,
            'password' => Hash::make('Passw0rd!'),
        ]);
    }

    private function branch(string $ref): Branch
    {
        return Branch::create([
            'legacy_ref' => $ref, 'branch_code' => 'BRC-'.strtoupper($ref), 'name' => 'Branch '.strtoupper($ref),
            'city' => 'Bocaue', 'address' => '1 St', 'open_time' => '09:00', 'close_time' => '18:00',
            'status' => 'Open', 'capacity_threshold' => 80,
        ]);
    }

    private function service(string $ref): Service
    {
        return Service::create([
            'legacy_ref' => $ref, 'code' => strtoupper($ref), 'name' => 'Service '.$ref,
            'duration_minutes' => 30, 'reference_fee_php' => 600, 'category' => 'General Dentistry', 'status' => 'Active',
        ]);
    }

    public function test_branch_update_rejects_impossible_hours(): void
    {
        $this->branch('b1');
        Sanctum::actingAs($this->owner());

        $this->patchJson('/api/branches/b1', ['open_time' => '18:00', 'close_time' => '09:00'])
            ->assertStatus(422);
    }

    public function test_every_owner_branch_status_persists_and_round_trips_exactly(): void
    {
        $branch = $this->branch('b1');
        Sanctum::actingAs($this->owner());

        foreach (['Temporarily Closed', 'Inactive', 'Open'] as $status) {
            $this->patchJson('/api/branches/b1', ['status' => $status])
                ->assertOk()->assertJsonPath('data.status', $status);
            $this->assertSame($status, $branch->fresh()->status);
            $this->getJson('/api/branches')->assertOk()->assertJsonPath('data.0.status', $status);
        }
    }

    public function test_branch_status_rejects_unknown_values_and_the_noncanonical_closed_alias(): void
    {
        $branch = $this->branch('b1');
        Sanctum::actingAs($this->owner());

        foreach (['Invented Status', 'Closed'] as $status) {
            $this->patchJson('/api/branches/b1', ['status' => $status])
                ->assertUnprocessable()->assertJsonValidationErrors('status');
            $this->assertSame('Open', $branch->fresh()->status);
        }
    }

    public function test_duplicate_branch_service_pair_is_rejected_at_db_level(): void
    {
        $branch = $this->branch('b1');
        $service = $this->service('svc1');
        BranchService::create(['branch_id' => $branch->id, 'service_id' => $service->id, 'active' => true]);

        $this->expectException(\Illuminate\Database\QueryException::class);
        BranchService::create(['branch_id' => $branch->id, 'service_id' => $service->id, 'active' => false]);
    }

    public function test_branch_delete_is_restricted_while_an_active_branch_service_exists(): void
    {
        $branch = $this->branch('b1');
        $service = $this->service('svc1');
        BranchService::create(['branch_id' => $branch->id, 'service_id' => $service->id, 'active' => true]);

        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('branches')->where('id', $branch->id)->delete();
    }

    public function test_dentist_branch_ids_replace_set_fully_swaps_assignment(): void
    {
        $b1 = $this->branch('b1');
        $b2 = $this->branch('b2');
        $b3 = $this->branch('b3');

        $person = Person::factory()->create();
        $dentist = DentistProfile::create([
            'legacy_ref' => 'd5', 'person_id' => $person->id, 'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true,
        ]);
        $dentist->branches()->attach([$b1->id]);

        Sanctum::actingAs($this->owner());

        $response = $this->patchJson('/api/dentists/d5', ['specialty' => 'Orthodontics', 'branch_ids' => ['b2', 'b3']])->assertOk();

        $this->assertSame('Orthodontics', $dentist->fresh()->specialty);
        $response->assertJsonPath('data.specialty', 'Orthodontics');
        $this->assertSame(['b2', 'b3'], $response->json('data.branch_ids'));
        $this->assertDatabaseMissing('dentist_branches', ['dentist_profile_id' => $dentist->id, 'branch_id' => $b1->id]);
        $this->assertDatabaseHas('dentist_branches', ['dentist_profile_id' => $dentist->id, 'branch_id' => $b2->id]);
        $this->assertDatabaseHas('dentist_branches', ['dentist_profile_id' => $dentist->id, 'branch_id' => $b3->id]);
    }

    public function test_dentist_update_rolls_back_profile_and_assignments_when_branch_sync_fails(): void
    {
        $b1 = $this->branch('b1');
        $this->branch('b2');
        $dentist = DentistProfile::create([
            'legacy_ref' => 'd1', 'person_id' => Person::factory()->create()->id,
            'specialty' => 'General Dentistry', 'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true,
        ]);
        $dentist->branches()->attach($b1->id);
        Sanctum::actingAs($this->owner());

        // Unknown refs fail FormRequest validation before mutation. Instead, induce a controlled
        // failure after sync has actually deleted the old assignment in PostgreSQL. No validation or
        // controller mocking: both writes execute through the real authenticated HTTP path.
        $connection = DB::connection();
        $this->assertSame('pgsql', $connection->getDriverName());
        $dispatcher = $connection->getEventDispatcher();
        $connection->setEventDispatcher(clone $dispatcher);
        $observed = null;
        $connection->listen(function (QueryExecuted $query) use ($dentist, &$observed): void {
            if (str_starts_with($query->sql, 'delete from "dentist_branches"')) {
                $observed = [$dentist->fresh()->specialty, $dentist->branches()->count()];
                throw new \RuntimeException('Controlled branch synchronization failure');
            }
        });

        try {
            $this->patchJson('/api/dentists/d1', [
                'specialty' => 'Orthodontics', 'branch_ids' => ['b2'],
            ])->assertStatus(500);
        } finally {
            $connection->setEventDispatcher($dispatcher);
        }

        $this->assertSame(['Orthodontics', 0], $observed, 'Failure must occur after both writes began');
        $this->assertSame('General Dentistry', $dentist->fresh()->specialty);
        $this->assertSame(['b1'], $dentist->fresh()->branches()->pluck('legacy_ref')->all());
    }

    public function test_dentist_update_without_branch_ids_preserves_assignments(): void
    {
        $branch = $this->branch('b1');
        $dentist = DentistProfile::create([
            'legacy_ref' => 'd1', 'person_id' => Person::factory()->create()->id,
            'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true,
        ]);
        $dentist->branches()->attach($branch->id);
        Sanctum::actingAs($this->owner());

        $this->patchJson('/api/dentists/d1', ['specialty' => 'Orthodontics'])
            ->assertOk()->assertJsonPath('data.branch_ids', ['b1']);
        $this->assertSame('Orthodontics', $dentist->fresh()->specialty);
        $this->assertSame(['b1'], $dentist->fresh()->branches()->pluck('legacy_ref')->all());
    }

    public function test_license_no_unique_when_present_but_multiple_nulls_allowed(): void
    {
        $p1 = Person::factory()->create();
        $p2 = Person::factory()->create();

        DentistProfile::create(['legacy_ref' => 'd1', 'person_id' => $p1->id, 'license_no' => null, 'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true]);
        // A second NULL license_no must not collide — Postgres treats multiple NULLs as non-conflicting.
        DentistProfile::create(['legacy_ref' => 'd2', 'person_id' => $p2->id, 'license_no' => null, 'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true]);

        $this->assertSame(2, DentistProfile::whereNull('license_no')->count());

        $p3 = Person::factory()->create();
        DentistProfile::create(['legacy_ref' => 'd3', 'person_id' => $p3->id, 'license_no' => 'PRC-D-9999', 'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true]);

        $this->expectException(\Illuminate\Database\QueryException::class);
        $p4 = Person::factory()->create();
        DentistProfile::create(['legacy_ref' => 'd4', 'person_id' => $p4->id, 'license_no' => 'PRC-D-9999', 'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true]);
    }
}
