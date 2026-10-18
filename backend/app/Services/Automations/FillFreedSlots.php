<?php

namespace App\Services\Automations;

use App\Models\Appointment;
use App\Models\AppointmentResponse;
use App\Models\SlotOffer;
use App\Models\SlotOpening;
use App\Models\User;
use App\Services\Appointments\AppointmentCommandException;
use App\Services\Appointments\AppointmentService;
use App\Services\Notifications\NotificationCenter;
use App\Services\Scheduling\SchedulingService;
use App\Services\Scheduling\SlotRequest;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * F3 fill freed times (R2-10: "a cancellation can leave the clinic idle for an hour"). When a time frees up — a cancellation,
 * "I can't make it", a release after the late limit, or a patient who moved up — it is offered in this order:
 *   (a) move up: patients booked LATER THE SAME DAY at the same branch, with the same Dentist or booked with "any available"
 *       Dentist who can do their service, whose service fits the freed time, get "An earlier time is available". The first to
 *       accept gets it through the normal scheduling checks and the database's no-double-booking guard; the others lose.
 *   (b) the waitlist (A5), after the move-up offers had `waitlist_after_minutes` of head start;
 *   (c) walk-ins: the front desk sees today's free times on the Check-In page.
 * Nothing is held and nobody is moved without accepting. Offers expire when the time passes or the appointment changes.
 */
final class FillFreedSlots implements AutomationJob
{
    public const PURPOSE = 'move_up_offer';

    public function __construct(private readonly SchedulingService $scheduling) {}

    public static function key(SlotOffer $offer): string
    {
        return self::PURPOSE.":{$offer->public_id}";
    }

    /**
     * Records the time a command just freed (called inside that command's transaction). A time already partly past (a release
     * after the late limit) is offered from the next 30-minute step. Returns null when nothing usable is left.
     */
    public static function open(Appointment $freed, string $source, ?CarbonImmutable $now = null, ?array $before = null): ?SlotOpening
    {
        $now ??= ClinicClock::now();
        $start = CarbonImmutable::instance($before['starts_at'] ?? $freed->starts_at);
        $end = CarbonImmutable::instance($before['ends_at'] ?? $freed->ends_at);
        if ($end->lessThanOrEqualTo($now)) return null;
        if ($start->lessThan($now)) {
            $local = ClinicClock::local($now);
            $minutes = (int) (ceil(($local->hour * 60 + $local->minute + ($local->second > 0 ? 1 : 0)) / SchedulingService::STAFF_GRID_MINUTES) * SchedulingService::STAFF_GRID_MINUTES);
            $start = ClinicClock::at($local->toDateString(), ClinicClock::time(min($minutes, 23 * 60 + 30)));
            if ($start->greaterThanOrEqualTo($end)) return null;
        }
        $fillOn = (bool) AutomationCatalog::setting('fill_slots')?->enabled;

        return SlotOpening::firstOrCreate(['appointment_id' => $freed->id, 'appointment_revision' => $before['revision'] ?? $freed->revision], [
            'branch_id' => $freed->branch_id, 'dentist_profile_id' => $before['dentist_profile_id'] ?? $freed->dentist_profile_id,
            'starts_at' => $start, 'ends_at' => $end, 'clinic_date' => ClinicClock::local($start)->toDateString(), 'source' => $source, 'status' => 'open',
            // Without move-up offers the waitlist does not wait.
            'waitlist_at' => $fillOn ? null : $now,
        ]);
    }

    /** A booking (front desk or online) took the time: close the opening it overlaps (inside the booking's transaction). */
    public static function claimByBooking(Appointment $booked): void
    {
        $openings = SlotOpening::where('status', 'open')->where('dentist_profile_id', $booked->dentist_profile_id)
            ->where('starts_at', '<', SchedulingService::ts(CarbonImmutable::instance($booked->ends_at)))
            ->where('ends_at', '>', SchedulingService::ts(CarbonImmutable::instance($booked->starts_at)))->lockForUpdate()->get();
        foreach ($openings as $opening) {
            $waited = \App\Models\WaitlistEntry::where('patient_id', $booked->patient_id)->where('branch_id', $booked->branch_id)
                ->where('clinic_date', $opening->dateString())->where('status', 'notified')->exists();
            self::close($opening, 'filled', $waited ? 'waitlist' : 'booking', $booked->id);
        }
    }

    /** Front desk: a walk-in used this free time (counted in the Owner summary). */
    public static function usedForWalkIn(SlotOpening $opening, User $actor): SlotOpening
    {
        return DB::transaction(function () use ($opening, $actor) {
            $current = SlotOpening::whereKey($opening->id)->lockForUpdate()->firstOrFail();
            if ($current->status !== 'open') throw AppointmentCommandException::rule('opening_closed', 'This free time was already used or has passed.', 'opening');
            self::close($current, 'filled', 'walk_in', null, $actor);

            return $current->fresh();
        });
    }

