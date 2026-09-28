<?php

// Child process for ConcurrentBookingTest: boots its own application (its own database connection), waits for a
// shared start instant, then sends one real POST /api/appointments through the HTTP kernel with a Sanctum token.
// Usage: php concurrent_booking.php <bearer-token> <json-payload> <start-at-unix-microtime>

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';

[, $token, $payload, $startAt] = $argv;
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
$request = Illuminate\Http\Request::create('/api/appointments', 'POST', [], [], [], [
    'HTTP_AUTHORIZATION' => 'Bearer '.$token,
    'HTTP_ACCEPT' => 'application/json',
    'CONTENT_TYPE' => 'application/json',
], $payload);

while (microtime(true) < (float) $startAt) {
    usleep(100);
}

$response = $kernel->handle($request);
echo json_encode(['status' => $response->getStatusCode(), 'body' => json_decode($response->getContent(), true)]);
