<?php

namespace Tests\Feature\Auth;

use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'Maria.Santos@Example.Com',
            'phone' => '+639171234567',
            'date_of_birth' => '1995-05-20',
            'password' => 'Passw0rd!',
            'password_confirmation' => 'Passw0rd!',
        ], $overrides);
    }

    public function test_patient_can_register_successfully(): void
    {
        $response = $this->postJson('/api/register', $this->validPayload());

        $response->assertCreated();
        $response->assertJsonPath('data.role', 'patient');
        $response->assertJsonPath('data.email', 'maria.santos@example.com');
        $response->assertJsonPath('data.first_name', 'Maria');
        $response->assertJsonPath('data.last_name', 'Santos');
        $response->assertJsonPath('data.phone', '+639171234567');
        $response->assertJsonPath('data.date_of_birth', '1995-05-20');
        $response->assertJsonMissingPath('data.password');
        $response->assertJsonMissingPath('data.middle_name');

        $person = Person::where('email', 'maria.santos@example.com')->firstOrFail();
        $patient = Patient::where('person_id', $person->id)->firstOrFail();
        $user = User::where('person_id', $person->id)->firstOrFail();

        $this->assertSame($person->id, $patient->person_id);
        $this->assertSame($person->id, $user->person_id);
        $this->assertSame('patient', $user->role->value);
        $this->assertSame('Active', $user->account_status);
    }

    public function test_persons_schema_uses_first_and_last_name_only(): void
    {
        $this->assertTrue(Schema::hasColumn('persons', 'first_name'));
        $this->assertTrue(Schema::hasColumn('persons', 'last_name'));
        $this->assertFalse(Schema::hasColumn('persons', 'middle_name'));
    }

    public function test_registration_hashes_password_and_normalizes_email(): void
    {
        $this->postJson('/api/register', $this->validPayload())->assertCreated();

        $user = User::where('email', 'maria.santos@example.com')->firstOrFail();

        $this->assertNotSame('Passw0rd!', $user->password);
        $this->assertTrue(Hash::check('Passw0rd!', $user->password));
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        $this->postJson('/api/register', $this->validPayload())->assertCreated();

        $response = $this->postJson('/api/register', $this->validPayload([
            'phone' => '+639179999999',
            'first_name' => 'Different',
            'last_name' => 'Person',
            'date_of_birth' => '1990-01-01',
        ]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('email');
        $this->assertSame(1, User::count());
    }

    public static function invalidPhoneProvider(): array
    {
        return [
            '9 digits' => ['+63917123456'],
            '11 digits' => ['+6391712345678'],
            'leading zero after +63' => ['+6309171234567'],
            'non-digit content' => ['+63917abc4567'],
            'missing country code' => ['09171234567'],
            'wrong country code' => ['+19171234567'],
        ];
    }

    #[DataProvider('invalidPhoneProvider')]
    public function test_registration_rejects_malformed_phone_numbers(string $phone): void
    {
        $response = $this->postJson('/api/register', $this->validPayload(['phone' => $phone]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('phone');
        $this->assertSame(0, User::count());
    }

    public function test_registration_rejects_duplicate_person_by_matching_phone(): void
    {
        $this->postJson('/api/register', $this->validPayload())->assertCreated();

        $response = $this->postJson('/api/register', $this->validPayload([
            'email' => 'someone-else@example.com',
        ]));

        $response->assertStatus(422);
        $this->assertSame(1, User::count());
        $this->assertSame(1, Person::count());
    }

    public function test_registration_requires_matching_password_confirmation(): void
    {
        $response = $this->postJson('/api/register', $this->validPayload([
            'password_confirmation' => 'somethingElse1',
        ]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('password');
        $this->assertSame(0, User::count());
    }

    public static function reservedFieldProvider(): array
    {
        return [
            'role' => ['role', 'staff'],
            'permissions' => ['permissions', ['manage_billing']],
            'account_status' => ['account_status', 'Active'],
            'person_id' => ['person_id', 1],
            'patient_id' => ['patient_id', 1],
            'user_id' => ['user_id', 1],
            'id' => ['id', 1],
            'title' => ['title', 'Owner'],
        ];
    }

    #[DataProvider('reservedFieldProvider')]
    public function test_registration_rejects_privileged_field_injection(string $field, mixed $value): void
    {
        $response = $this->postJson('/api/register', $this->validPayload([$field => $value]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors($field);
        $this->assertSame(0, User::count());
        $this->assertSame(0, Person::count());
    }

    public function test_registration_auto_logs_in_the_new_patient(): void
    {
        $this->postJson('/api/register', $this->validPayload())->assertCreated();

        $me = $this->getJson('/api/me');

        $me->assertOk();
        $me->assertJsonPath('data.email', 'maria.santos@example.com');
    }
}
