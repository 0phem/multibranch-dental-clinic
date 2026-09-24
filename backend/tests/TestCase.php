<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Simulates a request from the future Vite SPA (Backend Foundation 1B) so Sanctum's
        // EnsureFrontendRequestsAreStateful middleware recognizes the request as stateful and starts a real
        // session, exactly as it will for the browser-based frontend later. See SANCTUM_STATEFUL_DOMAINS in
        // .env.testing.example.
        $this->withHeader('Referer', 'http://localhost:5173');
    }
}