    public function run(CarbonImmutable $now, array $settings, array $options = []): array
    {
        $counts = ['offered' => 0, 'sent' => 0, 'skipped' => 0, 'expired' => 0, 'filled' => 0];
        // Passed, or taken by a booking that did not go through an offer.
        foreach (SlotOpening::where('status', 'open')->orderBy('id')->get() as $opening) {
            if ($opening->starts_at->lessThanOrEqualTo($now)) {
                DB::transaction(fn () => self::close(SlotOpening::whereKey($opening->id)->lockForUpdate()->first(), 'expired', null, null));
                $counts['expired']++;
                continue;
            }
            $taker = Appointment::active()->where('dentist_profile_id', $opening->dentist_profile_id)
                ->where('starts_at', '<', SchedulingService::ts($opening->ends_at))->where('ends_at', '>', SchedulingService::ts($opening->starts_at))->value('id');
            if ($taker) {
                DB::transaction(fn () => self::close(SlotOpening::whereKey($opening->id)->lockForUpdate()->first(), 'filled', 'booking', $taker));
                $counts['filled']++;
            }
        }
        // Offers whose appointment changed since (moved, cancelled, checked in) can no longer be accepted.
        foreach (SlotOffer::where('status', 'offered')->with('appointment')->get() as $offer) {
            $a = $offer->appointment;
            if (! $a || $a->revision !== $offer->appointment_revision || ! in_array($a->status, ['Pending', 'Confirmed'], true)) {
                $offer->update(['status' => 'expired', 'closed_at' => $now]);
            }
        }
        $query = SlotOpening::where('status', 'open')->whereNull('offers_sent_at')->with(['branch', 'dentist'])->orderBy('starts_at');
        if (! empty($options['opening_id'])) $query->whereKey($options['opening_id']);
        foreach ($query->get() as $opening) {
            $candidates = $opening->starts_at->greaterThanOrEqualTo($now->addMinutes((int) $settings['min_notice_minutes'])) ? $this->candidates($opening, (int) $settings['offer_count'], $now) : [];
            DB::transaction(function () use ($opening, $candidates, $settings, $now, &$counts) {
                $current = SlotOpening::whereKey($opening->id)->lockForUpdate()->first();
                if ($current->status !== 'open' || $current->offers_sent_at) return;
                foreach ($candidates as $appointment) {
                    $offer = SlotOffer::firstOrCreate(['slot_opening_id' => $current->id, 'appointment_id' => $appointment->id],
                        ['appointment_revision' => $appointment->revision, 'status' => 'offered', 'offered_at' => $now]);
                    if (! $offer->wasRecentlyCreated) continue;
                    $counts['offered']++;
                    $key = self::key($offer);
                    [$user, $reason] = Recipient::patient($appointment->patient);
                    if ($user) app(NotificationCenter::class)->moveUpOffer($offer->setRelation('opening', $current)->setRelation('appointment', $appointment), $key);
                    if ($reason) {
                        if (AutomationLog::skip('fill_slots', $key, $reason, $appointment, $appointment->branch_id)) $counts['skipped']++;
                        if ($user) AutomationLog::record('fill_slots', $key, 'notified', null, $appointment, $appointment->branch_id);
                        continue;
                    }
                    if (AutomationLog::queueEmail('fill_slots', $key, self::PURPOSE, $offer, $appointment->revision, $user, $appointment->branch_id)) $counts['sent']++;
                }
                $current->update(['offers_sent_at' => $now, 'waitlist_at' => $candidates ? $now->addMinutes((int) $settings['waitlist_after_minutes']) : $now]);
            });
        }

        return $counts;
    }

    /**
     * Patients booked later the same day at the same branch who could take this time: the same Dentist, or "any available"
     * bookings whose service this Dentist does; a service that fits; checked by the same scheduling validator the booking uses.
     * Earliest appointments first.
     *
     * @return list<Appointment>
     */
    public function candidates(SlotOpening $opening, int $limit, CarbonImmutable $now): array
    {
        $dayEnd = ClinicClock::at($opening->dateString(), '00:00')->addDay();
        $rows = Appointment::query()->whereIn('status', ['Pending', 'Confirmed'])->whereDoesntHave('visit')
            ->where('branch_id', $opening->branch_id)->where('starts_at', '>', SchedulingService::ts($opening->starts_at))->where('starts_at', '<', SchedulingService::ts($dayEnd))
            ->where('duration_minutes', '<=', $opening->minutes())
            ->where(fn ($q) => $q->where('dentist_profile_id', $opening->dentist_profile_id)->orWhere('assignment_method', 'auto'))
            ->whereHas('patient.user')->with(['patient.user', 'patient.person', 'branch', 'service', 'dentist'])->orderBy('starts_at')->orderBy('id')->get();
        $start = ClinicClock::local($opening->starts_at);
        $out = [];
        foreach ($rows as $a) {
            if (count($out) >= $limit) break;
            $result = $this->scheduling->evaluate(new SlotRequest($a->patient, $a->branch, $a->service, $opening->dentist, $start->toDateString(), $start->format('H:i'), false, $a->id), null, $now);
            if ($result->valid && $result->endsAt->lessThanOrEqualTo($opening->ends_at)) $out[] = $a;
        }

        return $out;
    }

