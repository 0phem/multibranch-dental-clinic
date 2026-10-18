<?php

namespace App\Services\Automations;

use App\Models\AutomationSetting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Runs the scheduled automations (`automations:run`, every minute from the scheduler). An automation that is off, whose
 * setting row is missing or whose email wording is not approved, does nothing. One failing automation is reported and never stops the others. `last_run_at` always
 * records the REAL time of the run, even when the demo clock simulates a later one.
 */
final class AutomationRunner
{
    /** @return array<string, array> per automation: ['enabled' => bool, ...counts] or ['error' => class] */
    public function run(?CarbonImmutable $now = null, array $only = [], array $options = []): array
    {
        $real = CarbonImmutable::now();
        $now ??= $real;
        $results = [];
        foreach (AutomationCatalog::JOBS as $key => $class) {
            if ($only && ! in_array($key, $only, true)) continue;
            $setting = AutomationSetting::find($key);
            if (! $setting) { $results[$key] = ['enabled' => false, 'missing' => true]; continue; }
            if (! $setting->enabled) { $results[$key] = ['enabled' => false]; continue; }
            // Defense in depth: switching on already requires approved wording (R2-09); never send unapproved text.
            if (MessageTemplates::unapprovedFor($key)) { $results[$key] = ['enabled' => true, 'blocked' => 'wording_not_approved']; continue; }
            try {
                $results[$key] = ['enabled' => true] + app($class)->run($now, $setting->settings, $options);
            } catch (\Throwable $e) {
                report($e);
                $results[$key] = ['enabled' => true, 'error' => $e::class];
            }
            DB::table('automation_settings')->where('key', $key)->update(['last_run_at' => $real->toIso8601String()]);
        }

        return $results;
    }
}
