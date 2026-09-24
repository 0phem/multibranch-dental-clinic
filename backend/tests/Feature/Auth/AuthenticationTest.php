<?php

namespace Tests\Feature\Auth;

use App\Models\Person;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $overrides = []): User
    {
        $person = Person::factory()->create();

        return User::factory()->create(array_merge([
            'person_id' => $person->id,
            'password' => Hash::make('Passw0rd!'),
        ], $overrides));
    }

    public function test_user_can_login_with_correct_credentials(): void
    {
        $this->makeUser(['email' => 'login@example.com']);

        $response = $this->postJson('/api/login', [
            'email' => 'login@example.com',
            'password' => 'Passw0rd!',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.email', 'login@example.com');
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $this->makeUser(['email' => 'login@example.com']);

        $response = $this->postJson('/api/login', [
            'email' => 'login@example.com',
            'password' => 'WrongPass1',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('email');
    }

    public function test_login_uses_identical_generic_message_for_unknown_email_and_wrong_password(): void
    {
        $this->makeUser(['email' => 'known@example.com']);

        $unknownEmail = $this->postJson('/api/login', [
            'email' => 'unknown@example.com',
            'password' => 'WrongPass1',
        ]);

        $wrongPassword = $this->postJson('/api/login', [
            'email' => 'known@example.com',
            'password' => 'WrongPass1',
        ]);

        $unknownEmail->assertStatus(422);
        $wrongPassword->assertStatus(422);
        $this->assertSame(
            $unknownEmail->json('errors.email.0'),
            $wrongPassword->json('errors.email.0')
        );
    }

    public function test_login_fails_for_inactive_account_with_a_distinct_message(): void
    {
        $this->makeUser(['email' => 'inactive@example.com', 'account_status' => 'Inactive']);

        $response = $this->postJson('/api/login', [
            'email' => 'inactive@example.com',
            'password' => 'Passw0rd!',
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('inactive', strtolower((string) $response->json('errors.email.0')));
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_me_response_never_exposes_password_or_remember_token(): void
    {
        $user = $this->makeUser(['email' => 'safe@example.com']);

        Sanctum::actingAs($user);
        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('remember_token');
    }

    public function test_logout_invalidates_the_session_so_me_requires_login_again(): void
    {
        $this->makeUser(['email' => 'login@example.com']);

        $this->postJson('/api/login', ['email' => 'login@example.com', 'password' => 'Passw0rd!'])->assertOk();
        $this->getJson('/api/me')->assertOk();

        $this->postJson('/api/logout')->assertNoContent();

        // Forces the auth guard to re-resolve from the (now invalidated) session rather than reusing the
        // in-process guard instance PHPUnit's HTTP test client shares across sequential calls within one test
        // method — a real browser's next request always resolves a brand-new guard from actual cookie state,
        // which is what this line makes the test accurately simulate.
        Auth::forgetGuards();

        $this->getJson('/api/me')->assertStatus(401);
    }
}
