<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Person;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(Role $role, array $overrides = []): User
    {
        $person = Person::factory()->create();

        return User::factory()->create(array_merge([
            'person_id' => $person->id,
            'role' => $role,
            'password' => Hash::make('Passw0rd!'),
        ], $overrides));
    }

    public static function endpointsByRole(): array
    {
        return [
            'patient endpoint' => ['/api/rbac-demo/patient-only', Role::Patient],
            'staff endpoint' => ['/api/rbac-demo/staff-only', Role::Staff],
            'dentist endpoint' => ['/api/rbac-demo/dentist-only', Role::Dentist],
            'owner endpoint' => ['/api/rbac-demo/owner-only', Role::Owner],
        ];
    }

    #[DataProvider('endpointsByRole')]
    public function test_matching_role_is_allowed(string $endpoint, Role $role): void
    {
        $user = $this->userWithRole($role);

        Sanctum::actingAs($user);
        $this->getJson($endpoint)->assertOk();
    }

    #[DataProvider('endpointsByRole')]
    public function test_every_non_matching_role_is_forbidden(string $endpoint, Role $allowedRole): void
    {
        foreach (Role::cases() as $role) {
            if ($role === $allowedRole) {
                continue;
            }

            $user = $this->userWithRole($role);

            Sanctum::actingAs($user);
            $this->getJson($endpoint)->assertForbidden();
        }
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/rbac-demo/patient-only')->assertStatus(401);
        $this->getJson('/api/rbac-demo/staff-only')->assertStatus(401);
        $this->getJson('/api/rbac-demo/dentist-only')->assertStatus(401);
        $this->getJson('/api/rbac-demo/owner-only')->assertStatus(401);
    }

    public function test_inactive_account_is_forbidden_even_with_matching_role(): void
    {
        $user = $this->userWithRole(Role::Owner, ['account_status' => 'Inactive']);

        Sanctum::actingAs($user);
        $this->getJson('/api/rbac-demo/owner-only')->assertForbidden();
    }

    public function test_request_role_claim_cannot_elevate_actual_role(): void
    {
        $patient = $this->userWithRole(Role::Patient);

        Sanctum::actingAs($patient);
        $response = $this->getJson('/api/rbac-demo/owner-only?role=owner&account_status=Active');

        $response->assertForbidden();
    }
}
