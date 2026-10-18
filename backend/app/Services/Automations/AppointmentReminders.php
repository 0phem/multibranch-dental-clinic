<?php

namespace App\Services\Automations;

use App\Models\Appointment;
use App\Models\AppointmentHistory;
use App\Services\Notifications\NotificationCenter;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;

/**
 * A1 (M6/M18). One email `lead_minutes` before the visit (60 by default: interview R2-09), and when switched on, one 24 hours
 * before ("day_before") and one on the morning of the visit at `morning_time` (Asia/Manila). Each carries one-click "I'll be
 * there" and "I can't make it" links (F1). The key holds the appointment REVISION, so a rescheduled appointment gets a new,
 * recalculated reminder and the outbox drops the old one as superseded; a cancelled, past or checked-in appointment gets none.
 * A reminder is skipped when the current booking was made after its send time (the confirmation email covers it).
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
        $local = ClinicClock::local($now);
        $today = $local->toDateString();
        $morningAt = ClinicClock::at($today, $settings['morning_time']);
        // kind => minutes before the start
        $leads = ['lead' => (int) $settings['lead_minutes']] + ($settings['day_before'] ? ['day' => 24 * 60] : []);
        $horizon = max($now->addMinutes(max($leads)), $local->endOfDay());
        $query = Appointment::query()->whereIn('status', ['Pending', 'Confirmed'])
            ->where('starts_at', '>', $now->toIso8601String())->where('starts_at', '<=', $horizon->toIso8601String())
            ->whereDoesntHave('visit')->with(['patient.person', 'patient.user', 'branch'])->orderBy('starts_at');
        if (! empty($options['appointment_id'])) $query->whereKey($options['appointment_id']);
        $only = $options['kind'] ?? null;
        $counts = ['sent' => 0, 'skipped' => 0];

        foreach ($query->get() as $appointment) {
            $start = CarbonImmutable::instance($appointment->starts_at);
            $bookedAt = $this->bookedAt($appointment);
            foreach ($leads as $kind => $minutes) {
                if ($only && $only !== $kind) continue;
                $sendAt = $start->subMinutes($minutes);
                // The 24-hour reminder is not sent once the shorter one is due (it would arrive at the same time).
                if ($kind === 'day' && $start->subMinutes($leads['lead'])->lessThanOrEqualTo($now)) continue;
                if ($sendAt->lessThanOrEqualTo($now)) {
                    $tooLate = $bookedAt->greaterThan($sendAt) && empty($options['ignore_lead_rule']);
                    $this->remind($appointment, $kind, $tooLate ? 'booked_within_lead_time' : null, $counts);
                }
            }
            // The morning reminder is skipped when the shorter reminder is due by then anyway (two emails at once).
            if (! $only && $settings['morning_of'] && ClinicClock::local($start)->toDateString() === $today && $now->greaterThanOrEqualTo($morningAt) && $start->greaterThan($morningAt)
                && $start->subMinutes($leads['lead'])->greaterThan($morningAt)) {
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
