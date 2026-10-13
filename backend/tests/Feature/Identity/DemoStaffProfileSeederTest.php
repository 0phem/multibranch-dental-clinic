<?php

namespace Tests\Feature\Identity;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoStaffProfileSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Demo data: every demo Staff login opens a workspace, and one works at Branch B (cross-branch messaging demo). Never in production. */
class DemoStaffProfileSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_staff_logins_have_profiles_and_branch_access_including_a_second_branch(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoStaffProfileSeeder::class); // idempotent re-run
        $rows = [];
        foreach (['staff.reception@example.test', 'staff.assistant@example.test', 'staff.branchb@example.test'] as $email) {
            $user = User::where('email', $email)->sole();
            $profiles = \App\Models\StaffProfile::where('person_id', $user->person_id)->with('branch')->get();
            $this->assertCount(1, $profiles, $email);
            $scopes = \App\Models\UserBranchScope::where('user_id', $user->id)->with('branch')->get()->pluck('branch.legacy_ref')->all();
            $rows[$email] = [$profiles[0]->branch->legacy_ref, $scopes];
            \Laravel\Sanctum\Sanctum::actingAs($user);
            $this->getJson('/api/me')->assertOk()->assertJsonPath('data.employee.branch_id', $profiles[0]->branch->legacy_ref);
        }
        $this->assertSame(['staff.reception@example.test' => ['b1', ['b1']], 'staff.assistant@example.test' => ['b1', ['b1']], 'staff.branchb@example.test' => ['b2', ['b2']]], $rows);
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $this->app->instance('env', 'production');
        try {
            (new DemoStaffProfileSeeder())->run(); // direct call: no production confirmation prompt
        } finally {
            $this->app->instance('env', 'testing');
        }
        $this->assertSame(0, User::where('email', 'staff.branchb@example.test')->count());
    }
}
