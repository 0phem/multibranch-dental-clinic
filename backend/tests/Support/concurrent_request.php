<?php

// Child process for concurrency tests: boots its own application (its own database connection), waits for a shared
// start instant, then sends one real JSON POST through the HTTP kernel with a Sanctum token and optional headers.
// Usage: php concurrent_request.php <bearer-token> <path> <json-payload> <start-at-unix-microtime> [<json-headers>]

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';

[, $token, $path, $payload, $startAt] = $argv;
$headers = json_decode($argv[5] ?? '{}', true) ?: [];
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
$server = ['HTTP_AUTHORIZATION' => 'Bearer '.$token, 'HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'];
foreach ($headers as $name => $value) {
    $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
}
$request = Illuminate\Http\Request::create($path, 'POST', [], [], [], $server, $payload);

while (microtime(true) < (float) $startAt) {
    usleep(100);
}

$response = $kernel->handle($request);
echo json_encode(['status' => $response->getStatusCode(), 'body' => json_decode($response->getContent(), true)]);
