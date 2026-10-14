<?php

namespace Tests\Feature\Console;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** The pre-defense check prints PASS / WARN / FAIL with what to do by hand, and never prints a key or secret. */
class DemoCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_reports_failures_with_instructions_and_never_prints_secrets(): void
    {
        config(['services.paymongo.secret_key' => 'sk_test_SECRET_SENTINEL', 'services.paymongo.public_key' => 'pk_test_PUBLIC_SENTINEL',
            'services.paymongo.webhook_secret' => 'whsk_SENTINEL', 'services.paymongo.mode' => 'test', 'services.paymongo.base_url' => 'https://api.paymongo.com',
            'mail.mailers.smtp.password' => 'SMTP_SENTINEL', 'mail.default' => 'log']);
        Http::fake([
            'https://api.paymongo.com/v1/webhooks' => Http::response(['data' => [['attributes' => ['url' => 'https://old-tunnel.example/api/webhooks/paymongo',
                'events' => ['checkout_session.payment.paid'], 'status' => 'enabled']]]], 200),
            'https://new-tunnel.example/up' => Http::response('', 200),
            'https://new-tunnel.example/api/webhooks/paymongo' => Http::response(['message' => 'Invalid or missing webhook signature.'], 400),
            '*' => Http::response('', 500),
        ]);

        $exit = Artisan::call('demo:check', ['--tunnel' => 'new-tunnel.example']);
        $output = Artisan::output();

        $this->assertSame(1, $exit, 'any FAIL makes the command fail');
        $this->assertStringContainsString('PASS  PayMongo accepted the test secret key', $output);
        $this->assertStringContainsString('PASS  Tunnel https://new-tunnel.example reaches the API', $output);
        // The registered webhook points at an old tunnel: FAIL, with the exact URL to register by hand.
        $this->assertStringContainsString('FAIL  No enabled PayMongo webhook for https://new-tunnel.example/api/webhooks/paymongo (registered: https://old-tunnel.example/api/webhooks/paymongo (enabled))', $output);
        $this->assertStringContainsString('Developers → Webhooks', $output);
        $this->assertStringContainsString("FAIL  Mail goes to 'log' only", $output);
        $this->assertStringContainsString('FAIL  Only 0 patient(s)', $output);
        foreach (['SECRET_SENTINEL', 'PUBLIC_SENTINEL', 'whsk_SENTINEL', 'SMTP_SENTINEL'] as $secret) $this->assertStringNotContainsString($secret, $output);
    }
}
