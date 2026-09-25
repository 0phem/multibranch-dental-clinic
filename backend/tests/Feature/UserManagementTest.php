<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private function account(Role $role = Role::Owner, array $overrides = []): User
    {
        $person = Person::factory()->create();
        return User::factory()->create(array_merge(['person_id' => $person->id, 'role' => $role], $overrides));
    }

    private function owner(): User { return $this->account(Role::Owner); }

    private function createPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Jamie', 'last_name' => 'Cruz', 'email' => 'jamie@example.com',
            'phone' => '+639171234567', 'role' => 'patient', 'password' => 'Passw0rd!',
            'password_confirmation' => 'Passw0rd!',
        ], $overrides);
    }

    public function test_owner_can_list_create_update_and_delete_patient_accounts(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);

        $this->getJson('/api/users')->assertOk();
        $create = $this->postJson('/api/users', $this->createPayload())->assertCreated();
        $create->assertJsonPath('data.role', 'patient')->assertJsonMissingPath('data.password');
        $user = User::where('email', 'jamie@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('Passw0rd!', $user->password));
        $this->assertDatabaseHas('patients', ['person_id' => $user->person_id]);

        $this->patchJson('/api/users/'.$user->id, [
            'first_name' => 'Jamie Updated', 'last_name' => 'Cruz', 'email' => 'jamie.updated@example.com', 'phone' => '+639189999999',
        ])->assertOk()->assertJsonPath('data.first_name', 'Jamie Updated');
        $this->assertDatabaseHas('persons', ['id' => $user->person_id, 'email' => 'jamie.updated@example.com']);

        $this->deleteJson('/api/users/'.$user->id)->assertNoContent();
        $this->getJson('/api/users')->assertJsonMissing(['email' => 'jamie.updated@example.com']);
        $this->assertSoftDeleted('users', ['id' => $user->id]);
    }

    public function test_only_owner_can_access_user_management(): void
    {
        foreach ([Role::Patient, Role::Staff, Role::Dentist] as $role) {
            Sanctum::actingAs($this->account($role));
            $this->getJson('/api/users')->assertForbidden();
            $this->postJson('/api/users', $this->createPayload())->assertForbidden();
        }
    }

    public function test_creation_is_patient_only_and_atomic(): void
    {
        Sanctum::actingAs($this->owner());
        foreach (['staff', 'dentist', 'owner'] as $role) {
            $this->postJson('/api/users', $this->createPayload(['role' => $role]))
                ->assertStatus(422)->assertJsonValidationErrors('role');
        }

        $this->postJson('/api/users', $this->createPayload())->assertCreated();
        $this->assertSame(1, Patient::count());
        $this->assertSame(1, User::where('role', Role::Patient)->count());
    }

    public function test_new_patient_account_can_log_in_with_the_created_password(): void
    {
        Auth::forgetGuards();
        $owner = $this->account(Role::Owner, ['email' => 'owner-login@example.com', 'password' => Hash::make('Passw0rd!')]);
        $this->postJson('/api/login', ['email' => $owner->email, 'password' => 'Passw0rd!'])->assertOk();
        $this->postJson('/api/users', $this->createPayload())->assertCreated();
        $this->postJson('/api/logout')->assertNoContent();
        Auth::forgetGuards();

        $this->postJson('/api/login', ['email' => 'jamie@example.com', 'password' => 'Passw0rd!'])
            ->assertOk()->assertJsonPath('data.role', 'patient');
    }

    public function test_duplicate_user_or_person_email_is_rejected_cleanly(): void
    {
        Sanctum::actingAs($this->owner());
        $existing = $this->account(Role::Patient, ['email' => 'existing@example.com']);
        $this->postJson('/api/users', $this->createPayload(['email' => $existing->email]))
            ->assertStatus(422)->assertJsonValidationErrors('email');

        Person::factory()->create(['email' => 'roster@example.com']);
        $this->postJson('/api/users', $this->createPayload(['email' => 'roster@example.com']))
            ->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_role_and_password_cannot_be_changed(): void
    {
        Sanctum::actingAs($this->owner());
        $user = $this->account(Role::Patient);
        $this->patchJson('/api/users/'.$user->id, ['role' => 'owner'])->assertStatus(422)->assertJsonValidationErrors('role');
        $this->patchJson('/api/users/'.$user->id, ['password' => 'NewPass1!', 'password_confirmation' => 'NewPass1!'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_unknown_user_self_delete_and_last_owner_delete_are_protected(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);
        $this->deleteJson('/api/users/'.$owner->id)->assertStatus(422)->assertJsonValidationErrors('user');
        $this->deleteJson('/api/users/999999')->assertNotFound();
        $this->assertDatabaseHas('users', ['id' => $owner->id, 'deleted_at' => null]);
    }

    public function test_a_non_last_owner_can_be_deleted_but_the_last_owner_cannot(): void
    {
        $owner = $this->owner();
        $secondOwner = $this->account(Role::Owner);
        Sanctum::actingAs($owner);

        $this->deleteJson('/api/users/'.$secondOwner->id)->assertNoContent();
        $this->deleteJson('/api/users/'.$owner->id)->assertStatus(422)->assertJsonValidationErrors('user');
        $this->assertSoftDeleted('users', ['id' => $secondOwner->id]);
        $this->assertDatabaseHas('users', ['id' => $owner->id, 'deleted_at' => null]);
    }

    public function test_deleted_account_cannot_log_in_and_deleted_email_remains_reserved(): void
    {
        $owner = $this->owner();
        $patient = $this->account(Role::Patient, ['email' => 'deleted@example.com', 'password' => Hash::make('Passw0rd!')]);
        Sanctum::actingAs($owner);
        $this->deleteJson('/api/users/'.$patient->id)->assertNoContent();
        auth()->forgetUser();
        // The real auth stack reports a soft-deleted account as invalid credentials (422).
        $this->postJson('/api/login', ['email' => 'deleted@example.com', 'password' => 'Passw0rd!'])->assertStatus(422);

        Sanctum::actingAs($owner);
        $this->postJson('/api/users', $this->createPayload(['email' => 'deleted@example.com']))
            ->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_existing_session_loses_authenticated_access_after_account_deletion(): void
    {
        $patient = $this->account(Role::Patient, ['email' => 'session@example.com', 'password' => Hash::make('Passw0rd!')]);
        $this->postJson('/api/login', ['email' => 'session@example.com', 'password' => 'Passw0rd!'])->assertOk();
        $patient->delete();
        Auth::forgetGuards();

        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_owner_account_is_never_returned_with_sensitive_fields(): void
    {
        Sanctum::actingAs($this->owner());
        $response = $this->getJson('/api/users')->assertOk();
        $response->assertJsonMissingPath('data.0.password');
        $response->assertJsonMissingPath('data.0.title');
        $response->assertJsonMissingPath('data.0.account_status');
    }
}
