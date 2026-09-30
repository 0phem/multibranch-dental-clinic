<?php

namespace Tests\Feature\Auth;

use App\Mail\PatientEmailVerificationOtp;
use App\Models\EmailVerificationOtp;
use App\Models\User;
use Carbon\Carbon;
use RuntimeException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Jamie', 'last_name' => 'Cruz', 'email' => 'jamie@example.com',
            'phone' => '+14155550123', 'password' => 'Passw0rd!', 'password_confirmation' => 'Passw0rd!',
        ], $overrides);
    }

    private function register(array $overrides = []): array
    {
        Mail::fake();
        $response = $this->postJson('/api/register', $this->payload($overrides))->assertCreated();
        $code = null;
        Mail::assertSent(PatientEmailVerificationOtp::class, function (PatientEmailVerificationOtp $mail) use (&$code): bool {
            $code = $mail->code;
            return true;
        });

        return [$response->json('data'), $code, User::where('email', strtolower($this->payload($overrides)['email']))->firstOrFail()];
    }

    public function test_registration_sends_hashed_otp_without_returning_it_and_accepts_alternate_country_code(): void
    {
        [$data, $code, $user] = $this->register();

        $this->assertSame('patient', $data['role']);
        $this->assertTrue($data['verification_required']);
        $this->assertArrayNotHasKey('otp', $data);
        $otp = EmailVerificationOtp::firstOrFail();
        $this->assertNotSame($code, $otp->digest);
        $this->assertTrue(Hash::check($code, $otp->digest));
        $this->assertNull($user->email_verified_at);
        $this->assertNull(session('login_web_'.$user->id));
    }

    public function test_correct_otp_verifies_once_and_logs_in_patient(): void
    {
        [, $code, $user] = $this->register();
        $sessionBeforeVerification = $this->app['session']->getId();

        $this->postJson('/api/register/verify', ['email' => $user->email, 'otp' => $code])
            ->assertOk()->assertJsonPath('data.email', $user->email);
        $this->assertNotSame($sessionBeforeVerification, $this->app['session']->getId());
        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->getJson('/api/me')->assertOk()->assertJsonPath('data.email', $user->email);
        $this->postJson('/api/register/verify', ['email' => $user->email, 'otp' => $code])->assertStatus(422)->assertJsonPath('code', 'already_verified');
    }

    public function test_wrong_expired_and_exhausted_otps_are_rejected(): void
    {
        [, $code, $user] = $this->register();
        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/register/verify', ['email' => $user->email, 'otp' => '000000'])->assertStatus(422)->assertJsonPath('code', 'invalid_otp');
        }
        $this->postJson('/api/register/verify', ['email' => $user->email, 'otp' => '000000'])->assertStatus(422)->assertJsonPath('code', 'otp_attempt_limit');
        $this->assertNotNull(EmailVerificationOtp::first()->fresh()->consumed_at);
        $this->assertNull($user->fresh()->email_verified_at);

        [, $code, $user] = $this->register(['email' => 'expired@example.com', 'phone' => '+639171234567', 'first_name' => 'Expired']);
        EmailVerificationOtp::where('user_id', $user->id)->update(['expires_at' => now()->subMinute()]);
        $this->postJson('/api/register/verify', ['email' => $user->email, 'otp' => $code])->assertStatus(422)->assertJsonPath('code', 'otp_expired');
    }

    public function test_resend_invalidates_previous_code_and_enforces_cooldown(): void
    {
        [$data, $oldCode, $user] = $this->register();
        RateLimiter::clear('email-otp-resend:'.sha1($user->email.'|'.$this->app['request']->ip()));
        $this->postJson('/api/register/resend', ['email' => $user->email])->assertStatus(429)->assertJsonPath('code', 'otp_resend_cooldown');
        Carbon::setTestNow(now()->addSeconds(61));
        Mail::fake();
        $this->postJson('/api/register/resend', ['email' => $user->email])->assertOk();
        $newCode = null;
        Mail::assertSent(PatientEmailVerificationOtp::class, function (PatientEmailVerificationOtp $mail) use (&$newCode): bool {
            $newCode = $mail->code;
            return true;
        });
        $rows = EmailVerificationOtp::where('user_id', $user->id)->latest('id')->get();
        $this->assertCount(2, $rows);
        $this->assertNotSame($oldCode, $newCode);
        $this->assertNotNull($rows[1]->consumed_at);
        $this->assertTrue(Hash::check($newCode, $rows[0]->digest));
        Carbon::setTestNow();
        $this->assertTrue($data['verification_required']);
    }

    public function test_resend_rate_limit_blocks_excessive_requests(): void
    {
        [, , $user] = $this->register();
        $key = 'email-otp-resend:'.sha1($user->email.'|'.$this->app['request']->ip());
        RateLimiter::clear($key);
        Carbon::setTestNow(now()->addSeconds(61));

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/register/resend', ['email' => $user->email])->assertOk();
            Carbon::setTestNow(now()->addSeconds(61));
        }

        $this->postJson('/api/register/resend', ['email' => $user->email])
            ->assertStatus(429)
            ->assertJsonPath('code', 'otp_rate_limited');
        Carbon::setTestNow();
    }

    public function test_unverified_patient_login_is_blocked_but_verified_patient_can_login(): void
    {
        [, , $user] = $this->register();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Passw0rd!'])->assertStatus(422)->assertJsonPath('code', 'email_verification_required');
        $user->forceFill(['email_verified_at' => now()])->save();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Passw0rd!'])->assertOk();
    }

    public function test_mail_failure_is_not_reported_as_successful_registration(): void
    {
        Mail::shouldReceive('to')->once()->andThrow(new RuntimeException('smtp unavailable'));
        $this->postJson('/api/register', $this->payload(['email' => 'mail-failure@example.com']))
            ->assertStatus(503)->assertJsonPath('code', 'email_delivery_failed');
        $this->assertNull(User::where('email', 'mail-failure@example.com')->first()->email_verified_at);
    }
}
