<?php

namespace App\Services\Scheduling;

use App\Models\Appointment;
use App\Models\MailDispatch;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Automations\MessageTemplates;
use App\Services\Automations\Recipient;
use App\Services\Mail\MailOutbox;
use App\Services\Notifications\NotificationCenter;
use App\Support\ClinicClock;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * M3/M15: appointments a schedule change, a day off or approved leave left without their dentist. Shared by both modules and
 * modelled on the F5 closed-date flow: the front desk sees the list with suggested cover (another dentist at the same branch,
 * authorized for the service and free at the same time) and can email those patients a reschedule link in one action. Nothing is
 * cancelled or moved here; moving to a cover dentist is the normal reschedule command, done by Staff.
 */
final class ScheduleNotices
{
    public const TEMPLATE = 'dentist_unavailable_notice';

    /** True when the appointment's dentist still cannot see it at its time (re-checked just before an email is sent). */
    public static function stillAffected(Appointment $a): bool
    {
        $a->loadMissing(['dentist', 'branch']);
        if (! $a->dentist || ! $a->branch) return false;
        $local = ClinicClock::local($a->starts_at);
        $start = $local->hour * 60 + $local->minute;

        return ! (new WorkSchedules)->fits($a->dentist, $a->branch, $local->toDateString(), $start, $start + (int) $a->duration_minutes);
    }

    /** @return list<array{id:string,name:string}> other dentists who could take this appointment at the same time */
    public static function cover(Appointment $a): array
    {
        $a->loadMissing(['branch', 'service', 'patient']);
        $scheduling = app(SchedulingService::class);
        $local = ClinicClock::local($a->starts_at);
        $request = new SlotRequest($a->patient, $a->branch, $a->service, null, $local->toDateString(), $local->format('H:i'), false, $a->id);

        return $scheduling->eligibleDentists($a->branch, $a->service)->reject(fn ($d) => $d->id === $a->dentist_profile_id)
            ->filter(fn ($d) => $scheduling->evaluate($request->withDentist($d))->valid)
            ->map(fn ($d) => ['id' => $d->legacy_ref, 'name' => 'Dr. '.trim($d->person?->first_name.' '.$d->person?->last_name)])->values()->all();
    }

    public static function view(Appointment $a): array
    {
        $local = ClinicClock::local($a->starts_at);

        return ['id' => $a->public_id, 'code' => $a->appointment_code, 'revision' => $a->revision, 'date' => $local->toDateString(), 'time' => $local->format('g:i A'),
            'start_time' => $local->format('H:i'), 'patient' => trim(($a->patient?->person?->first_name ?? '').' '.($a->patient?->person?->last_name ?? '')),
            'branch' => $a->branch?->name, 'service' => $a->service?->name, 'cover' => self::cover($a),
            'notified' => MailDispatch::where('dedupe_key', self::key($a))->exists() || UserNotification::where('dedupe_key', self::key($a))->exists()];
    }

    public static function key(Appointment $a): string
    {
        return self::TEMPLATE.":{$a->public_id}:r{$a->revision}";
    }

    /**
     * One action: email each still-affected patient a reschedule link (and an in-app notice). Once per appointment revision.
     *
     * @return array{emailed:int,in_app_only:int,already:int}|null null when the Owner has not approved the wording yet
     */
    public static function notify(Collection $appointments, User $actor): ?array
    {
        if (! MessageTemplates::approved(self::TEMPLATE)) return null;
        $counts = ['emailed' => 0, 'in_app_only' => 0, 'already' => 0];
        DB::transaction(function () use ($appointments, $actor, &$counts) {
            foreach ($appointments as $a) {
                if (! self::stillAffected($a)) continue;
                $key = self::key($a);
                if (MailDispatch::where('dedupe_key', $key)->exists() || UserNotification::where('dedupe_key', $key)->exists()) { $counts['already']++; continue; }
                [$user, $reason] = Recipient::patient($a->patient);
                if ($user) app(NotificationCenter::class)->dentistUnavailable($a, $key);
                if ($reason) { $counts['in_app_only']++; continue; }
                app(MailOutbox::class)->queue(self::TEMPLATE, $key, $a, $a->revision, $user, $actor);
                $counts['emailed']++;
            }
        });

        return $counts;
    }
}
