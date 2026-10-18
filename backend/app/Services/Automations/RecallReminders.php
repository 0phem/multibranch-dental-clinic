<?php

namespace App\Services\Automations;

use App\Models\Appointment;
use App\Models\Visit;
use App\Services\Notifications\NotificationCenter;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * A4 (M20/M18). For each Owner rule "category → months": a patient whose LATEST completed visit in that service category is
 * at least that many months old (Asia/Manila calendar months) and who has no upcoming appointment gets one "time for your
 * check-up" email. The key is that visit, so it is sent at most once per interval; a newer visit starts a new interval. Sent
 * only while the visit's branch is open. Ships off with no rules: the clinic has not given any.
 */
final class RecallReminders implements AutomationJob
{
    public const PURPOSE = 'recall_due';

    public static function key(Visit $visit): string
    {
        return self::PURPOSE.":{$visit->public_id}";
    }

    public static function hasUpcoming(int $patientId, CarbonImmutable $now): bool
    {
        return Appointment::where('patient_id', $patientId)->whereIn('status', Appointment::ACTIVE_STATUSES)->where('starts_at', '>', $now->toIso8601String())->exists();
    }

    public function run(CarbonImmutable $now, array $settings, array $options = []): array
    {
        $counts = ['sent' => 0, 'skipped' => 0];
        $today = ClinicClock::local($now)->toDateString();
        foreach ($settings['rules'] as $rule) {
            // The latest completed visit per patient in this category (the service booked, or the walk-in's requested service).
            $latest = DB::table('visits as v')->leftJoin('appointments as a', 'a.id', '=', 'v.appointment_id')
                ->join('services as s', 's.id', '=', DB::raw('coalesce(v.requested_service_id, a.service_id)'))
                ->where('v.status', 'Completed')->where('s.category', $rule['category'])
                ->selectRaw('distinct on (v.patient_id) v.id')->orderBy('v.patient_id')->orderByDesc('v.clinic_date')->orderByDesc('v.id')->pluck('id');
            foreach (Visit::whereIn('id', $latest)->with(['patient.user', 'branch'])->get() as $visit) {
                $due = ClinicClock::addCalendarMonths(substr((string) $visit->clinic_date, 0, 10), (int) $rule['months']);
                if ($due > $today || ! $visit->branch) continue;
                $hours = $visit->branch->hoursOnDate($today);
                if (! $hours || $now->lessThan(ClinicClock::at($today, $hours['open'])) || $now->greaterThanOrEqualTo(ClinicClock::at($today, $hours['close']))) continue;
                $key = self::key($visit);
                if (AutomationLog::done($key) || self::hasUpcoming($visit->patient_id, $now)) continue;
                [$user, $reason] = Recipient::patient($visit->patient);
                if ($user) app(NotificationCenter::class)->recallDue($visit, $rule['category'], $key);
                if ($reason) {
                    if (AutomationLog::skip('recall', $key, $reason, $visit, $visit->branch_id)) $counts['skipped']++;
                    continue;
                }
                if (AutomationLog::queueEmail('recall', $key, self::PURPOSE, $visit, null, $user, $visit->branch_id)) $counts['sent']++;
            }
        }

        return $counts;
    }
}
