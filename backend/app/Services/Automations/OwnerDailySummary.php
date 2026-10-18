<?php

namespace App\Services\Automations;

use App\Models\User;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;

/**
 * A6 (M21/M18). Once per clinic day, at `send_time` (Asia/Manila), each active Owner gets the day's numbers per branch. The
 * outbox renders the numbers again when it sends, so they are as of the send. If every branch was closed with no activity,
 * nothing is sent that day. The subject revision carries the date (YYYYMMDD) so the email can be rebuilt from records.
 */
final class OwnerDailySummary implements AutomationJob
{
    public const PURPOSE = 'owner_daily_summary';

    public static function key(User $owner, string $date): string
    {
        return self::PURPOSE.":{$owner->public_id}:$date";
    }

    public function run(CarbonImmutable $now, array $settings, array $options = []): array
    {
        $counts = ['sent' => 0, 'skipped' => 0];
        $date = ClinicClock::local($now)->toDateString();
        if ($now->lessThan(ClinicClock::at($date, $settings['send_time']))) return $counts;
        $owners = User::where('role', 'owner')->where('account_status', 'Active')->whereNull('deleted_at')->get();
        $data = null;
        foreach ($owners as $owner) {
            $key = self::key($owner, $date);
            if (AutomationLog::done($key)) continue;
            $data ??= OwnerSummaryData::forDate($date);
            $reason = $data['branches'] === [] ? 'all_branches_closed_no_activity' : (Recipient::deliverable($owner->email) ? null : 'undeliverable_address');
            if ($reason) {
                if (AutomationLog::skip('owner_summary', $key, $reason, $owner)) $counts['skipped']++;
                continue;
            }
            if (AutomationLog::queueEmail('owner_summary', $key, self::PURPOSE, $owner, (int) str_replace('-', '', $date), $owner, null)) $counts['sent']++;
        }

        return $counts;
    }
}
