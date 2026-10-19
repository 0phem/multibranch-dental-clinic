<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\UserBranchScope;
use App\Services\Automations\AutomationCatalog;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * F6 calendar load (R2-02: the clinic likes a calendar that shows in advance which days are crowded). For each day of a range
 * and branch: booked minutes (appointments not cancelled and not no-show) against available minutes (each available Dentist
 * assigned to the branch, their shift inside that day's branch hours), as a percentage, plus closed days with the reason.
 * A day above the Owner's threshold is "crowded". Staff see their branches; the Owner one branch or all of them.
 * Capacity is an ESTIMATE: the dentists' real weekly hours are an open Owner question (OPEN_ITEMS item 3), so each Dentist's
 * profile shift is used, and in the day total a Dentist assigned to several branches is counted once (their longest window).
 */
class CalendarLoadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['branch_ref' => ['nullable', 'string', 'max:50'], 'from' => ['required', 'date_format:Y-m-d'], 'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from']]);
        $from = CarbonImmutable::createFromFormat('!Y-m-d', $data['from'], ClinicClock::TIMEZONE);
        $to = CarbonImmutable::createFromFormat('!Y-m-d', $data['to'], ClinicClock::TIMEZONE);
        if ($from->diffInDays($to) > 42) throw ValidationException::withMessages(['to' => ['Choose at most six weeks.']]);
        $user = $request->user();
        $branches = Branch::query()->where('status', 'Open')->orderBy('id')
            ->when(! empty($data['branch_ref']), fn ($q) => $q->where('legacy_ref', $data['branch_ref']))
            ->when($user->role->value === 'staff', fn ($q) => $q->whereIn('id', UserBranchScope::select('branch_id')->where('user_id', $user->id)))
            ->with(['dentistBranches.dentistProfile'])->get();
        abort_if($branches->isEmpty(), 403, 'Forbidden.');
        $threshold = (int) (AutomationCatalog::setting('calendar_load')?->settings['crowded_percent'] ?? 80);
        $booked = Appointment::whereIn('branch_id', $branches->pluck('id'))->whereNotIn('status', ['Cancelled', 'No-show'])
            ->where('starts_at', '>=', $from->toIso8601String())->where('starts_at', '<', $to->addDay()->toIso8601String())
            ->get(['branch_id', 'starts_at', 'duration_minutes'])
            ->groupBy(fn ($a) => $a->branch_id.':'.ClinicClock::local($a->starts_at)->toDateString());

        $days = [];
        for ($day = $from; $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
            $date = $day->toDateString();
            $row = ['date' => $date, 'branches' => []];
            $sumBooked = $count = 0;
            $allClosed = true;
            $perDentist = []; // dentist id => minutes, counted once per day across branches (the longest window)
            foreach ($branches as $branch) {
                $hours = $branch->hoursOnDate($date);
                $closure = $branch->closureOn($date);
                $list = $booked->get($branch->id.':'.$date, collect());
                $minutesByDentist = $hours ? $this->capacity($branch, $hours) : [];
                foreach ($minutesByDentist as $id => $m) $perDentist[$id] = max($perDentist[$id] ?? 0, $m);
                $capacity = array_sum($minutesByDentist);
                $minutes = (int) $list->sum('duration_minutes');
                $allClosed = $allClosed && $hours === null;
                $sumBooked += $minutes; $count += $list->count();
                $row['branches'][] = ['id' => $branch->legacy_ref, 'name' => $branch->name, 'closed' => $hours === null, 'reason' => $hours === null ? ($closure?->reason ?? ($closure ? 'Closed' : 'Closed this weekday')) : null,
                    'partial_hours' => $closure?->partialHours(), 'appointments' => $list->count(), 'booked_minutes' => $minutes, 'capacity_minutes' => $capacity,
                    'percent' => $capacity > 0 ? (int) round(100 * $minutes / $capacity) : null];
            }
            $sumCapacity = array_sum($perDentist);
            $percent = $sumCapacity > 0 ? (int) round(100 * $sumBooked / $sumCapacity) : null;
            $days[] = $row + ['closed' => $allClosed, 'appointments' => $count, 'booked_minutes' => $sumBooked, 'capacity_minutes' => $sumCapacity,
                'percent' => $percent, 'crowded' => $percent !== null && $percent >= $threshold];
        }

        return response()->json(['data' => ['days' => $days, 'crowded_percent' => $threshold, 'capacity_estimated' => true,
            'capacity_note' => 'Capacity is estimated: dentists’ real weekly hours not yet provided.', 'branches' => $branches->map(fn ($b) => ['id' => $b->legacy_ref, 'name' => $b->name])->values()]]);
    }

    /** @return array<int,int> dentist id => minutes they can see patients there that day (their shift inside the branch hours) */
    private function capacity(Branch $branch, array $hours): array
    {
        $open = ClinicClock::minutes($hours['open']);
        $close = ClinicClock::minutes($hours['close']);
        $out = [];
        foreach ($branch->dentistBranches as $link) {
            $d = $link->dentistProfile;
            if (! $d?->available || ! $d->shift_start || ! $d->shift_end) continue;
            $out[$d->id] = max(0, min($close, ClinicClock::minutes(substr((string) $d->shift_end, 0, 5))) - max($open, ClinicClock::minutes(substr((string) $d->shift_start, 0, 5))));
        }

        return $out;
    }
}
