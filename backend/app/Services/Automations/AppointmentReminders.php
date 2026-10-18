<?php

namespace App\Services\Automations;

use App\Models\Appointment;
use App\Models\AppointmentHistory;
use App\Services\Notifications\NotificationCenter;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;

/**
 * A1 (M6/M18, PI-31: the front desk reminds every patient today). One email `hours_before` the visit and, when switched on, a
 * second one on the morning of the visit at `morning_time` (Asia/Manila). The key holds the appointment REVISION, so a
 * rescheduled appointment gets a new, recalculated reminder and the outbox drops the old one as superseded; a cancelled, past
 * or checked-in appointment gets none.
 */
final class AppointmentReminders implements AutomationJob
{
    public const PURPOSE = 'appointment_reminder';

    public static function key(Appointment $appointment, string $kind): string
    {
        return self::PURPOSE.":{$appointment->public_id}:r{$appointment->revision}:$kind";
    }

    public function run(CarbonImmutable $now, array $settings, array $options = []): array
    {
        $lead = (int) $settings['hours_before'];
        $local = ClinicClock::local($now);
        $today = $local->toDateString();
        $morningAt = ClinicClock::at($today, $settings['morning_time']);
        // Due now or earlier: the lead reminder of visits starting within `lead` hours, and today's morning-of reminder.
        $horizon = max($now->addHours($lead), $local->endOfDay());
        $query = Appointment::query()->whereIn('status', ['Pending', 'Confirmed'])
            ->where('starts_at', '>', $now->toIso8601String())->where('starts_at', '<=', $horizon->toIso8601String())
            ->whereDoesntHave('visit')->with(['patient.person', 'patient.user', 'branch'])->orderBy('starts_at');
        if (! empty($options['appointment_id'])) $query->whereKey($options['appointment_id']);
        $counts = ['sent' => 0, 'skipped' => 0];

        foreach ($query->get() as $appointment) {
            $start = CarbonImmutable::instance($appointment->starts_at);
            $bookedAt = $this->bookedAt($appointment);
            if ($start->subHours($lead)->lessThanOrEqualTo($now)) {
                $tooLate = $start->diffInMinutes($bookedAt, true) < $lead * 60 && empty($options['ignore_lead_rule']);
                $this->remind($appointment, 'lead', $tooLate ? 'booked_within_lead_time' : null, $counts);
            }
            if ($settings['morning_of'] && ClinicClock::local($start)->toDateString() === $today && $now->greaterThanOrEqualTo($morningAt) && $start->greaterThan($morningAt)) {
                $this->remind($appointment, 'morning', $bookedAt->greaterThanOrEqualTo($morningAt) && empty($options['ignore_lead_rule']) ? 'booked_after_morning_reminder' : null, $counts);
            }
        }

        return $counts;
    }

    /** When the CURRENT version of the appointment was booked or last moved (its history row for this revision). */
    private function bookedAt(Appointment $appointment): CarbonImmutable
    {
        $at = AppointmentHistory::where('appointment_id', $appointment->id)->where('revision', $appointment->revision)->min('occurred_at');

        return $at ? CarbonImmutable::parse($at) : CarbonImmutable::instance($appointment->created_at);
    }

    private function remind(Appointment $appointment, string $kind, ?string $skip, array &$counts): void
    {
        $key = self::key($appointment, $kind);
        if (AutomationLog::done($key)) return;
        if (! $skip && ! $appointment->branch?->hoursOnDate(ClinicClock::local($appointment->starts_at)->toDateString())) $skip = 'branch_closed';
        if ($skip) {
            if (AutomationLog::skip('appointment_reminders', $key, $skip, $appointment, $appointment->branch_id)) $counts['skipped']++;

            return;
        }
        [$user, $reason] = Recipient::patient($appointment->patient);
        if ($user) app(NotificationCenter::class)->appointmentReminder($appointment, $key);
        if ($reason) {
            if (AutomationLog::skip('appointment_reminders', $key, $reason, $appointment, $appointment->branch_id)) $counts['skipped']++;

            return;
        }
        if (AutomationLog::queueEmail('appointment_reminders', $key, self::PURPOSE, $appointment, $appointment->revision, $user, $appointment->branch_id)) $counts['sent']++;
    }
}
