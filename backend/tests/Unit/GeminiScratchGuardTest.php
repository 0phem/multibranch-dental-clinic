<?php

namespace Tests\Unit;

use Illuminate\Config\Repository;
use Illuminate\Foundation\Application;
use PHPUnit\Framework\TestCase;
use Tests\Support\ScratchDatabaseGuard;

require_once __DIR__.'/../Support/ScratchDatabaseGuard.php';

class GeminiScratchGuardTest extends TestCase
{
    private string|false $previousAddress;

    protected function setUp(): void
    {
        $this->previousAddress = getenv('TEST_SCRATCH_SERVER_ADDRESS');
        putenv('TEST_SCRATCH_SERVER_ADDRESS');
    }

    protected function tearDown(): void
    {
        putenv($this->previousAddress === false ? 'TEST_SCRATCH_SERVER_ADDRESS' : 'TEST_SCRATCH_SERVER_ADDRESS='.$this->previousAddress);
    }

    private function application(string $database = 'dental_clinic_scratch', string $address = '127.0.0.1', bool $connect = true): Application
    {
        $app = new Application();
        $app->instance('env', 'testing');
        $app->instance('config', new Repository(['database' => ['default' => 'pgsql', 'connections' => ['pgsql' => [
            'database' => $database, 'host' => '127.0.0.1', 'port' => 5432, 'url' => null,
        ]]]]));
        $manager = $this->createMock(\Illuminate\Database\DatabaseManager::class);
        if ($connect) {
            $connection = $this->createMock(\Illuminate\Database\PostgresConnection::class);
            $connection->expects($this->once())->method('selectOne')->willReturn((object) [
                'database_name' => 'dental_clinic_scratch', 'server_address' => $address, 'server_port' => 5432,
            ]);
            $manager->expects($this->once())->method('connection')->with('pgsql')->willReturn($connection);
        } else {
            $manager->expects($this->never())->method('connection');
        }
        $app->instance('db', $manager);
        return $app;
    }

    public function test_default_still_requires_loopback_server_identity(): void
    {
        $this->expectException(\RuntimeException::class);
        ScratchDatabaseGuard::assertSafe($this->application(address: '172.17.0.2'));
    }

    public function test_explicit_verified_container_address_is_accepted(): void
    {
        putenv('TEST_SCRATCH_SERVER_ADDRESS=172.17.0.2');
        ScratchDatabaseGuard::assertSafe($this->application(address: '172.17.0.2'));
    }

    public function test_container_override_cannot_authorize_protected_database(): void
    {
        putenv('TEST_SCRATCH_SERVER_ADDRESS=172.17.0.2');
        $this->expectException(\RuntimeException::class);
        ScratchDatabaseGuard::assertSafe($this->application(database: 'dental_clinic', connect: false));
    }

    public function test_mismatched_container_identity_is_rejected(): void
    {
        putenv('TEST_SCRATCH_SERVER_ADDRESS=172.17.0.2');
        $this->expectException(\RuntimeException::class);
        ScratchDatabaseGuard::assertSafe($this->application(address: '172.17.0.3'));
    }
}
