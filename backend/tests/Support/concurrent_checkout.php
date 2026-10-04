<?php

// Child process for the checkout concurrency test: like concurrent_request.php but the payment provider is faked in-process
// (slowly, to widen the race window) so no real network call is ever made.
// Usage: php concurrent_checkout.php <bearer-token> <path> <start-at-unix-microtime> <session-id>

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';

[, $token, $path, $startAt, $sessionId] = $argv;
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
config(['services.paymongo.secret_key' => 'sk_test_unit_secret', 'services.paymongo.webhook_secret' => 'whsec_unit_test_secret', 'services.paymongo.mode' => 'test', 'services.paymongo.payment_method_types' => 'gcash', 'services.paymongo.base_url' => 'https://api.paymongo.com', 'app.frontend_url' => 'http://localhost:5173']);
Illuminate\Support\Facades\Http::fake(['https://api.paymongo.com/v2/checkout_sessions' => function () use ($sessionId) {
    usleep(400000);

    return Illuminate\Support\Facades\Http::response(['data' => ['id' => $sessionId.'_'.getmypid(), 'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/'.$sessionId, 'livemode' => false]]], 200);
}]);
$request = Illuminate\Http\Request::create($path, 'POST', [], [], [], ['HTTP_AUTHORIZATION' => 'Bearer '.$token, 'HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'], '{}');
while (microtime(true) < (float) $startAt) {
    usleep(100);
}
$response = $kernel->handle($request);
echo json_encode(['status' => $response->getStatusCode(), 'body' => json_decode($response->getContent(), true)]);
