<?php

namespace App\Services\Automations;

use App\Models\FollowupTask;
use App\Services\Notifications\NotificationCenter;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;

/**
 * M20 optional reminder: once per follow-up task, when it is due (or the Owner's number of days before, Asia/Manila dates), it is
 * still Open or Contacted and the patient has no upcoming appointment, the patient gets "Time to book your follow-up visit" in
 * the Owner- and Dentist-approved wording (no health advice) and an in-app notice. Sent only while that branch is open. Ships off.
 */
final class FollowupReminders implements AutomationJob
{
    public const PURPOSE = 'followup_due';

    public static function key(FollowupTask $task): string
    {
        return self::PURPOSE.":{$task->public_id}";
    }

    public function run(CarbonImmutable $now, array $settings, array $options = []): array
    {
        $counts = ['sent' => 0, 'skipped' => 0];
        $today = ClinicClock::local($now)->toDateString();
        $until = ClinicClock::addDays($today, (int) ($settings['days_before'] ?? 0));
        $tasks = FollowupTask::whereIn('status', FollowupTask::OPEN)->where('due_on', '<=', $until)->with(['patient.user', 'patient.person', 'branch'])->orderBy('due_on')->limit(500)->get();
        foreach ($tasks as $task) {
            $hours = $task->branch?->hoursOnDate($today);
            if (! $hours || $now->lessThan(ClinicClock::at($today, $hours['open'])) || $now->greaterThanOrEqualTo(ClinicClock::at($today, $hours['close']))) continue;
            $key = self::key($task);
            if (AutomationLog::done($key) || RecallReminders::hasUpcoming($task->patient_id, $now)) continue;
            [$user, $reason] = Recipient::patient($task->patient);
            if ($user) app(NotificationCenter::class)->followupDue($task, $key);
            if ($reason) {
                if (AutomationLog::skip('followup_reminders', $key, $reason, $task, $task->branch_id)) $counts['skipped']++;
                continue;
            }
            if (AutomationLog::queueEmail('followup_reminders', $key, self::PURPOSE, $task, null, $user, $task->branch_id)) $counts['sent']++;
        }

        return $counts;
    }
}
