<?php

namespace Tests\Support;

final class ScratchDatabaseGuard
{
    public static function assertSafe($app): void
    {
        if (! $app->environment('testing')) {
            throw new \RuntimeException('Refusing database work outside the testing environment.');
        }

        $config = $app['config'];

        if ($config->get('database.default') !== 'pgsql') {
            throw new \RuntimeException('Refusing test work: the default connection must be pgsql.');
        }

        $pg = $config->get('database.connections.pgsql', []);

        if (
            ($pg['database'] ?? null) !== 'dental_clinic_scratch' ||
            ($pg['host'] ?? null) !== '127.0.0.1' ||
            (string) ($pg['port'] ?? '') !== '5432' ||
            ! in_array($pg['url'] ?? null, [null, ''], true)
        ) {
            throw new \RuntimeException(
                'Refusing test work: PostgreSQL must target local dental_clinic_scratch on 127.0.0.1:5432.'
            );
        }

        // Connect only after the environment and configured target pass validation.
        $row = $app['db']->connection('pgsql')->selectOne(
            'SELECT current_database() AS database_name,
                    host(inet_server_addr()) AS server_address,
                    inet_server_port() AS server_port'
        );

        if (
            ($row->database_name ?? null) !== 'dental_clinic_scratch' ||
            ($row->server_address ?? null) !== '127.0.0.1' ||
            (int) ($row->server_port ?? 0) !== 5432
        ) {
            throw new \RuntimeException(
                'Refusing test work: the actual PostgreSQL server identity did not match the approved scratch target.'
            );
        }
    }
}
