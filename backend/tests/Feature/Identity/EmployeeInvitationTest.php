<?php

namespace Tests\Feature\Identity;

use App\Enums\Role;
use App\Mail\EmployeeInvitationMail;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Person;
use App\Models\User;
use App\Services\Mail\MailDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M1 employee provisioning by Owner email invitation, with M18 truthful dispatch evidence. */
class EmployeeInvitationTest extends TestCase
{
    use RefreshDatabase;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush(); // the acceptance endpoint is throttled
        Mail::fake();
        $this->branch = Branch::create(['legacy_ref' => 'b1', 'branch_code' => 'BRC-B1', 'name' => 'Branch A', 'city' => 'Bocaue', 'address' => '1 St',
            'open_time' => '09:00', 'close_time' => '18:00', 'status' => 'Open', 'capacity_threshold' => 80]);
    }

    private function account(Role $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge(['person_id' => Person::factory()->create()->id, 'role' => $role], $overrides));
    }

    private function payload(array $overrides = []): array
    {
        return array_merge(['role' => 'staff', 'first_name' => 'Rina', 'last_name' => 'Lopez', 'email' => 'Rina.Lopez@Example.test', 'title' => 'Receptionist',
            'branch_ref' => 'b1', 'shift_start' => '09:00', 'shift_end' => '17:00'], $overrides);
    }

    /** Invite and return [user, emailed token]. */
    private function invite(array $overrides = []): array
    {
        Sanctum::actingAs($this->account(Role::Owner));
        $response = $this->postJson('/api/employee-invitations', $this->payload($overrides))->assertCreated();
        $user = User::where('public_id', $response->json('data.id'))->firstOrFail();

        return [$user, $this->lastToken($user->email), $response];
    }

    private function lastToken(string $email): string
    {
        $token = null;
        Mail::assertSent(EmployeeInvitationMail::class, function (EmployeeInvitationMail $mail) use ($email, &$token) {
            if (! $mail->hasTo($email)) return false;
            parse_str(parse_url(str_replace('#accept-invitation?', '?', $mail->link), PHP_URL_QUERY), $q);
            $token = $q['token'];
            return true;
        });

        return $token;
    }

    private function accept(string $email, string $token, string $password = 'Passw0rd1')
    {
        auth()->forgetGuards();
        return $this->postJson('/api/invitations/accept', ['email' => $email, 'token' => $token, 'password' => $password, 'password_confirmation' => $password]);
    }

    public function test_owner_invites_staff_with_operational_profile_but_no_scope_or_availability(): void
    {
        [$user, $token, $response] = $this->invite();
        $response->assertJsonPath('data.status', 'Invited')->assertJsonPath('data.role', 'staff')->assertJsonPath('data.email', 'rina.lopez@example.test')
            ->assertJsonPath('data.branch.id', 'b1')->assertJsonPath('data.expired', false)
            ->assertJsonPath('delivery.status', 'logged_only') // array mailer: nothing left this process
            ->assertJsonMissingPath('data.token');
        $this->assertSame('Invited', $user->account_status);
        $this->assertNull($user->email_verified_at);
        $this->assertDatabaseHas('staff_profiles', ['person_id' => $user->person_id, 'branch_id' => $this->branch->id, 'title' => 'Receptionist', 'available' => false]);
        $this->assertDatabaseMissing('user_branch_scopes', ['user_id' => $user->id]); // authorization scope is a separate Owner step
        $row = DB::table('password_reset_tokens')->where('email', $user->email)->first();
        $this->assertNotSame($token, $row->token, 'only a hash of the link token is stored');
        $this->assertSame(64, strlen($token));
        $this->assertTrue(AuditLog::where('action', 'employee.invited')->where('auditable_public_id', $user->public_id)->exists());
        $mail = AuditLog::where('action', 'mail.dispatched')->where('auditable_public_id', $user->public_id)->firstOrFail();
        $this->assertEquals(['purpose' => 'employee_invitation', 'status' => 'logged_only', 'mailer' => 'array', 'transport_kind' => 'local'], $mail->payload); // jsonb key order is not significant
        $this->assertStringNotContainsString('rina', strtolower(json_encode(AuditLog::all()->pluck('payload'))), 'no address in audit payloads');
    }

    public function test_only_the_owner_manages_invitations_and_owner_accounts_are_not_invitable(): void
    {
        foreach ([Role::Staff, Role::Dentist, Role::Patient] as $role) {
            Sanctum::actingAs($this->account($role, ['email_verified_at' => now()]));
            $this->getJson('/api/employee-invitations')->assertForbidden();
            $this->postJson('/api/employee-invitations', $this->payload(['email' => "x{$role->value}@example.test"]))->assertForbidden();
        }
        Sanctum::actingAs($this->account(Role::Owner));
        $this->postJson('/api/employee-invitations', $this->payload(['role' => 'owner']))->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->postJson('/api/employee-invitations', $this->payload(['role' => 'patient']))->assertUnprocessable();
        $this->assertSame(0, User::where('account_status', 'Invited')->count());
    }

    public function test_invalid_input_is_refused_without_side_effects(): void
    {
        $owner = $this->account(Role::Owner, ['email' => 'owner@example.test']);
        Sanctum::actingAs($owner);
        $this->postJson('/api/employee-invitations', $this->payload(['title' => '']))->assertJsonValidationErrors('title');
        $this->postJson('/api/employee-invitations', $this->payload(['shift_end' => '08:00']))->assertJsonValidationErrors('shift_end');
        $this->postJson('/api/employee-invitations', $this->payload(['branch_ref' => 'nope']))->assertJsonValidationErrors('branch_ref');
        $this->postJson('/api/employee-invitations', $this->payload(['email' => 'owner@example.test']))->assertJsonValidationErrors('email');
        $this->postJson('/api/employee-invitations', $this->payload(['phone' => '0917']))->assertJsonValidationErrors('phone');
        $this->assertSame(0, User::where('account_status', 'Invited')->count());
        $this->assertSame(0, DB::table('staff_profiles')->count());
        Mail::assertNothingSent();
    }

    public function test_dentist_invitation_links_the_branch_and_keeps_the_license_unique(): void
    {
        [$user] = $this->invite(['role' => 'dentist', 'title' => null, 'email' => 'dr.new@example.test', 'license_no' => 'PRC-123', 'specialty' => 'Orthodontics']);
        $profile = DB::table('dentist_profiles')->where('person_id', $user->person_id)->first();
        $this->assertFalse((bool) $profile->available);
        $this->assertTrue(DB::table('dentist_branches')->where('dentist_profile_id', $profile->id)->where('branch_id', $this->branch->id)->exists());
        $this->assertSame(0, DB::table('dentist_service_assignments')->where('dentist_profile_id', $profile->id)->count(), 'not bookable before onboarding');
        $this->postJson('/api/employee-invitations', $this->payload(['role' => 'dentist', 'email' => 'dr.two@example.test', 'license_no' => 'PRC-123']))
            ->assertJsonValidationErrors('license_no');
    }

    public function test_invited_accounts_cannot_sign_in_or_be_activated_by_restore(): void
    {
        [$user] = $this->invite();
        $owner = User::where('role', Role::Owner)->firstOrFail();
        Sanctum::actingAs($owner);
        $this->postJson("/api/users/{$user->public_id}/restore")->assertUnprocessable();
        $this->postJson("/api/users/{$user->public_id}/suspend")->assertUnprocessable();
        $this->assertSame('Invited', $user->fresh()->account_status);
        auth()->forgetGuards();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'anything1'])->assertUnprocessable();
    }

    public function test_acceptance_sets_the_password_once_and_the_employee_can_sign_in(): void
    {
        [$user, $token] = $this->invite();
        $this->accept($user->email, str_repeat('a', 64))->assertUnprocessable()->assertJsonValidationErrors('token');
        $this->accept($user->email, $token, 'short')->assertJsonValidationErrors('password');
        $this->accept($user->email, $token)->assertOk()->assertJsonPath('data.accepted', true);
        $fresh = $user->fresh();
        $this->assertSame('Active', $fresh->account_status);
        $this->assertNotNull($fresh->email_verified_at);
        $this->assertFalse(DB::table('password_reset_tokens')->where('email', $user->email)->exists());
        $this->assertTrue(AuditLog::where('action', 'employee.invitation_accepted')->where('auditable_public_id', $user->public_id)->exists());
        $this->accept($user->email, $token, 'Another1pass')->assertUnprocessable(); // single use
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Passw0rd1'])->assertOk()->assertJsonPath('data.role', 'staff');
    }

    public function test_expired_links_fail_with_the_same_generic_message(): void
    {
        [$user, $token] = $this->invite();
        $generic = $this->accept('nobody@example.test', $token)->assertUnprocessable()->json('errors.token.0');
        $this->travel(72)->hours();
        $this->assertSame($generic, $this->accept($user->email, $token)->assertUnprocessable()->json('errors.token.0'));
        $this->assertSame('Invited', $user->fresh()->account_status);
        // the Owner listing shows it as expired
        Sanctum::actingAs(User::where('role', Role::Owner)->firstOrFail());
        $this->getJson('/api/employee-invitations')->assertOk()->assertJsonPath('data.0.expired', true)->assertJsonPath('data.0.last_delivery.status', 'logged_only');
    }

    public function test_resend_replaces_the_link_and_cancel_then_resend_reopens(): void
    {
        [$user, $first] = $this->invite();
        $owner = User::where('role', Role::Owner)->firstOrFail();
        Sanctum::actingAs($owner);
        $this->postJson("/api/employee-invitations/{$user->public_id}/resend")->assertOk()->assertJsonPath('delivery.status', 'logged_only');
        $second = null;
        Mail::assertSent(EmployeeInvitationMail::class, function ($mail) use (&$second, $first) {
            parse_str(parse_url(str_replace('#accept-invitation?', '?', $mail->link), PHP_URL_QUERY), $q);
            if ($q['token'] !== $first) $second = $q['token'];
            return true;
        });
        $this->assertNotNull($second);
        $this->accept($user->email, $first)->assertUnprocessable(); // the old link no longer works

        Sanctum::actingAs($owner);
        $this->postJson("/api/employee-invitations/{$user->public_id}/cancel")->assertOk()->assertJsonPath('data.status', 'Revoked');
        $this->accept($user->email, $second)->assertUnprocessable();
        Sanctum::actingAs($owner);
        $this->postJson("/api/employee-invitations/{$user->public_id}/cancel")->assertUnprocessable(); // already cancelled
        $this->postJson("/api/employee-invitations/{$user->public_id}/resend")->assertOk()->assertJsonPath('data.status', 'Invited');
        $this->assertTrue(AuditLog::where('action', 'employee.invitation_reopened')->exists());
    }

    public function test_activated_and_non_employee_accounts_are_never_treated_as_invitations(): void
    {
        [$user, $token] = $this->invite();
        $this->accept($user->email, $token)->assertOk();
        $patient = $this->account(Role::Patient, ['email_verified_at' => null, 'account_status' => 'Active']);
        $owner = User::where('role', Role::Owner)->firstOrFail();
        Sanctum::actingAs($owner);
        foreach ([$user, $patient, $owner] as $target) {
            $this->postJson("/api/employee-invitations/{$target->public_id}/resend")->assertUnprocessable();
            $this->postJson("/api/employee-invitations/{$target->public_id}/cancel")->assertUnprocessable();
        }
        // a forged token row for an active Patient cannot activate or change it
        DB::table('password_reset_tokens')->insert(['email' => $patient->email, 'token' => bcrypt(str_repeat('b', 64)), 'created_at' => now()]);
        $this->accept($patient->email, str_repeat('b', 64))->assertUnprocessable();
        $this->assertNull($patient->fresh()->email_verified_at);
    }

    public function test_a_failed_send_keeps_the_invitation_and_reports_failed_not_sent(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('smtp down'));
        Sanctum::actingAs($this->account(Role::Owner));
        $response = $this->postJson('/api/employee-invitations', $this->payload())->assertCreated();
        $response->assertJsonPath('delivery.status', 'failed')->assertJsonPath('data.status', 'Invited');
        $this->assertStringContainsString('No email is known to have been sent', $response->json('delivery.message'));
        $this->assertSame('failed', AuditLog::where('action', 'mail.dispatched')->latest('id')->first()->payload['status']);
    }

    public function test_transport_classification_never_calls_a_log_mailer_delivered(): void
    {
        $dispatcher = app(MailDispatcher::class);
        config(['mail.default' => 'log']);
        $this->assertSame('local', $dispatcher->transportKind());
        config(['mail.default' => 'smtp']);
        $this->assertSame('real', $dispatcher->transportKind());
        config(['mail.mailers.mixed' => ['transport' => 'failover', 'mailers' => ['smtp', 'log']], 'mail.default' => 'mixed']);
        $this->assertSame('unknown', $dispatcher->transportKind());
        $this->assertStringContainsString('not confirmed', MailDispatcher::describe('transport_accepted', 'real'));
        $this->assertStringContainsString('No email was sent', MailDispatcher::describe('logged_only', 'local'));
    }

    public function test_mail_diagnostic_reports_logged_only_instead_of_success(): void
    {
        Sanctum::actingAs($this->account(Role::Owner));
        $this->postJson('/api/mail/test', ['recipient_email' => 'diag@example.test'])->assertOk()
            ->assertJsonPath('status', 'logged_only')->assertJsonPath('ok', true)
            ->assertJsonPath('message', MailDispatcher::describe('logged_only', 'local'));
    }

    public function test_me_reports_the_employees_own_profile_and_branch_but_never_for_patients(): void
    {
        [$user, $token] = $this->invite();
        $this->accept($user->email, $token)->assertOk();
        Sanctum::actingAs($user->fresh());
        $me = $this->getJson('/api/me')->assertOk();
        $profile = DB::table('staff_profiles')->where('person_id', $user->person_id)->first();
        $me->assertJsonPath('data.employee.profile_id', $profile->legacy_ref)->assertJsonPath('data.employee.branch_id', 'b1')
            ->assertJsonPath('data.employee.title', 'Receptionist')->assertJsonPath('data.branch_scopes', []);
        $this->assertStringStartsWith('s-', $profile->legacy_ref);
        $this->assertSame($user->public_id, $profile->legacy_user_ref, 'the profile links back to this exact account');
        auth()->forgetGuards();
        Sanctum::actingAs($this->account(Role::Patient, ['email_verified_at' => now()]));
        $this->getJson('/api/me')->assertOk()->assertJsonPath('data.employee', null);
    }
}
