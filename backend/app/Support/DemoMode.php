<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/** True only on the separate demo database (scripts/demo-start.sh) outside production: enables the demo clock. */
final class DemoMode
{
    public static function active(): bool
    {
        return ! app()->environment('production') && str_ends_with((string) DB::connection()->getDatabaseName(), '_demo');
    }
}
