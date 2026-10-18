<?php

namespace App\Services\Automations;

use Carbon\CarbonImmutable;

/**
 * One scheduled automation. `run` is called every minute by `automations:run` with the real time ($now); it must be idempotent
 * (AutomationLog keys) so it can run any number of times. Options are used only by tests and the demo clock:
 *   appointment_id / invoice_id   limit the run to one record;
 *   ignore_lead_rule              the demo clock pretends the appointment was booked before its reminder time.
 *
 * @return array<string, int> counts of what this run did (sent, skipped, flagged, notified, cleared, expired)
 */
interface AutomationJob
{
    public function run(CarbonImmutable $now, array $settings, array $options = []): array;
}
