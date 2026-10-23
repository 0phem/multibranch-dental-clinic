<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\BranchClosure;
use App\Models\UserBranchScope;
use App\Services\Audit\AuditService;
use App\Services\Automations\MessageTemplates;
use App\Services\Automations\Recipient;
use App\Services\Closures\ClosureCalendar;
use App\Services\Closures\PhilippineHolidays;
use App\Services\Mail\MailOutbox;
use App\Services\Notifications\NotificationCenter;
use App\Support\ClinicClock;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * F5 closed and holiday dates (R2-13). The Owner adds a closure (one branch or all, a reason, optional partial hours), removes
 * one, and confirms or dismisses holiday SUGGESTIONS one by one. Booking greys the date out at once (Branch::hoursOnDate). A
 * closure never cancels an appointment: the affected ones are listed for the front desk, who may email those patients a
 * reschedule link with one action (approved wording only). The landing page lists the upcoming closures.
 */
class BranchClosureController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = BranchClosure::whereIn('status', ['active', 'suggested'])->where('closed_on', '>=', ClinicClock::today())->with('branch')->orderBy('closed_on')->get();

        return response()->json(['data' => $rows->map(fn (BranchClosure $c) => $this->view($c, true))->values()]);
    }

    /** Public: upcoming confirmed closures for the landing page (date, branch, reason, partial hours). */
    public function upcoming(): JsonResponse
    {
        $today = ClinicClock::today();
        $rows = BranchClosure::where('status', 'active')->where('closed_on', '>=', $today)->where('closed_on', '<=', ClinicClock::addDays($today, 60))
            ->with('branch')->orderBy('closed_on')->limit(20)->get();

        return response()->json(['data' => $rows->map(fn (BranchClosure $c) => $this->view($c, false))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['branch_ref' => ['nullable', 'string', 'max:50'], 'date' => ['required', 'date_format:Y-m-d'], 'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date'], 'reason' => ['nullable', 'string', 'max:120'],
            'open_time' => ['nullable', 'date_format:H:i', 'required_with:close_time'], 'close_time' => ['nullable', 'date_format:H:i', 'required_with:open_time', 'after:open_time']]);
        if ($data['date'] < ClinicClock::today()) throw ValidationException::withMessages(['date' => ['Choose today or a later date.']]);
        if (! empty($data['end_date']) && (strtotime($data['end_date']) - strtotime($data['date'])) / 86400 > 31) {
            throw ValidationException::withMessages(['end_date' => ['Date range cannot exceed 31 days.']]);
        }
        $branch = ! empty($data['branch_ref']) ? Branch::where('legacy_ref', $data['branch_ref'])->firstOrFail() : null;
        $endDate = $data['end_date'] ?? $data['date'];
        $currentDate = $data['date'];
        $lastClosure = null;
        while ($currentDate <= $endDate) {
            try {
                $closure = BranchClosure::create(['branch_id' => $branch?->id, 'closed_on' => $currentDate, 'reason' => $data['reason'] ?? null,
                    'open_time' => $data['open_time'] ?? null, 'close_time' => $data['close_time'] ?? null, 'status' => 'active', 'source' => 'owner',
                    'created_by_user_id' => $request->user()->id, 'updated_by_user_id' => $request->user()->id]);
                $lastClosure = $closure;
            } catch (QueryException $e) {
                if ($e->getCode() === '23505') {
                    if ($data['date'] === $endDate) throw ValidationException::withMessages(['date' => ['This date is already closed (or suggested) for that branch.']]);
                } else {
                    throw $e;
                }
            }
            $currentDate = date('Y-m-d', strtotime($currentDate . ' +1 day'));
        }
        if (! $lastClosure) {
            throw ValidationException::withMessages(['date' => ['The selected dates are already closed for this branch.']]);
        }
        app(ClosureCalendar::class)->flush();
        app(AuditService::class)->recordAdministrative('branch_closure.created', $request->user(), $branch, ['date' => $data['date'], 'end_date' => $data['end_date'] ?? null, 'reason' => $lastClosure->reason, 'partial' => $lastClosure->partialHours()]);

        return response()->json(['data' => $this->view($lastClosure->fresh('branch'), true)], 201);
    }

    /** Owner: remove a closure, or confirm / dismiss a holiday suggestion. */
    public function update(Request $request, BranchClosure $branchClosure): JsonResponse
    {
        $data = $request->validate(['action' => ['required', 'in:remove,confirm,dismiss']]);
        $to = ['remove' => ['active', 'removed'], 'confirm' => ['suggested', 'active'], 'dismiss' => ['suggested', 'dismissed']][$data['action']];
        if ($branchClosure->status !== $to[0]) throw ValidationException::withMessages(['action' => ['This date can no longer be changed that way. Reload the list.']]);
        $branchClosure->update(['status' => $to[1], 'updated_by_user_id' => $request->user()->id]);
        app(ClosureCalendar::class)->flush();
        app(AuditService::class)->recordAdministrative('branch_closure.'.$data['action'].'ed', $request->user(), $branchClosure->branch, ['date' => $branchClosure->dateString(), 'reason' => $branchClosure->reason]);

        return response()->json(['data' => $this->view($branchClosure->fresh('branch'), true)]);
    }

    /** Owner: add this year's holiday suggestions (each still needs a confirmation; nothing closes by itself). */
    public function suggestHolidays(Request $request): JsonResponse
    {
        $added = 0;
        foreach (PhilippineHolidays::upcoming(ClinicClock::now()) as $h) {
            $exists = BranchClosure::whereNull('branch_id')->where('closed_on', $h['date'])->exists();
            if ($exists) continue;
            BranchClosure::create(['branch_id' => null, 'closed_on' => $h['date'], 'reason' => $h['name'], 'status' => 'suggested', 'source' => 'holiday_suggestion',
                'created_by_user_id' => $request->user()->id, 'updated_by_user_id' => $request->user()->id]);
            $added++;
        }
        if ($added) app(AuditService::class)->recordAdministrative('branch_closure.holidays_suggested', $request->user(), null, ['count' => $added]);

        return response()->json(['data' => ['added' => $added]]);
    }

    /** Staff (their branches) and Owner: appointments still booked on a closed date. Never cancelled automatically. */
    public function affected(Request $request, BranchClosure $branchClosure): JsonResponse
    {
        $rows = $this->affectedQuery($request, $branchClosure)->with(['patient.person', 'branch', 'service'])->orderBy('starts_at')->get();

        return response()->json(['data' => $rows->map(fn (Appointment $a) => ['id' => $a->public_id, 'code' => $a->appointment_code, 'time' => ClinicClock::local($a->starts_at)->format('g:i A'),
            'patient' => trim(($a->patient?->person?->first_name ?? '').' '.($a->patient?->person?->last_name ?? '')), 'branch' => $a->branch?->name, 'service' => $a->service?->name])->values(),
            'meta' => ['notified_at' => $branchClosure->patients_notified_at?->toIso8601String(), 'wording_approved' => MessageTemplates::approved('closure_notice')]]);
    }

    /** One action: email each affected patient a reschedule link (and an in-app notice). Once per appointment and closure. */
    public function notify(Request $request, BranchClosure $branchClosure): JsonResponse
    {
        abort_unless($branchClosure->status === 'active', 422, 'This closure is not active.');
        if (! MessageTemplates::approved('closure_notice')) {
            return response()->json(['message' => 'The Owner must approve the “Closed date” email wording first (Administration → Automations).', 'code' => 'wording_not_approved'], 422);
        }
        $counts = ['emailed' => 0, 'in_app_only' => 0, 'already' => 0];
        $rows = $this->affectedQuery($request, $branchClosure)->with(['patient.user', 'patient.person', 'branch'])->get();
        DB::transaction(function () use ($rows, $branchClosure, $request, &$counts) {
            foreach ($rows as $a) {
                $key = "closure_notice:{$branchClosure->public_id}:{$a->public_id}:r{$a->revision}";
                if (\App\Models\MailDispatch::where('dedupe_key', $key)->exists() || \App\Models\UserNotification::where('dedupe_key', $key)->exists()) { $counts['already']++; continue; }
                [$user, $reason] = Recipient::patient($a->patient);
                if ($user) app(NotificationCenter::class)->closureNotice($a, $key);
                if ($reason) { $counts['in_app_only']++; continue; }
                app(MailOutbox::class)->queue('closure_notice', $key, $a, $a->revision, $user, $request->user());
                $counts['emailed']++;
            }
            $branchClosure->update(['patients_notified_at' => now()]);
        });
        app(AuditService::class)->recordAdministrative('branch_closure.patients_notified', $request->user(), $branchClosure->branch, ['date' => $branchClosure->dateString()] + $counts);

        return response()->json(['data' => $counts]);
    }

    private function affectedQuery(Request $request, BranchClosure $c)
    {
        $date = $c->dateString();
        $from = ClinicClock::at($date, '00:00');
        $q = Appointment::whereIn('status', ['Pending', 'Confirmed'])->where('starts_at', '>=', $from->toIso8601String())->where('starts_at', '<', $from->addDay()->toIso8601String());
        if ($c->branch_id) $q->where('branch_id', $c->branch_id);
        if ($request->user()->role->value === 'staff') $q->whereIn('branch_id', UserBranchScope::select('branch_id')->where('user_id', $request->user()->id));
        if ($partial = $c->partialHours()) {
            // Partial hours: only the visits outside the hours that stay open.
            $q->where(fn ($w) => $w->where('starts_at', '<', ClinicClock::at($date, $partial['open'])->toIso8601String())->orWhere('ends_at', '>', ClinicClock::at($date, $partial['close'])->toIso8601String()));
        }

        return $q;
    }

    private function view(BranchClosure $c, bool $internal): array
    {
        $partial = $c->partialHours();

        return ['id' => $c->public_id, 'date' => $c->dateString(), 'branch' => $c->branch ? ['id' => $c->branch->legacy_ref, 'name' => $c->branch->name] : null,
            'reason' => $c->reason, 'partial_hours' => $partial] + ($internal ? ['status' => $c->status, 'source' => $c->source,
            'patients_notified_at' => $c->patients_notified_at?->toIso8601String()] : []);
    }
}
