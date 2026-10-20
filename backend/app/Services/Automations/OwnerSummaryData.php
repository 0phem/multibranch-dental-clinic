<?php

namespace App\Services\Automations;

use App\Models\Branch;
use App\Support\ClinicClock;
use Illuminate\Support\Facades\DB;

/**
 * The numbers in the Owner daily summary for one clinic date (Asia/Manila midnight to midnight). Counts and totals only: no
 * patient names, messages or clinical data. A branch is left out on a day it is closed and had no activity.
 */
final class OwnerSummaryData
{
    /** @return array{date:string, branches:array<int, array>, new_patient_accounts:int} */
    public static function forDate(string $date): array
    {
        $from = ClinicClock::at($date, '00:00');
        $to = $from->addDay();
        [$f, $t] = [$from->toIso8601String(), $to->toIso8601String()];
        $history = fn (string $event) => DB::table('appointment_history')->where('event', $event)->where('occurred_at', '>=', $f)->where('occurred_at', '<', $t)
            ->groupBy('branch_id')->selectRaw('branch_id, count(*) as n')->pluck('n', 'branch_id');
        $booked = $history('appointment.created');
        $cancelled = $history('appointment.cancelled');
        $completed = DB::table('visits')->where('status', 'Completed')->where('closed_at', '>=', $f)->where('closed_at', '<', $t)
            ->groupBy('branch_id')->selectRaw('branch_id, count(*) as n')->pluck('n', 'branch_id');
        $noShows = DB::table('no_show_flags')->where('status', '<>', 'released')->where('flagged_at', '>=', $f)->where('flagged_at', '<', $t)
            ->groupBy('branch_id')->selectRaw('branch_id, count(*) as n')->pluck('n', 'branch_id');
        // F9 (interview round 2): late cancellations, late arrivals, released times and how freed times were refilled.
        $lateCancelled = DB::table('appointments')->where('late_cancellation', true)->where('cancelled_at', '>=', $f)->where('cancelled_at', '<', $t)
            ->groupBy('branch_id')->selectRaw('branch_id, count(*) as n')->pluck('n', 'branch_id');
        // Counted from the queue history, so a late arrival whose place Staff restored still counts as late.
        $lateArrivals = DB::table('queue_entry_history as h')->join('queue_entries as q', 'q.id', '=', 'h.queue_entry_id')->join('visits as v', 'v.id', '=', 'q.visit_id')
            ->where('h.event', 'queue.entered_late')->where('h.occurred_at', '>=', $f)->where('h.occurred_at', '<', $t)
            ->groupBy('v.branch_id')->selectRaw('v.branch_id, count(*) as n')->pluck('n', 'branch_id');
        $released = DB::table('no_show_flags')->where('status', 'released')->where('flagged_at', '>=', $f)->where('flagged_at', '<', $t)
            ->groupBy('branch_id')->selectRaw('branch_id, count(*) as n')->pluck('n', 'branch_id');
        $refilled = DB::table('slot_openings')->where('status', 'filled')->where('closed_at', '>=', $f)->where('closed_at', '<', $t)
            ->groupBy('branch_id', 'filled_via')->selectRaw('branch_id, filled_via, count(*) as n')->get()->groupBy('branch_id');
        $payments = DB::table('payments as p')->join('invoices as i', 'i.id', '=', 'p.invoice_id')->where('p.recorded_at', '>=', $f)->where('p.recorded_at', '<', $t)
            ->groupBy('i.branch_id')->selectRaw('i.branch_id, count(*) as n, coalesce(sum(p.amount), 0) as total')->get()->keyBy('branch_id');
        $issued = DB::table('invoices')->whereNotNull('issued_at')->where('issued_at', '>=', $f)->where('issued_at', '<', $t)
            ->groupBy('branch_id')->selectRaw('branch_id, count(*) as n, coalesce(sum(patient_responsibility_amount), 0) as total')->get()->keyBy('branch_id');
        $unpaid = DB::table('invoices')->where('status', 'Issued')->whereRaw('patient_responsibility_amount > paid_amount')
            ->groupBy('branch_id')->selectRaw('branch_id, count(*) as n, coalesce(sum(patient_responsibility_amount - paid_amount), 0) as total')->get()->keyBy('branch_id');

        // M20: open and overdue follow-up tasks per branch at the end of that day (counts only, never a reason).
        $followOpen = DB::table('followup_tasks')->whereIn('status', ['Open', 'Contacted'])->groupBy('branch_id')->selectRaw('branch_id, count(*) as n, count(*) filter (where due_on < ?) as overdue', [$date])->get()->keyBy('branch_id');
        $branches = [];
        foreach (Branch::orderBy('id')->get() as $branch) {
            $row = [
                'name' => $branch->name,
                'open' => $branch->hoursOnDate($date) !== null,
                'booked' => (int) ($booked[$branch->id] ?? 0),
                'completed' => (int) ($completed[$branch->id] ?? 0),
                'cancelled' => (int) ($cancelled[$branch->id] ?? 0),
                'possible_no_shows' => (int) ($noShows[$branch->id] ?? 0),
                'late_cancellations' => (int) ($lateCancelled[$branch->id] ?? 0),
                'late_arrivals' => (int) ($lateArrivals[$branch->id] ?? 0),
                'released' => (int) ($released[$branch->id] ?? 0),
                'refilled' => collect(['move_up', 'waitlist', 'walk_in', 'booking'])->mapWithKeys(fn ($via) => [$via => (int) ($refilled->get($branch->id)?->firstWhere('filled_via', $via)->n ?? 0)])->all(),
                'payments_count' => (int) ($payments[$branch->id]->n ?? 0),
                'payments_total' => number_format((float) ($payments[$branch->id]->total ?? 0), 2, '.', ''),
                'issued_count' => (int) ($issued[$branch->id]->n ?? 0),
                'issued_total' => number_format((float) ($issued[$branch->id]->total ?? 0), 2, '.', ''),
                'unpaid_count' => (int) ($unpaid[$branch->id]->n ?? 0),
                'unpaid_total' => number_format((float) ($unpaid[$branch->id]->total ?? 0), 2, '.', ''),
                'followups_open' => (int) ($followOpen[$branch->id]->n ?? 0),
                'followups_overdue' => (int) ($followOpen[$branch->id]->overdue ?? 0),
            ];
            $activity = $row['booked'] + $row['completed'] + $row['cancelled'] + $row['possible_no_shows'] + $row['payments_count'] + $row['issued_count'] + $row['released'] + $row['late_arrivals'];
            if ($row['open'] || $activity > 0) $branches[] = $row;
        }
        // users.created_at is a timestamp WITHOUT time zone holding UTC wall-clock time (docs/TIMEZONE_PLAN.md): compare in UTC.
        $newAccounts = DB::table('users')->where('role', 'patient')
            ->where('created_at', '>=', $from->utc()->format('Y-m-d H:i:s'))->where('created_at', '<', $to->utc()->format('Y-m-d H:i:s'))->count();

        return ['date' => $date, 'branches' => $branches, 'new_patient_accounts' => $newAccounts];
    }
}
