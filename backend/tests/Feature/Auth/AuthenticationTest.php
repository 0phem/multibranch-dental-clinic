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
        $response->assertJsonPath('code', 'invalid_credentials');
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
        $unknownEmail->assertJsonPath('code', 'invalid_credentials');
        $wrongPassword->assertJsonPath('code', 'invalid_credentials');
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
        $response->assertJsonPath('code', 'inactive_account');
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    // Regression: an unauthenticated request with Accept: application/json must get a JSON 401.
    public function test_unauthenticated_api_request_with_accept_json_returns_401_json(): void
    {
        $response = $this->getJson('/api/me');

        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    // Regression: bootstrap/app.php's ApplicationBuilder::withMiddleware() unconditionally pre-registers
    // redirectGuestsTo(fn () => route('login')) before the app's own middleware callback runs. This backend is
    // API-only and defines no 'login' route, so a plain unauthenticated request that does not itself send
    // Accept: application/json (any bare `curl`, or a plain browser navigation) used to crash with a 500
    // "Route [login] not defined" instead of a 401 — the crash happened constructing the AuthenticationException
    // itself, before shouldRenderJsonWhen ever got a chance to render it as JSON. Every /api/* request must get
    // a JSON 401 regardless of what Accept header (or lack of one) it sends.
    public function test_unauthenticated_api_request_without_accept_header_still_returns_401_json_never_500_or_redirect(): void
    {
        $response = $this->withHeaders(['Accept' => '*/*'])->get('/api/me');

        $response->assertStatus(401);
        $response->assertHeader('Content-Type', 'application/json');
        $response->assertJson(['message' => 'Unauthenticated.']);
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

    public function test_me_response_includes_safe_person_fields_for_the_frontend_identity_bridge(): void
    {
        $person = Person::factory()->create([
            'first_name' => 'Jamie',
            'middle_name' => 'Q',
            'last_name' => 'Cruz',
            'phone' => '09171234567',
            'date_of_birth' => '1998-05-17',
        ]);
        $user = User::factory()->create([
            'person_id' => $person->id,
            'email' => 'bridge@example.com',
            'password' => Hash::make('Passw0rd!'),
        ]);

        Sanctum::actingAs($user);
        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Jamie')
            ->assertJsonPath('data.middle_name', 'Q')
            ->assertJsonPath('data.last_name', 'Cruz')
            ->assertJsonPath('data.phone', '09171234567')
            ->assertJsonPath('data.date_of_birth', '1998-05-17');
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
