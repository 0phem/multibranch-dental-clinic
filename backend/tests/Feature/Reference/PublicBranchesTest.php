<?php

namespace Tests\Feature\Reference;

use App\Models\Branch;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The public website's branch list comes from the clinic records (real names), never from the frontend. */
class PublicBranchesTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_public_branch_list_shows_the_real_open_branches_without_signing_in(): void
    {
        $this->seed(DatabaseSeeder::class);
        $rows = $this->getJson('/api/public/branches')->assertOk()->json('data');
        $this->assertSame(['Dr. Dana Roxas Dental Clinic', 'Roxas - Cardinal Dental Center', 'Roxas Dental Clinic Guiguinto'], array_column($rows, 'name'));
        $this->assertSame(['01', '02', '03'], array_column($rows, 'number'));
        $this->assertSame('Unit 20 GD Plaza, Guiguinto, Bulacan', $rows[2]['address']);
        $this->assertEqualsWithDelta(14.800254, $rows[0]['latitude'], 0.000001);
        $this->assertSame(['id', 'number', 'name', 'address', 'city', 'latitude', 'longitude', 'phone', 'email', 'weekly_hours'], array_keys($rows[0]), 'no internal ids');
        // The clinic's real contacts and hours (2026-10-17); branch 3 has no email on file.
        $this->assertSame(['0922 878 7341', '0922 878 7341', '0933 867 8725'], array_column($rows, 'phone'));
        $this->assertSame([null], array_values(array_unique(array_filter(array_column($rows, 'email'), fn ($e) => $e === null), SORT_REGULAR)));
        $this->assertNull($rows[2]['email']);
        $this->assertSame(['open' => '08:00', 'close' => '20:00'], $rows[0]['weekly_hours']['1']);
        $this->assertSame(['open' => '08:00', 'close' => '17:00'], $rows[0]['weekly_hours']['6']);
        $this->assertNull($rows[0]['weekly_hours']['7'], 'Sunday closed');

        Branch::where('legacy_ref', 'b2')->update(['status' => 'Closed', 'name' => 'Renamed by the Owner']);
        $this->assertSame(['Dr. Dana Roxas Dental Clinic', 'Roxas Dental Clinic Guiguinto'], array_column($this->getJson('/api/public/branches')->json('data'), 'name'));
    }

    public function test_the_owner_can_rename_a_branch_and_set_its_email_days_and_map_position(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(\App\Models\User::where('email', 'owner@example.test')->firstOrFail());
        $this->patchJson('/api/branches/b3', ['name' => 'Roxas Dental Clinic Guiguinto', 'address' => 'Unit 20 GD Plaza, Guiguinto, Bulacan', 'email' => 'guiguinto@example.test',
            'latitude' => 14.83, 'longitude' => 120.87, 'operating_days' => [1, 2, 3, 4, 5, 6]])->assertOk()
            ->assertJsonPath('data.email', 'guiguinto@example.test')->assertJsonPath('data.latitude', 14.83)->assertJsonPath('data.operating_days', [1, 2, 3, 4, 5, 6]);
        $this->patchJson('/api/branches/b3', ['name' => 'Roxas Dental Clinic Guiguinto'])->assertOk()->assertJsonPath('data.latitude', 14.83); // other edits keep the position
        $this->patchJson('/api/branches/b3', ['latitude' => 14.83])->assertStatus(422)->assertJsonValidationErrors('longitude');
        $this->patchJson('/api/branches/b3', ['latitude' => 99, 'longitude' => 120.87])->assertStatus(422);
        $this->patchJson('/api/branches/b3', ['email' => 'not-an-email'])->assertStatus(422);
        $this->patchJson('/api/branches/b3', ['latitude' => null, 'longitude' => null])->assertOk()->assertJsonPath('data.latitude', null);
        $this->actingAs(\App\Models\User::where('email', 'patient@example.test')->firstOrFail());
        $this->patchJson('/api/branches/b3', ['name' => 'Hijacked'])->assertForbidden();
    }
}
