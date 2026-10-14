<?php

namespace Tests\Feature\Auth;

use App\Enums\Role;
use App\Models\{User, Person, Patient, EmailVerificationOtp, AuditLog};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Auth, Hash, Mail, Log};
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductionHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $extra = []): array
    {
        return array_merge(['first_name'=>'Review','last_name'=>'Patient','email'=>'review@example.test',
            'phone'=>'+14155550123','date_of_birth'=>'1995-01-01','password'=>'Password123!',
            'password_confirmation'=>'Password123!'], $extra);
    }

    public function test_status_commands_are_owner_only_idempotent_and_preserve_identity(): void
    {
        $target=User::factory()->create();
        foreach ([Role::Patient,Role::Staff,Role::Dentist] as $role) {
            Sanctum::actingAs(User::factory()->role($role)->create());
            $this->postJson('/api/users/'.$target->public_id.'/suspend')->assertForbidden();
            $this->postJson('/api/users/'.$target->public_id.'/restore')->assertForbidden();
        }
        $owner=User::factory()->role(Role::Owner)->create();
        Sanctum::actingAs($owner);
        $this->postJson('/api/users/'.$owner->public_id.'/suspend')->assertStatus(422);
        $this->postJson('/api/users/'.$target->public_id.'/suspend')->assertOk()->assertJsonPath('data.account_status','Suspended');
        $this->postJson('/api/users/'.$target->public_id.'/suspend')->assertOk();
        $this->assertSame(1,AuditLog::where('action','account.suspended')->count());
        $this->postJson('/api/users/'.$target->public_id.'/restore')->assertOk()->assertJsonPath('data.account_status','Active');
        $this->assertSame($target->person_id,$target->fresh()->person_id);
        $this->assertDatabaseHas('audit_logs',['action'=>'account.restored']);
    }

    public function test_stateful_auth_posts_require_csrf_outside_test_bypass(): void
    {
        $this->app->instance('env','production');
        try { $this->postJson('/api/login',['email'=>'review@example.test','password'=>'Password123!'])->assertStatus(419); }
        finally { $this->app->instance('env','testing'); }
    }

    public function test_login_regenerates_session_and_projection_contains_only_public_identifiers(): void
    {
        $user=User::factory()->create(['password'=>Hash::make('Password123!')]);
        $before=$this->app['session']->getId();
        $response=$this->postJson('/api/login',['email'=>$user->email,'password'=>'Password123!'])->assertOk();
        $this->assertNotSame($before,$this->app['session']->getId());
        $response->assertJsonPath('data.id',$user->public_id)->assertJsonMissingPath('data.auth_version')
            ->assertJsonMissingPath('data.person_id')->assertJsonMissingPath('data.password')->assertJsonMissingPath('data.email_verified_at');
    }

    public function test_audit_failure_rolls_back_account_provisioning(): void
    {
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $this->mock(\App\Services\Audit\AuditService::class)->shouldReceive('recordAdministrative')->once()->andThrow(new \RuntimeException('audit unavailable'));
        $response=$this->postJson('/api/users',array_merge($this->payload(),['role'=>'patient','phone'=>'+639171234567']))->assertStatus(500);
        $this->assertStringNotContainsString('audit unavailable',$response->getContent());
        $this->assertDatabaseMissing('users',['email'=>'review@example.test']);
        $this->assertDatabaseMissing('persons',['email'=>'review@example.test']);
    }

    public function test_login_is_rate_limited_per_normalized_account_and_ip(): void
    {
        for ($i=0;$i<5;$i++) $this->postJson('/api/login',['email'=>' REVIEW@example.test ','password'=>'wrong'])->assertStatus(422);
        $this->postJson('/api/login',['email'=>'review@example.test','password'=>'wrong'])->assertStatus(429)->assertHeader('Retry-After');
    }

    public function test_registration_and_otp_endpoints_are_throttled_even_for_unknown_accounts(): void
    {
        $this->freezeTime(); // the limit is per minute: a minute boundary between the 30th and 31st request would reset it
        for ($i=0;$i<30;$i++) $this->postJson('/api/register',[])->assertStatus(422);
        $this->postJson('/api/register',[])->assertStatus(429);
        for ($i=0;$i<30;$i++) $this->postJson('/api/register/verify',['email'=>'missing@example.test','otp'=>'123456'])->assertStatus(422);
        $this->postJson('/api/register/verify',['email'=>'missing@example.test','otp'=>'123456'])->assertStatus(429);
    }

    public function test_malformed_email_types_and_oversized_passwords_return_validation_not_exceptions(): void
    {
        $this->postJson('/api/register',$this->payload(['email'=>['bad']]))->assertStatus(422);
        $this->postJson('/api/login',['email'=>['bad'],'password'=>'x'])->assertStatus(422);
        foreach ([str_repeat('é',40).'1', "Pass\0word123"] as $password) {
            $this->postJson('/api/register',$this->payload(['password'=>$password,'password_confirmation'=>$password]))->assertStatus(422);
        }
        $this->postJson('/api/register',$this->payload(['password'=>str_repeat('a',10000)]))->assertStatus(422);
    }

    public function test_additional_reserved_registration_fields_cannot_be_injected(): void
    {
        Mail::fake();
        foreach (['public_id'=>'attacker','branch_id'=>1,'branch_ids'=>[1],'branch_scopes'=>['b1'],'email_verified_at'=>'2026-01-01'] as $key=>$value) {
            $this->postJson('/api/register',$this->payload([$key=>$value]))->assertStatus(422)->assertJsonValidationErrors($key);
        }
        $this->assertSame(0, User::count());
    }

    public function test_suspension_revokes_an_existing_session_including_unqualified_reference_routes(): void
    {
        $user=User::factory()->create(['password'=>Hash::make('Password123!')]);
        $this->postJson('/api/login',['email'=>$user->email,'password'=>'Password123!'])->assertOk();
        $user->update(['account_status'=>'Suspended']);
        Auth::forgetGuards();
        $this->getJson('/api/branches')->assertForbidden()->assertJsonPath('code','session_revoked');
        Auth::forgetGuards();
        $this->getJson('/api/me')->assertUnauthorized();
        $user->update(['account_status'=>'Active']);
        Auth::forgetGuards();
        $this->getJson('/api/me')->assertUnauthorized();
        $this->postJson('/api/login',['email'=>$user->email,'password'=>'Password123!'])->assertOk();
    }

    public function test_a_session_recreated_by_an_inflight_request_stays_revoked_after_restoration(): void
    {
        $user=User::factory()->create(['password'=>Hash::make('Password123!')]);
        $this->postJson('/api/login',['email'=>$user->email,'password'=>'Password123!'])->assertOk();
        $oldVersion=(int)$user->auth_version;
        $user->update(['account_status'=>'Suspended']);
        $user->update(['account_status'=>'Active']);
        // Model a late session write that survives row deletion. Its revision is stale.
        $this->withSession(['auth_version'=>$oldVersion]);
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_unverified_session_cannot_read_me(): void
    {
        Sanctum::actingAs(User::factory()->unverified()->create());
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_suspended_patient_cannot_verify_or_request_new_otp(): void
    {
        $user=User::factory()->unverified()->create(['account_status'=>'Suspended']);
        $otp=EmailVerificationOtp::create(['user_id'=>$user->id,'digest'=>Hash::make('123456'),'attempts'=>0,'expires_at'=>now()->addMinutes(10),'sent_at'=>now()->subMinutes(2)]);
        $this->postJson('/api/register/verify',['email'=>$user->email,'otp'=>'123456'])->assertStatus(422);
        $this->assertNull($user->fresh()->email_verified_at);
        Mail::fake();
        $this->postJson('/api/register/resend',['email'=>$user->email])->assertOk();
        Mail::assertNothingSent();
        $this->assertSame(1,EmailVerificationOtp::count());
    }

    public function test_resend_inside_the_cooldown_sends_nothing_and_answers_like_any_address(): void
    {
        $user=User::factory()->unverified()->create();
        EmailVerificationOtp::create(['user_id'=>$user->id,'digest'=>Hash::make('123456'),'attempts'=>0,'expires_at'=>now()->addMinutes(10),'sent_at'=>now()->subSeconds(10)]);
        Mail::fake();
        $known=$this->postJson('/api/register/resend',['email'=>$user->email])->assertOk()->json();
        $unknown=$this->postJson('/api/register/resend',['email'=>'nobody@example.test'])->assertOk()->json();
        $this->assertSame($known['message'],$unknown['message']);
        $this->assertSame(array_keys($known['data']),array_keys($unknown['data']));
        Mail::assertNothingSent();
        $this->assertSame(1,EmailVerificationOtp::count());
    }

    public function test_email_change_invalidates_old_code_verification_and_sessions(): void
    {
        $owner=User::factory()->role(Role::Owner)->create();
        $patient=User::factory()->create();
        $otp=EmailVerificationOtp::create(['user_id'=>$patient->id,'digest'=>Hash::make('123456'),'attempts'=>0,'expires_at'=>now()->addMinutes(10),'sent_at'=>now()]);
        Sanctum::actingAs($owner);
        $this->patchJson('/api/users/'.$patient->public_id,['email'=>'changed@example.test'])->assertOk();
        $this->assertNull($patient->fresh()->email_verified_at);
        $this->assertNotNull($otp->fresh()->consumed_at);
        $this->assertDatabaseHas('audit_logs',['action'=>'account.updated','auditable_public_id'=>$patient->public_id]);
    }

    public function test_all_account_mutations_reject_non_owner_and_numeric_ids(): void
    {
        $target=User::factory()->create();
        foreach ([Role::Patient,Role::Staff,Role::Dentist] as $role) {
            Sanctum::actingAs(User::factory()->role($role)->create());
            $this->patchJson('/api/users/'.$target->public_id,['email'=>'stolen@example.test'])->assertForbidden();
            $this->deleteJson('/api/users/'.$target->public_id)->assertForbidden();
            $this->getJson('/api/users/'.$target->public_id.'/branch-scopes')->assertForbidden();
            $this->putJson('/api/users/'.$target->public_id.'/branch-scopes',['branch_refs'=>[]])->assertForbidden();
        }
        Sanctum::actingAs(User::factory()->role(Role::Owner)->create());
        $this->patchJson('/api/users/'.$target->id,['email'=>'stolen@example.test'])->assertNotFound();
    }

    public function test_auth_audit_payload_never_contains_password_or_otp(): void
    {
        Mail::fake();
        $this->postJson('/api/register',$this->payload())->assertCreated();
        $code=Mail::sent(\App\Mail\OneTimeCodeMail::class)->first()->code;
        $this->postJson('/api/register/verify',['email'=>'review@example.test','otp'=>$code])->assertOk();
        $this->postJson('/api/login',['email'=>'review@example.test','password'=>'Password123!'])->assertOk(); // verifying does not sign in
        $this->postJson('/api/logout')->assertNoContent();
        $audit=AuditLog::all()->toJson();
        $this->assertStringContainsString('account.email_verified',$audit);
        $this->assertStringContainsString('auth.logout',$audit);
        $this->assertStringNotContainsString('Password123!',$audit);
        $this->assertStringNotContainsString($code,$audit);
    }

    public function test_mail_transport_exception_details_are_not_reported_or_returned(): void
    {
        Mail::shouldReceive('to')->once()->andThrow(new \RuntimeException('SECRET OTP 123456 SMTP PASSWORD hidden'));
        Log::spy();
        $response=$this->postJson('/api/register',$this->payload())->assertCreated();
        $this->assertStringNotContainsString('SECRET',$response->getContent());
        $this->assertStringNotContainsString('SECRET',\App\Models\MailDispatchAttempt::all()->toJson());
        // M18's dispatcher records the failure, with the exception class only (never its message).
        Log::shouldHaveReceived('warning')->with('Mail dispatch failed.', ['purpose' => 'patient_email_verification', 'exception' => \RuntimeException::class])->once();
        Log::shouldNotHaveReceived('error');
    }

    public function test_production_rejects_log_transport_including_failover(): void
    {
        $user=User::factory()->create();
        $this->app->instance('env','production');
        config(['mail.default'=>'failover','mail.mailers.failover'=>['transport'=>'failover','mailers'=>['smtp','log']]]);
        Mail::fake();
        try { app(\App\Services\Mail\MailDispatcher::class)->queueOnce($user->email,new \App\Mail\OneTimeCodeMail('123456','email_verification'),'patient_email_verification',$user); $this->fail('Unsafe transport accepted'); }
        catch (\App\Exceptions\MailTransportUnavailable $e) { $this->assertSame('Account email requires a real mail transport.',$e->getMessage()); }
        finally { $this->app->instance('env','testing'); }
        Mail::assertNothingSent();
    }
}
