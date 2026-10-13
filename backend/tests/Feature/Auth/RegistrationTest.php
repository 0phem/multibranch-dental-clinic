<?php

namespace Tests\Feature\Auth;

use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
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

        // The answer is only "check your email" (the same for an already-registered address); no account data is returned.
        $response->assertCreated();
        $response->assertJsonPath('data.email', 'maria.santos@example.com');
        $response->assertJsonPath('data.verification_required', true);
        $response->assertJsonMissingPath('data.role');
        $response->assertJsonMissingPath('data.password');

        $person = Person::where('email', 'maria.santos@example.com')->firstOrFail();
        $this->assertSame(['Maria', 'Santos', '+639171234567', '1995-05-20'], [$person->first_name, $person->last_name, $person->phone, $person->date_of_birth->toDateString()]);
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

    public function test_duplicate_email_creates_nothing_and_keeps_the_existing_password(): void
    {
        $this->postJson('/api/register', $this->validPayload())->assertCreated();

        $response = $this->postJson('/api/register', $this->validPayload([
            'phone' => '+639179999999',
            'first_name' => 'Different',
            'last_name' => 'Person',
            'date_of_birth' => '1990-01-01',
            'password' => 'Other1234', 'password_confirmation' => 'Other1234',
        ]));

        $response->assertCreated(); // the same answer as a new address (anti-enumeration)
        $this->assertSame(1, User::count());
        $this->assertTrue(Hash::check('Passw0rd!', User::sole()->password));
    }

    public static function invalidPhoneProvider(): array
    {
        return [
            '9 digits' => ['+63917123456'],
            '11 digits' => ['+6391712345678'],
            'leading zero after +63' => ['+6309171234567'],
            'non-digit content' => ['+63917abc4567'],
            'missing country code' => ['09171234567'],
            'impossible country code' => ['+999171234567'],
        ];
    }

    public function test_registration_accepts_a_valid_international_number_outside_the_old_six_country_list(): void
    {
        $this->postJson('/api/register', $this->validPayload(['phone' => '+4915123456789']))->assertCreated();
        $this->assertDatabaseHas('persons', ['email' => 'maria.santos@example.com', 'phone' => '+4915123456789']);
    }

    public function test_date_of_birth_is_required_and_cannot_be_future_or_invalid(): void
    {
        // UTC is still October 3, while the canonical clinic date is October 4.
        $this->travelTo(CarbonImmutable::parse('2026-10-03 18:00:00', 'UTC'), function () {
            $this->assertSame('2026-10-04', ClinicClock::today());
            $tomorrow = ClinicClock::now()->addDay()->toDateString();
            $this->assertSame('2026-10-05', $tomorrow);
            foreach (['', $tomorrow, '2024-02-30'] as $date) {
                $this->postJson('/api/register', $this->validPayload(['date_of_birth' => $date]))
                    ->assertStatus(422)->assertJsonValidationErrors('date_of_birth');
            }
            $this->assertSame(0, User::count());

            $this->postJson('/api/register', $this->validPayload(['date_of_birth' => ClinicClock::today()]))->assertCreated();
            $this->assertDatabaseHas('persons', [
                'email' => 'maria.santos@example.com', 'date_of_birth' => '2026-10-04',
            ]);
        });
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

    public function test_registration_does_not_log_in_until_email_is_verified(): void
    {
        $this->postJson('/api/register', $this->validPayload())->assertCreated();

        $me = $this->getJson('/api/me');

        $me->assertUnauthorized();
    }
}
