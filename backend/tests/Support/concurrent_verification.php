<?php

require __DIR__.'/../../vendor/autoload.php';
require_once __DIR__.'/ScratchDatabaseGuard.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
\Tests\Support\ScratchDatabaseGuard::assertSafe($app);
if (! $app->environment('testing') || $app['db']->connection()->selectOne('select current_database() as name')->name !== 'dental_clinic_scratch') {
    throw new RuntimeException('Refusing to run outside dental_clinic_scratch.');
}
[, $email, $code, $startAt] = $argv;
$request = Illuminate\Http\Request::create('/api/register/verify', 'POST', [], [], [], [
    'HTTP_ACCEPT' => 'application/json', 'HTTP_REFERER' => 'http://localhost:5173', 'CONTENT_TYPE' => 'application/json',
], json_encode(['email' => $email, 'otp' => $code]));
while (microtime(true) < (float) $startAt) usleep(100);
$response = $kernel->handle($request);
echo json_encode(['status' => $response->getStatusCode(), 'code' => json_decode($response->getContent(), true)['code'] ?? null]);