    /**
     * The patient accepts an earlier time (from the email link or the app). The opening row is locked first, so of two patients
     * accepting at once exactly one wins; the database exclusion constraint is the final guard. The time the winner leaves
     * becomes a new opening (it may be offered in turn).
     */
    public function accept(SlotOffer $offer, User $actor, string $via, ?string $linkHash = null): Appointment
    {
        try {
            return DB::transaction(function () use ($offer, $actor, $via, $linkHash) {
                $opening = SlotOpening::whereKey($offer->slot_opening_id)->lockForUpdate()->firstOrFail();
                $offer = SlotOffer::whereKey($offer->id)->lockForUpdate()->firstOrFail();
                $now = ClinicClock::now();
                if ($opening->status !== 'open') throw AppointmentCommandException::rule('offer_taken', 'Another patient took this time first. Your appointment stays as it was.', 'offer');
                if ($offer->status !== 'offered') throw AppointmentCommandException::rule('offer_closed', 'This offer is no longer available. Your appointment stays as it was.', 'offer');
                if ($opening->starts_at->lessThanOrEqualTo($now)) throw AppointmentCommandException::rule('offer_expired', 'This earlier time has passed. Your appointment stays as it was.', 'offer');
                $appointment = Appointment::whereKey($offer->appointment_id)->lockForUpdate()->firstOrFail();
                if ($appointment->revision !== $offer->appointment_revision || ! in_array($appointment->status, ['Pending', 'Confirmed'], true) || $appointment->visit()->exists()) {
                    throw AppointmentCommandException::rule('offer_out_of_date', 'Your appointment changed after this offer was sent, so the offer no longer applies.', 'offer');
                }
                if ($linkHash !== null || $via === 'app') {
                    AppointmentResponse::create(['appointment_id' => $appointment->id, 'appointment_revision' => $appointment->revision, 'response' => 'move_up_accepted', 'via' => $via, 'link_hash' => $linkHash]);
                }
                $before = ['starts_at' => $appointment->starts_at, 'ends_at' => $appointment->ends_at, 'revision' => $appointment->revision, 'dentist_profile_id' => $appointment->dentist_profile_id];
                $moved = app(AppointmentService::class)->moveUp($actor, $appointment, $opening->load('dentist'));
                $offer->update(['status' => 'accepted', 'closed_at' => $now]);
                self::close($opening, 'filled', 'move_up', $moved->id);
                self::open($moved, 'moved_up', $now, $before);

                return $moved;
            });
        } catch (QueryException $e) {
            if (in_array($e->getCode(), ['23P01', '40P01', '40001'], true)) throw AppointmentCommandException::conflict();
            if ($e->getCode() === '23505') throw AppointmentCommandException::rule('link_used', 'This link was already used.', 'link');

            throw $e;
        }
    }

    /** Closes an opening (the caller holds its lock) and every offer still out for it. */
    private static function close(?SlotOpening $opening, string $status, ?string $via, ?int $appointmentId, ?User $actor = null): void
    {
        if (! $opening || $opening->status !== 'open') return;
        $now = ClinicClock::now();
        $opening->update(['status' => $status, 'filled_via' => $via, 'filled_appointment_id' => $appointmentId, 'closed_at' => $now, 'closed_by_user_id' => $actor?->id]);
        SlotOffer::where('slot_opening_id', $opening->id)->where('status', 'offered')->update(['status' => $status === 'filled' ? 'lost' : 'expired', 'closed_at' => $now->toIso8601String(), 'updated_at' => $now->toIso8601String()]);
    }

    /** Withdraws the opening a released appointment left, when the front desk undoes the release (the patient is here after all). */
    public static function withdraw(Appointment $appointment): void
    {
        $opening = SlotOpening::where('appointment_id', $appointment->id)->where('status', 'open')->lockForUpdate()->first();
        if ($opening) self::close($opening, 'withdrawn', null, null);
    }
}
