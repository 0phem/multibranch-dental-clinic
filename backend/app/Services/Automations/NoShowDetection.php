<?php

namespace App\Services\Automations;

use App\Models\Appointment;
use App\Models\NoShowFlag;
use App\Models\User;
use App\Services\Appointments\AppointmentService;
use App\Services\Audit\AuditService;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A2 (M6/M8). After `grace_minutes` past the start, a booked appointment of TODAY (Asia/Manila) with no check-in is flagged as a
 * possible no-show for the front desk. The flag never changes the appointment: a person confirms it through the existing
 * No-show command (same-day, pre-arrival only) or undoes it. A flag whose appointment was checked in, moved or cancelled is
 * cleared by the next run. When "rebook_email" is on, a confirmed no-show gets one friendly "book a new time" email.
 */
final class NoShowDetection implements AutomationJob
{
    public const REBOOK_PURPOSE = 'no_show_rebook';

    public function run(CarbonImmutable $now, array $settings, array $options = []): array
    {
        $counts = ['flagged' => 0, 'cleared' => 0];
        $local = ClinicClock::local($now);
        $dayStart = $local->startOfDay();
        $cutoff = $now->subMinutes((int) $settings['grace_minutes']);
        $query = Appointment::query()->whereIn('status', ['Pending', 'Confirmed'])->whereDoesntHave('visit')
            ->where('starts_at', '>=', $dayStart->toIso8601String())->where('starts_at', '<=', $cutoff->toIso8601String())
            ->whereNotExists(fn ($q) => $q->from('no_show_flags')->whereColumn('no_show_flags.appointment_id', 'appointments.id'));
        if (! empty($options['appointment_id'])) $query->whereKey($options['appointment_id']);
        foreach ($query->get() as $appointment) {
            $flag = NoShowFlag::firstOrCreate(['appointment_id' => $appointment->id], ['branch_id' => $appointment->branch_id,
                'appointment_revision' => $appointment->revision, 'status' => 'open', 'flagged_at' => $now]);
            if ($flag->wasRecentlyCreated && AutomationLog::record('no_show', "no_show_flag:{$appointment->public_id}", 'flagged', null, $appointment, $appointment->branch_id)) $counts['flagged']++;
        }
        // The patient arrived late, or the booking changed: the hint is no longer true.
        foreach (NoShowFlag::where('status', 'open')->with('appointment')->get() as $flag) {
            $a = $flag->appointment;
            if (! $a || ! in_array($a->status, ['Pending', 'Confirmed'], true) || $a->revision !== $flag->appointment_revision || $a->visit()->exists()) {
                $flag->update(['status' => 'cleared', 'resolved_at' => $now]);
                $counts['cleared']++;
            }
        }

        return $counts;
    }

    /** Front desk: confirm the possible no-show through the existing No-show command, then close the flag. */
    public function confirm(NoShowFlag $flag, User $actor): NoShowFlag
    {
        $this->open($flag);
        $appointment = $flag->appointment;
        if ($appointment->revision !== $flag->appointment_revision) throw ValidationException::withMessages(['flag' => ['This appointment changed after it was flagged. Refresh the list.']]);
        $response = app(AppointmentService::class)->transition($actor, $appointment, 'no-show', ['expected_revision' => $appointment->revision], null);
        if ($response->getStatusCode() >= 300) throw ValidationException::withMessages(['flag' => ['The appointment could not be marked No-show.']]);

        return DB::transaction(function () use ($flag, $actor) {
            $flag->update(['status' => 'confirmed', 'resolved_at' => ClinicClock::now(), 'resolved_by_user_id' => $actor->id]);
            $appointment = $flag->appointment->fresh(['patient.user', 'branch']);
            app(AuditService::class)->recordAdministrative('automation.no_show_confirmed', $actor, $appointment, ['automation' => 'no_show']);
            $setting = AutomationCatalog::setting('no_show');
            if ($setting?->enabled && ($setting->settings['rebook_email'] ?? false)) {
                $key = self::REBOOK_PURPOSE.":{$appointment->public_id}";
                [$user, $reason] = Recipient::patient($appointment->patient);
                if ($user) app(\App\Services\Notifications\NotificationCenter::class)->noShowRebook($appointment, $key);
                $reason ? AutomationLog::skip('no_show', $key, $reason, $appointment, $appointment->branch_id)
                    : AutomationLog::queueEmail('no_show', $key, self::REBOOK_PURPOSE, $appointment, $appointment->revision, $user, $appointment->branch_id);
            }

            return $flag->fresh();
        });
    }

    /** Front desk: the patient did come, or it was a mistake. The appointment is not changed. */
    public function dismiss(NoShowFlag $flag, User $actor): NoShowFlag
    {
        $this->open($flag);
        $flag->update(['status' => 'dismissed', 'resolved_at' => ClinicClock::now(), 'resolved_by_user_id' => $actor->id]);
        app(AuditService::class)->recordAdministrative('automation.no_show_dismissed', $actor, $flag->appointment, ['automation' => 'no_show']);

        return $flag->fresh();
    }

    private function open(NoShowFlag $flag): void
    {
        if ($flag->status !== 'open') throw ValidationException::withMessages(['flag' => ['This flag was already resolved.']]);
    }
}
