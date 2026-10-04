<?php

namespace Tests\Feature\Reference;

use App\Enums\Role;
use App\Models\{AuditLog, Branch, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BranchHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function branch(): Branch
    {
        return Branch::create(['legacy_ref'=>'b1', 'branch_code'=>'BRC-A', 'name'=>'Test clinic',
            'city'=>'Bocaue', 'address'=>'Test address', 'open_time'=>'09:00', 'close_time'=>'18:00']);
    }

    public function test_public_identity_is_stable_and_supports_routes_without_exposing_bigint(): void
    {
        $branch = $this->branch();
        $this->assertTrue(Str::isUlid($branch->public_id));
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $this->patchJson('/api/branches/'.$branch->public_id, ['name'=>'Updated clinic'])
            ->assertOk()->assertJsonPath('data.public_id', $branch->public_id)->assertJsonPath('data.id', 'b1');
        $this->assertSame($branch->public_id, $branch->fresh()->public_id);
        $this->patchJson('/api/branches/'.$branch->id, ['city'=>'Wrong'])->assertNotFound();
        $this->patchJson('/api/branches/'.Str::ulid(), ['city'=>'Wrong'])->assertNotFound();
        $this->patchJson('/api/branches/b1', ['public_id'=>(string) Str::ulid()])->assertUnprocessable();
    }

    public function test_partial_hours_validate_against_the_locked_existing_pair(): void
    {
        $branch = $this->branch();
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $this->patchJson('/api/branches/b1', ['open_time'=>'19:00'])->assertUnprocessable();
        $this->patchJson('/api/branches/b1', ['close_time'=>'08:00'])->assertUnprocessable();
        $this->patchJson('/api/branches/b1', ['close_time'=>'09:00'])->assertUnprocessable();
        $this->assertSame('09:00:00', $branch->fresh()->open_time);
        $this->patchJson('/api/branches/b1', ['open_time'=>'08:00'])->assertOk();
        $this->patchJson('/api/branches/b1', ['close_time'=>'17:00'])->assertOk();
    }

    public function test_branch_changes_are_audited_once_with_public_target(): void
    {
        $branch = $this->branch();
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        foreach ([1,2] as $attempt) $this->patchJson('/api/branches/b1', ['status'=>'Inactive'])->assertOk();
        $event = AuditLog::where('action', 'branch.updated')->sole();
        $this->assertSame($branch->public_id, $event->auditable_public_id);
        $this->assertSame(['fields'=>['status']], $event->payload);
        $this->getJson('/api/branches')->assertOk()->assertJsonPath('data.0.status', 'Inactive');
    }

    public function test_audit_failure_rolls_back_branch_update(): void
    {
        $branch = $this->branch();
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $this->mock(\App\Services\Audit\AuditService::class)->shouldReceive('record')->andThrow(new \RuntimeException('Unavailable'));
        $this->patchJson('/api/branches/b1', ['name'=>'Should roll back'])->assertStatus(500);
        $this->assertSame('Test clinic', $branch->fresh()->name);
    }

    public function test_operating_data_is_not_misrepresented_as_confirmed(): void
    {
        $this->branch();
        foreach (Role::cases() as $role) {
            Sanctum::actingAs(User::factory()->role($role)->create());
            $this->getJson('/api/branches')->assertOk()->assertJsonPath('data.0.operating_data_status', 'unconfirmed');
        }
    }

    public function test_unapproved_coordinates_cannot_be_written_through_branch_update(): void
    {
        $branch = $this->branch();
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $this->patchJson('/api/branches/b1', ['latitude'=>91, 'longitude'=>181])
            ->assertUnprocessable()->assertJsonValidationErrors(['latitude', 'longitude']);
        $this->assertNull($branch->fresh()->latitude);
    }

    public function test_public_identity_is_unique_while_legacy_name_consumers_remain_supported(): void
    {
        $first = $this->branch();
        $second = $first->replicate(['public_id']);
        $second->legacy_ref = 'b2';
        $second->branch_code = 'BRC-B';
        $second->name = 'Another test clinic';
        $second->save();
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $this->patchJson('/api/branches/b2', ['name'=>$first->name])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->assertNotSame($first->public_id, $second->public_id);
        $this->expectException(\Illuminate\Database\QueryException::class);
        $second->forceFill(['public_id'=>$first->public_id])->save();
    }
}
