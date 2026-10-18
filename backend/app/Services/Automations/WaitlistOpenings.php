<?php

namespace App\Services\Automations;

use App\Models\WaitlistEntry;
use App\Services\Notifications\NotificationCenter;
use App\Services\Scheduling\SchedulingService;
use App\Services\Scheduling\SlotRequest;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;

/**
 * A5 (M6). Every minute: entries for a date that has passed (Asia/Manila) expire; for each branch, service, Dentist choice and
 * day that has waiting patients, if the patient booking rules now find at least one open time (for example after a
 * cancellation) and the move-up offers for it had their head start (F3), the earliest `notify_count` waiting patients (first come, first served) get an email and an in-app notice.
 * No time is held: the patient books through the normal booking command, whose no-double-booking guard still decides.
 */
final class WaitlistOpenings implements AutomationJob
{
    public const PURPOSE = 'waitlist_opening';

    public static function key(WaitlistEntry $entry): string
    {
        return self::PURPOSE.":{$entry->public_id}";
    }

    public function __construct(private readonly SchedulingService $scheduling) {}

    /** Whether the patient booking rules find an open time on that day (the same search the booking calendar uses). */
    public function hasOpening(WaitlistEntry $entry, CarbonImmutable $now): bool
    {
        $pool = $entry->dentist ? collect([$entry->dentist]) : $this->scheduling->eligibleDentists($entry->branch, $entry->service);
        if ($pool->isEmpty()) return false;
        $base = new SlotRequest($entry->patient, $entry->branch, $entry->service, null, null, null, true, requirePatient: false);

        return $this->scheduling->slotsOn($base, $entry->dateString(), $pool, null, $now, 1) !== [];
    }

    public function run(CarbonImmutable $now, array $settings, array $options = []): array
    {
        $counts = ['sent' => 0, 'skipped' => 0, 'expired' => 0];
        $today = ClinicClock::local($now)->toDateString();
        foreach (WaitlistEntry::where('status', 'waiting')->where('clinic_date', '<', $today)->get() as $entry) {
            $entry->update(['status' => 'expired', 'closed_at' => $now]);
            $counts['expired']++;
        }
        $groups = WaitlistEntry::where('status', 'waiting')->with(['patient.user', 'patient.person', 'branch', 'service', 'dentist.person'])
            ->orderBy('created_at')->orderBy('id')->get()
            ->groupBy(fn (WaitlistEntry $e) => implode(':', [$e->branch_id, $e->service_id, $e->dentist_profile_id ?? 'any', $e->dateString()]));
        // F3 order: while move-up offers for a freed time on that day still have their head start, the waitlist waits.
        $held = ! AutomationCatalog::setting('fill_slots')?->enabled ? collect() : \App\Models\SlotOpening::where('status', 'open')->where(fn ($q) => $q->whereNull('waitlist_at')->orWhere('waitlist_at', '>', $now->toIso8601String()))
            ->get(['branch_id', 'clinic_date'])->map(fn ($o) => $o->branch_id.':'.$o->dateString())->flip();
        foreach ($groups as $entries) {
            $first = $entries->first();
            if ($held->has($first->branch_id.':'.$first->dateString())) continue;
            if (! $this->hasOpening($first, $now)) continue;
            foreach ($entries->take((int) $settings['notify_count']) as $entry) {
                $entry->update(['status' => 'notified', 'notified_at' => $now, 'closed_at' => $now]);
                $key = self::key($entry);
                [$user, $reason] = Recipient::patient($entry->patient);
                if ($user) app(NotificationCenter::class)->waitlistOpening($entry, $key);
                if ($reason) {
                    // The in-app notice still told an account holder; the email could not be sent.
                    if (AutomationLog::skip('waitlist', $key, $reason, $entry, $entry->branch_id)) $counts['skipped']++;
                    if ($user) AutomationLog::record('waitlist', $key, 'notified', null, $entry, $entry->branch_id);
                    continue;
                }
                if (AutomationLog::queueEmail('waitlist', $key, self::PURPOSE, $entry, null, $user, $entry->branch_id)) $counts['sent']++;
            }
        }

        return $counts;
    }
}
