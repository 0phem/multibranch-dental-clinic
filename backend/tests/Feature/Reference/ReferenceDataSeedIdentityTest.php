<?php

namespace Tests\Feature\Reference;

use App\Enums\Role;
use App\Models\DentistProfile;
use App\Models\Person;
use App\Models\StaffProfile;
use App\Models\User;
use Database\Seeders\DemoAccountsSeeder;
use Database\Seeders\DentistProfileSeeder;
use Database\Seeders\StaffProfileSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

// Phase 2A plan, section E/K/N: proves the seed-identity guarantees hold — d1/s1 attach to the real,
// already-existing demo-login Person without duplicating it; the other 8 roster members get a real Person
// with no User; a role mismatch is rejected rather than silently attached.
class ReferenceDataSeedIdentityTest extends TestCase
{
    use RefreshDatabase;

    public function test_d1_and_s1_attach_to_the_existing_demo_login_person_without_duplicating_it(): void
    {
        (new DemoAccountsSeeder)->run();
        (new \Database\Seeders\BranchSeeder)->run();
        (new StaffProfileSeeder)->run();
        (new DentistProfileSeeder)->run();

        $this->assertSame(1, Person::where('email', 'dentist@example.test')->count());
        $this->assertSame(1, Person::where('email', 'staff.reception@example.test')->count());

        $dentistUser = User::where('email', 'dentist@example.test')->first();
        $d1 = DentistProfile::where('legacy_ref', 'd1')->first();
        $this->assertNotNull($d1);
        $this->assertSame($dentistUser->person_id, $d1->person_id);

        $staffUser = User::where('email', 'staff.reception@example.test')->first();
        $s1 = StaffProfile::where('legacy_ref', 's1')->first();
        $this->assertNotNull($s1);
        $this->assertSame($staffUser->person_id, $s1->person_id);
    }

    public function test_roster_only_members_get_a_real_person_with_no_user_row(): void
    {
        (new DemoAccountsSeeder)->run();
        (new \Database\Seeders\BranchSeeder)->run();
        (new StaffProfileSeeder)->run();
        (new DentistProfileSeeder)->run();

        foreach (['d2', 'd3', 'd4', 'd5'] as $ref) {
            $profile = DentistProfile::where('legacy_ref', $ref)->firstOrFail();
            $this->assertNotNull($profile->person);
            $this->assertNull($profile->person->user, "person behind {$ref} unexpectedly has a User account");
        }

        foreach (['s2', 's3', 's4', 's5'] as $ref) {
            $profile = StaffProfile::where('legacy_ref', $ref)->firstOrFail();
            $this->assertNotNull($profile->person);
            $this->assertNull($profile->person->user, "person behind {$ref} unexpectedly has a User account");
        }
    }

    public function test_staff_role_user_to_staff_profile_consistency(): void
    {
        (new DemoAccountsSeeder)->run();
        (new \Database\Seeders\BranchSeeder)->run();
        (new StaffProfileSeeder)->run();

        $s1 = StaffProfile::where('legacy_ref', 's1')->firstOrFail();
        $this->assertSame(Role::Staff, $s1->person->user->role);
    }

    public function test_dentist_role_user_to_dentist_profile_consistency(): void
    {
        (new DemoAccountsSeeder)->run();
        (new \Database\Seeders\BranchSeeder)->run();
        (new StaffProfileSeeder)->run();
        (new DentistProfileSeeder)->run();

        $d1 = DentistProfile::where('legacy_ref', 'd1')->firstOrFail();
        $this->assertSame(Role::Dentist, $d1->person->user->role);
    }

    public function test_wrong_role_profile_attachment_is_rejected(): void
    {
        // A Patient-role user must never get a DentistProfile attached to its Person.
        $person = Person::factory()->create(['email' => 'dentist@example.test']);
        User::factory()->create(['person_id' => $person->id, 'email' => 'dentist@example.test', 'role' => Role::Patient]);

        $this->expectException(RuntimeException::class);
        (new DentistProfileSeeder)->run();
    }

    public function test_every_staff_profile_has_a_real_job_title_independent_of_any_linked_user(): void
    {
        // Regression test for a bug found during real-browser Phase 2A QA: the dentist-edit Assistant
        // dropdown (filters staffType==='Dental Assistant') came up empty because title was originally
        // read from the linked User (only 1 of 5 roster members has one) — see the
        // add_title_to_staff_profiles_table migration comment. title must now be readable for every staff
        // member regardless of whether a linked User exists.
        (new DemoAccountsSeeder)->run();
        (new \Database\Seeders\BranchSeeder)->run();
        (new StaffProfileSeeder)->run();

        $expected = ['s1' => 'Receptionist', 's2' => 'HMO Coordinator', 's3' => 'Dental Assistant', 's4' => 'Cashier', 's5' => 'Patient Engagement Staff'];
        foreach ($expected as $ref => $title) {
            $profile = StaffProfile::where('legacy_ref', $ref)->firstOrFail();
            $this->assertSame($title, $profile->title, "staff_profiles.title for {$ref}");
        }

        // The specific real-world case that broke: s3 (Nina Torres) has no linked User at all, yet her
        // title must still be readable directly off the profile.
        $assistant = StaffProfile::where('legacy_ref', 's3')->firstOrFail();
        $this->assertNull($assistant->person->user, 's3 must have no linked User (by design)');
        $this->assertSame('Dental Assistant', $assistant->title);
    }

    public function test_seeders_refuse_to_run_in_production(): void
    {
        app()['env'] = 'production';

        (new \Database\Seeders\BranchSeeder)->run();
        (new StaffProfileSeeder)->run();
        (new DentistProfileSeeder)->run();

        $this->assertSame(0, \App\Models\Branch::count());
        $this->assertSame(0, StaffProfile::count());
        $this->assertSame(0, DentistProfile::count());

        app()['env'] = 'testing';
    }
}
