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
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Phase 2A: proves the API Resource shapes match what the plan promised — pricing never claims
// confirmation, no dentist/staff response ever claims account-status authority, license_no is Patient-
// hidden, and branch-service rows expose legacy_ref strings, never internal FKs (plan section F/G/H/N).
class ReferenceDataResourceContractTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(Role $role): User
    {
        return User::factory()->create([
            'person_id' => Person::factory()->create()->id,
            'role' => $role,
            'password' => Hash::make('Passw0rd!'),
        ]);
    }

    public function test_service_resource_never_exposes_a_fee_confirmation_flag(): void
    {
        $service = Service::create([
            'legacy_ref' => 'svc1', 'code' => 'CONSULT', 'name' => 'Dental Consultation',
            'duration_minutes' => 30, 'reference_fee_php' => 600, 'category' => 'General Dentistry', 'status' => 'Active',
        ]);

        Sanctum::actingAs($this->userWithRole(Role::Patient));

        $response = $this->getJson('/api/services');
        $response->assertOk();
        $payload = $response->json('data.0');

        $this->assertSame('svc1', $payload['id']);
        $this->assertEquals(600, $payload['reference_fee_php']);
        $this->assertArrayNotHasKey('fee_is_clinic_confirmed', $payload);
        $this->assertArrayNotHasKey('baseFee', $payload);
    }

    public function test_dentist_resource_never_exposes_account_status_and_hides_license_from_patient(): void
    {
        $person = Person::factory()->create();
        $dentist = DentistProfile::create([
            'legacy_ref' => 'd1', 'legacy_user_ref' => 'u3', 'person_id' => $person->id,
            'license_no' => 'PRC-D-1001', 'specialty' => 'General Dentistry',
            'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true,
        ]);

        Sanctum::actingAs($this->userWithRole(Role::Patient));
        $patientPayload = $this->getJson('/api/dentists')->assertOk()->json('data.0');
        $this->assertArrayNotHasKey('license_no', $patientPayload);
        $this->assertArrayNotHasKey('account_status', $patientPayload);
        $this->assertArrayNotHasKey('accountStatus', $patientPayload);
        $this->assertSame('u3', $patientPayload['userId']);

        Sanctum::actingAs($this->userWithRole(Role::Owner));
        $ownerPayload = $this->getJson('/api/dentists')->assertOk()->json('data.0');
        $this->assertSame('PRC-D-1001', $ownerPayload['license_no']);
        $this->assertArrayNotHasKey('account_status', $ownerPayload);
    }

    public function test_branch_service_resource_exposes_legacy_refs_never_internal_ids(): void
    {
        $branch = Branch::create([
            'legacy_ref' => 'b1', 'branch_code' => 'BRC-A', 'name' => 'Branch A', 'city' => 'Bocaue',
            'address' => '1 St', 'open_time' => '09:00', 'close_time' => '18:00', 'status' => 'Open', 'capacity_threshold' => 80,
        ]);
        $service = Service::create([
            'legacy_ref' => 'svc1', 'code' => 'CONSULT', 'name' => 'Dental Consultation',
            'duration_minutes' => 30, 'reference_fee_php' => 600, 'category' => 'General Dentistry', 'status' => 'Active',
        ]);
        BranchService::create(['branch_id' => $branch->id, 'service_id' => $service->id, 'active' => true]);

        Sanctum::actingAs($this->userWithRole(Role::Patient));
        $payload = $this->getJson('/api/branch-services')->assertOk()->json('data.0');

        $this->assertSame('b1', $payload['branch_ref']);
        $this->assertSame('svc1', $payload['service_ref']);
        $this->assertArrayNotHasKey('branch_id', $payload);
        $this->assertArrayNotHasKey('service_id', $payload);
        $this->assertIsNotInt($payload['branch_ref']);
    }

    public function test_branch_resource_coordinates_stay_null(): void
    {
        Branch::create([
            'legacy_ref' => 'b1', 'branch_code' => 'BRC-A', 'name' => 'Branch A', 'city' => 'Bocaue',
            'address' => '1 St', 'open_time' => '09:00', 'close_time' => '18:00', 'status' => 'Open', 'capacity_threshold' => 80,
        ]);

        Sanctum::actingAs($this->userWithRole(Role::Patient));
        $payload = $this->getJson('/api/branches')->assertOk()->json('data.0');

        $this->assertNull($payload['latitude']);
        $this->assertNull($payload['longitude']);
    }
}
