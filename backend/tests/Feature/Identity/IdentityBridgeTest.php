<?php

namespace Tests\Feature\Identity;

use App\Enums\Role;
use App\Models\Patient;
use App\Models\Person;
use App\Models\StaffProfile;
use App\Models\User;
use App\Models\UserBranchScope;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// M1/M4 identity bridge: the server-side answer to "which Patient belongs to this login?" (User -> Person -> Patient,
// database-backed and one-to-one) and "which branches may this Staff account operate on?" (user_branch_scopes,
// administered only by the Owner). No internal bigint identifier appears in any response.
class IdentityBridgeTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private const ULID = '/^[0-9a-hjkmnp-tv-z]{26}$/';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    private function register(array $overrides = [])
    {
        return $this->postJson('/api/register', $overrides + [
            'first_name' => 'Jamie', 'last_name' => 'Cruz', 'email' => 'jamie.cruz@example.com', 'phone' => '+639171234567',
            'date_of_birth' => '1995-04-12', 'password' => 'Passw0rd!', 'password_confirmation' => 'Passw0rd!',
        ]);
    }

    private function assertNoInternalIds(array $data): void
    {
        foreach (['person_id', 'patient_id', 'user_id'] as $key) {
            $this->assertArrayNotHasKey($key, $data);
        }
        $this->assertMatchesRegularExpression(self::ULID, $data['id']);
    }

    // ---- PATIENT IDENTITY -------------------------------------------------------------------------------------

    public function test_registration_links_user_person_and_patient_and_me_returns_the_public_patient(): void
    {
        $data = $this->register()->assertCreated()->json('data');
        $this->assertNoInternalIds($data);

        $user = User::where('public_id', $data['id'])->firstOrFail();
        $patient = Patient::where('person_id', $user->person_id)->firstOrFail();
        $this->assertSame($user->person_id, $patient->person_id, 'User and Patient share one Person');
        $this->assertSame(['id' => $patient->public_id, 'code' => $patient->patient_code], $data['patient']);
        $this->assertSame(1, Patient::where('person_id', $user->person_id)->count());

        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_login_resolves_the_correct_patient(): void
    {
        foreach (['A', 'B'] as $key) {
            $this->u['patient'.$key]->forceFill(['password' => 'Passw0rd!'])->save();
        }
        $this->postJson('/api/login', ['email' => $this->u['patientB']->email, 'password' => 'Passw0rd!'])->assertOk()
            ->assertJsonPath('data.patient.id', $this->p['B']->public_id);
        $this->getJson('/api/me')->assertOk()
            ->assertJsonPath('data.id', $this->u['patientB']->public_id)
            ->assertJsonPath('data.patient.id', $this->p['B']->public_id)
            ->assertJsonPath('data.patient.code', 'PAT-0002');
    }

    public function test_request_input_cannot_select_another_patient_identity(): void
    {
        $this->actingAsUser('patientA');
        $this->getJson('/api/me?patient_id='.$this->p['B']->public_id.'&id='.$this->u['patientB']->public_id)->assertOk()
            ->assertJsonPath('data.patient.id', $this->p['A']->public_id);
        // M6 derives the Patient from the login too; naming another Patient is refused.
        $this->postJson('/api/appointments', ['branch_ref' => 'b1', 'service_ref' => 'svc1', 'date' => '2026-09-29', 'start_time' => '09:00',
            'patient_id' => $this->p['B']->public_id])->assertStatus(422)->assertJsonValidationErrors('patient_id');
    }

    public function test_patient_ownership_is_never_guessed_from_email(): void
    {
        // A Patient account whose Person has no Patient record gets no Patient — even if another Person's Patient
        // record shares the same email address in its contact data.
        $orphan = $this->account(Role::Patient, null);
        $other = Person::factory()->create(['email' => 'other-'.$orphan->email]);
        Patient::create(['person_id' => $other->id, 'patient_code' => 'PAT-0099', 'consent' => true]);
        Sanctum::actingAs($orphan);
        $this->getJson('/api/me')->assertOk()->assertJsonPath('data.patient', null);
        $this->postJson('/api/appointments', ['branch_ref' => 'b1', 'service_ref' => 'svc1', 'date' => '2026-09-29', 'start_time' => '09:00'])->assertForbidden();
    }

    public function test_one_person_cannot_be_claimed_by_two_accounts(): void
    {
        $this->expectException(UniqueConstraintViolationException::class);
        User::factory()->create(['person_id' => $this->u['patientA']->person_id, 'role' => Role::Patient]);
    }

    public function test_one_person_cannot_have_two_patient_records(): void
    {
        $this->expectException(UniqueConstraintViolationException::class);
        Patient::create(['person_id' => $this->u['patientA']->person_id, 'patient_code' => 'PAT-0100', 'consent' => true]);
    }

    public function test_duplicate_registration_is_rejected_without_creating_records(): void
    {
        $this->register()->assertCreated();
        $this->postJson('/api/logout');
        $before = [User::withTrashed()->count(), Person::count(), Patient::count()];
        $this->register(['phone' => '+639179999999', 'first_name' => 'Other', 'date_of_birth' => '1990-01-01'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->assertSame($before, [User::withTrashed()->count(), Person::count(), Patient::count()]);
    }

    // ---- USER PUBLIC ID ---------------------------------------------------------------------------------------

    public function test_user_api_uses_public_ids_only(): void
    {
        $this->actingAsUser('owner');
        $rows = $this->getJson('/api/users')->assertOk()->json('data');
        foreach ($rows as $row) {
            $this->assertNoInternalIds($row);
        }
        $target = $this->u['patientA'];
        $this->patchJson('/api/users/'.$target->public_id, ['first_name' => 'Renamed'])->assertOk()->assertJsonPath('data.id', $target->public_id);
        $this->patchJson('/api/users/'.$target->id, ['first_name' => 'Nope'])->assertNotFound();
        $this->getJson('/api/users/'.$target->id.'/branch-scopes')->assertNotFound();
    }

    public function test_existing_users_are_backfilled_with_unique_public_ids(): void
    {
        $migration = require database_path('migrations/2026_09_29_000100_add_public_id_to_users_table.php');
        $migration->down();
        $this->assertFalse(DB::getSchemaBuilder()->hasColumn('users', 'public_id'));
        $count = DB::table('users')->count();

        $migration->up();

        $ids = DB::table('users')->pluck('public_id');
        $this->assertCount($count, $ids);
        $this->assertCount($count, $ids->filter()->unique());
        $ids->each(fn ($id) => $this->assertMatchesRegularExpression(self::ULID, $id));
        $column = DB::selectOne("select is_nullable from information_schema.columns where table_name = 'users' and column_name = 'public_id'");
        $this->assertSame('NO', $column->is_nullable);

        $this->expectException(UniqueConstraintViolationException::class);
        DB::table('users')->where('id', $this->u['patientB']->id)->update(['public_id' => DB::table('users')->where('id', $this->u['patientA']->id)->value('public_id')]);
    }

    // ---- STAFF BRANCH SCOPES ------------------------------------------------------------------------------------

    private function scopesUrl(string $user): string
    {
        return '/api/users/'.$this->u[$user]->public_id.'/branch-scopes';
    }

    private function availability(string $branch)
    {
        return $this->getJson("/api/appointments/availability?branch_ref={$branch}&service_ref=svc1&date=2026-09-30");
    }

    public function test_owner_assigns_one_then_multiple_branches_and_access_follows(): void
    {
        $this->actingAsUser('owner');
        $this->getJson($this->scopesUrl('staffNone'))->assertOk()->assertJsonPath('data.branch_scopes', []);
        $this->putJson($this->scopesUrl('staffNone'), ['branch_refs' => ['b1']])->assertOk()
            ->assertJsonPath('data.user.id', $this->u['staffNone']->public_id)
            ->assertJsonPath('data.branch_scopes', [['id' => 'b1', 'name' => 'Branch B1']]);

        $this->actingAsUser('staffNone');
        $this->availability('b1')->assertOk();
        $this->availability('b2')->assertForbidden();
        $this->getJson('/api/me')->assertJsonPath('data.branch_scopes.0.id', 'b1');

        $this->actingAsUser('owner');
        $this->putJson($this->scopesUrl('staffNone'), ['branch_refs' => ['b2', 'b1']])->assertOk()->assertJsonCount(2, 'data.branch_scopes');
        $this->actingAsUser('staffNone');
        $this->availability('b1')->assertOk();
        $this->availability('b2')->assertOk();
    }

    public function test_duplicate_scopes_are_prevented(): void
    {
        $this->actingAsUser('owner');
        $this->putJson($this->scopesUrl('staffB1'), ['branch_refs' => ['b1', 'b1']])->assertStatus(422)->assertJsonValidationErrors('branch_refs.0');
        // Re-sending the same set is idempotent: no duplicate rows.
        $this->putJson($this->scopesUrl('staffB1'), ['branch_refs' => ['b1']])->assertOk();
        $this->putJson($this->scopesUrl('staffB1'), ['branch_refs' => ['b1']])->assertOk();
        $this->assertSame(1, UserBranchScope::where('user_id', $this->u['staffB1']->id)->count());
        $this->putJson($this->scopesUrl('staffB1'), ['branch_refs' => ['b9']])->assertStatus(422)->assertJsonValidationErrors('branch_refs.0');
        $this->putJson($this->scopesUrl('staffB1'), [])->assertStatus(422)->assertJsonValidationErrors('branch_refs');
    }

    public function test_removing_a_scope_revokes_authorization(): void
    {
        $this->actingAsUser('staffBoth');
        $this->availability('b2')->assertOk();

        $this->actingAsUser('owner');
        $this->putJson($this->scopesUrl('staffBoth'), ['branch_refs' => ['b1']])->assertOk()->assertJsonCount(1, 'data.branch_scopes');
        $this->actingAsUser('staffBoth');
        $this->availability('b2')->assertForbidden();
        $this->availability('b1')->assertOk();

        $this->actingAsUser('owner');
        $this->putJson($this->scopesUrl('staffBoth'), ['branch_refs' => []])->assertOk()->assertJsonPath('data.branch_scopes', []);
        $this->actingAsUser('staffBoth');
        $this->availability('b1')->assertForbidden();
        $this->getJson('/api/appointments')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_staff_cannot_grant_themselves_access_and_other_roles_cannot_manage_scopes(): void
    {
        foreach (['staffNone', 'staffB1', 'patientA', 'dentist1'] as $who) {
            $this->actingAsUser($who);
            $this->putJson($this->scopesUrl('staffNone'), ['branch_refs' => ['b1', 'b2']])->assertForbidden();
            $this->getJson($this->scopesUrl('staffNone'))->assertForbidden();
        }
        $this->assertSame(0, UserBranchScope::where('user_id', $this->u['staffNone']->id)->count());
    }

    public function test_scopes_apply_to_staff_accounts_only(): void
    {
        $this->actingAsUser('owner');
        foreach (['patientA', 'dentist1', 'owner'] as $who) {
            $this->putJson($this->scopesUrl($who), ['branch_refs' => ['b1']])->assertStatus(422)->assertJsonValidationErrors('user');
        }
        $this->assertSame(0, UserBranchScope::whereIn('user_id', [$this->u['patientA']->id, $this->u['dentist1']->id, $this->u['owner']->id])->count());
    }

    public function test_operational_assignment_does_not_grant_or_appear_as_scope(): void
    {
        StaffProfile::create(['person_id' => $this->u['staffNone']->person_id, 'branch_id' => $this->b['b1']->id,
            'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true]);
        $this->actingAsUser('owner');
        $this->getJson($this->scopesUrl('staffNone'))->assertOk()->assertJsonPath('data.branch_scopes', []);
        $this->actingAsUser('staffNone');
        $this->availability('b1')->assertForbidden();
        $this->getJson('/api/me')->assertJsonPath('data.branch_scopes', []);
    }

    // ---- AUTH -----------------------------------------------------------------------------------------------------

    public function test_guest_and_inactive_accounts_are_denied(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson($this->scopesUrl('staffNone'))->assertUnauthorized();
        $this->putJson($this->scopesUrl('staffNone'), ['branch_refs' => ['b1']])->assertUnauthorized();

        $this->u['owner']->forceFill(['account_status' => 'Inactive'])->save();
        $this->actingAsUser('owner');
        $this->putJson($this->scopesUrl('staffNone'), ['branch_refs' => ['b1']])->assertForbidden();
    }

    // ---- DENTIST BOUNDARY -------------------------------------------------------------------------------------------

    public function test_dentist_login_identity_stays_separate_from_schedulability(): void
    {
        // The Dentist's own login still resolves as a Dentist account with no Patient record...
        $this->actingAsUser('dentist1');
        $this->getJson('/api/me')->assertOk()->assertJsonPath('data.role', 'dentist')->assertJsonPath('data.patient', null);

        // ...while a Dentist with no login at all remains bookable by in-scope Staff.
        [$this->d['d4']] = $this->dentist('d4', ['b1'], ['svc1'], login: false);
        $this->actingAsUser('staffB1');
        $this->postJson('/api/appointments', ['branch_ref' => 'b1', 'service_ref' => 'svc1', 'date' => '2026-09-29', 'start_time' => '09:00',
            'dentist_ref' => 'd4', 'patient_id' => $this->p['A']->public_id])->assertCreated()->assertJsonPath('data.dentist.id', 'd4');
    }
}
