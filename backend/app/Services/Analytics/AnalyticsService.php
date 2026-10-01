<?php

namespace App\Services\Analytics;

use App\Models\Appointment;
use App\Models\AutomatedAction;
use App\Models\Branch;
use App\Models\HmoCase;
use App\Models\Invoice;
use App\Models\QueueEntry;
use App\Models\SystemEvent;
use App\Models\Visit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    /**
     * Parse requested period into Asia/Manila CarbonImmutable boundaries.
     */
    public function parsePeriod(?string $period, ?string $dateFrom = null, ?string $dateTo = null): array
    {
        $now = CarbonImmutable::now('Asia/Manila');
        $norm = strtolower(trim((string) $period));

        if ($dateFrom || $dateTo) {
            $from = $dateFrom ? CarbonImmutable::parse($dateFrom, 'Asia/Manila')->startOfDay() : null;
            $to = $dateTo ? CarbonImmutable::parse($dateTo, 'Asia/Manila')->endOfDay() : null;
            return [
                'from' => $from,
                'to' => $to,
                'label' => ($from && $to) ? "{$from->format('M d, Y')} – {$to->format('M d, Y')}" : 'Custom Range',
                'period' => 'custom',
            ];
        }

        switch ($norm) {
            case 'today':
                return [
                    'from' => $now->startOfDay(),
                    'to' => $now->endOfDay(),
                    'label' => "Today ({$now->format('M d, Y')})",
                    'period' => 'today',
                ];

            case 'this week':
            case 'week':
                return [
                    'from' => $now->startOfWeek(),
                    'to' => $now->endOfWeek(),
                    'label' => "This Week ({$now->startOfWeek()->format('M d')} – {$now->endOfWeek()->format('M d, Y')})",
                    'period' => 'week',
                ];

            case 'this month':
            case 'month':
                return [
                    'from' => $now->startOfMonth(),
                    'to' => $now->endOfMonth(),
                    'label' => "This Month ({$now->format('F Y')})",
                    'period' => 'month',
                ];

            case 'this year':
            case 'year':
                return [
                    'from' => $now->startOfYear(),
                    'to' => $now->endOfYear(),
                    'label' => "This Year ({$now->format('Y')})",
                    'period' => 'year',
                ];

            case 'all':
            case 'all time':
            default:
                return [
                    'from' => null,
                    'to' => null,
                    'label' => 'All Time',
                    'period' => 'all',
                ];
        }
    }

    /**
     * Compute authoritative executive summary KPIs.
     */
    public function getExecutiveSummary(
        ?string $period = 'today',
        ?int $branchId = null,
        ?string $dateFrom = null,
        ?string $dateTo = null
    ): array {
        $bounds = $this->parsePeriod($period, $dateFrom, $dateTo);
        $from = $bounds['from'];
        $to = $bounds['to'];

        // 1. Invoices & Financials (M11)
        $invoiceQuery = Invoice::query();
        if ($branchId) {
            $invoiceQuery->where('branch_id', $branchId);
        }
        if ($from && $to) {
            $invoiceQuery->whereBetween('created_at', [$from, $to]);
        }

        $allInvoices = (clone $invoiceQuery)->get();
        $paidInvoices = $allInvoices->where('status', 'Paid');
        $issuedInvoices = $allInvoices->where('status', 'Issued');

        $totalCollected = $paidInvoices->sum(fn(Invoice $i) => (float) $i->paid_amount);
        $totalGross = $allInvoices->whereIn('status', ['Issued', 'Paid'])->sum(fn(Invoice $i) => (float) $i->gross_amount);
        $totalHmoCovered = $allInvoices->whereIn('status', ['Issued', 'Paid'])->sum(fn(Invoice $i) => (float) $i->hmo_coverage_amount);
        $outstandingBalance = $issuedInvoices->sum(fn(Invoice $i) => (float) $i->patient_responsibility_amount - (float) $i->paid_amount);

        $avgTicket = $paidInvoices->count() > 0 ? round($totalCollected / $paidInvoices->count(), 2) : 0.00;

        // 2. Appointments & Scheduling (M6)
        $apptQuery = Appointment::query();
        if ($branchId) {
            $apptQuery->where('branch_id', $branchId);
        }
        if ($from && $to) {
            $apptQuery->whereBetween('starts_at', [$from, $to]);
        }

        $appts = (clone $apptQuery)->get();
        $totalAppts = $appts->count();
        $confirmedAppts = $appts->where('status', 'Confirmed')->count();
        $completedAppts = $appts->where('status', 'Completed')->count();
        $cancelledAppts = $appts->where('status', 'Cancelled')->count();
        $noShowAppts = $appts->where('status', 'No-show')->count();
        $inTreatmentAppts = $appts->where('status', 'In Treatment')->count();

        $terminalAppts = $completedAppts + $cancelledAppts + $noShowAppts;
        $completionRate = $terminalAppts > 0 ? (int) round(($completedAppts / $terminalAppts) * 100) : 100;

        // 3. Queue & Patient Flow (M9/M10)
        $visitQuery = Visit::query();
        if ($branchId) {
            $visitQuery->where('branch_id', $branchId);
        }
        if ($from && $to) {
            $visitQuery->whereBetween('arrived_at', [$from, $to]);
        }
        $totalVisits = (clone $visitQuery)->count();

        $queueQuery = QueueEntry::query();
        if ($branchId) {
            $queueQuery->whereHas('visit', fn($q) => $q->where('branch_id', $branchId));
        }
        if ($from && $to) {
            $queueQuery->whereBetween('created_at', [$from, $to]);
        }
        $queueEntries = (clone $queueQuery)->get();
        $servedQueueCount = $queueEntries->where('status', 'Served')->count();
        $waitingQueueCount = $queueEntries->whereIn('status', ['Waiting', 'Called', 'Treatment Ready'])->count();

        // 4. HMO Processing (M12)
        $hmoQuery = HmoCase::query();
        if ($branchId) {
            $hmoQuery->where('branch_id', $branchId);
        }
        if ($from && $to) {
            $hmoQuery->whereBetween('created_at', [$from, $to]);
        }
        $hmoCases = (clone $hmoQuery)->get();
        $totalHmo = $hmoCases->count();
        $approvedHmo = $hmoCases->where('status', 'Approved')->count();
        $pendingHmo = $hmoCases->whereIn('status', ['Pending', 'Escalated'])->count();
        $withdrawnHmo = $hmoCases->where('status', 'Withdrawn')->count();
        $rejectedHmo = $hmoCases->where('status', 'Rejected')->count();
        $approvedHmoAmount = $hmoCases->where('status', 'Approved')->sum(fn(HmoCase $c) => (float) $c->approved_amount);

        // 5. Automation Health (M23)
        $actionQuery = AutomatedAction::query();
        if ($branchId) {
            $actionQuery->whereHas('event', fn($q) => $q->where('branch_id', $branchId));
        }
        if ($from && $to) {
            $actionQuery->whereBetween('executed_at', [$from, $to]);
        }
        $totalActions = (clone $actionQuery)->count();
        $successActions = (clone $actionQuery)->where('status', 'Success')->count();
        $warningActions = (clone $actionQuery)->where('status', 'Warning')->count();
        $failedActions = (clone $actionQuery)->where('status', 'Failed')->count();
        $automationHealthRate = $totalActions > 0 ? (int) round(($successActions / $totalActions) * 100) : 100;

        return [
            'period' => $bounds['period'],
            'period_label' => $bounds['label'],
            'branch_id' => $branchId,
            'financials' => [
                'total_collected_php' => round($totalCollected, 2),
                'total_gross_php' => round($totalGross, 2),
                'total_hmo_covered_php' => round($totalHmoCovered, 2),
                'outstanding_balance_php' => round($outstandingBalance, 2),
                'invoices_count' => $allInvoices->count(),
                'paid_invoices_count' => $paidInvoices->count(),
                'average_ticket_php' => $avgTicket,
            ],
            'scheduling' => [
                'total_appointments' => $totalAppts,
                'confirmed' => $confirmedAppts,
                'completed' => $completedAppts,
                'cancelled' => $cancelledAppts,
                'no_show' => $noShowAppts,
                'in_treatment' => $inTreatmentAppts,
                'completion_rate_pct' => $completionRate,
            ],
            'patient_flow' => [
                'total_visits' => $totalVisits,
                'served_from_queue' => $servedQueueCount,
                'current_waiting' => $waitingQueueCount,
            ],
            'hmo' => [
                'total_cases' => $totalHmo,
                'approved' => $approvedHmo,
                'pending' => $pendingHmo,
                'withdrawn' => $withdrawnHmo,
                'rejected' => $rejectedHmo,
                'approved_amount_php' => round($approvedHmoAmount, 2),
            ],
            'automation' => [
                'total_actions' => $totalActions,
                'success' => $successActions,
                'warning' => $warningActions,
                'failed' => $failedActions,
                'health_rate_pct' => $automationHealthRate,
            ],
        ];
    }

    /**
     * Per-branch comparative performance breakdown.
     */
    public function getBranchPerformance(
        ?string $period = 'today',
        ?string $dateFrom = null,
        ?string $dateTo = null
    ): Collection {
        $bounds = $this->parsePeriod($period, $dateFrom, $dateTo);
        $from = $bounds['from'];
        $to = $bounds['to'];

        $branches = Branch::orderBy('name')->get();

        return $branches->map(function (Branch $b) use ($from, $to) {
            $invoices = Invoice::where('branch_id', $b->id)
                ->when($from && $to, fn($q) => $q->whereBetween('created_at', [$from, $to]))
                ->where('status', 'Paid')
                ->get();

            $revenue = $invoices->sum(fn(Invoice $i) => (float) $i->paid_amount);

            $apptsQuery = Appointment::where('branch_id', $b->id)
                ->when($from && $to, fn($q) => $q->whereBetween('starts_at', [$from, $to]));
            $totalAppts = (clone $apptsQuery)->count();
            $completedAppts = (clone $apptsQuery)->where('status', 'Completed')->count();

            $activeQueue = QueueEntry::whereHas('visit', fn($q) => $q->where('branch_id', $b->id))
                ->whereIn('status', ['Waiting', 'Called', 'Treatment Ready'])
                ->count();

            $capacityThreshold = $b->capacity_threshold ?: 80;
            $estimatedWait = $activeQueue * 15; // Approximate 15m per positional entry

            return [
                'branch_id' => $b->id,
                'public_id' => $b->public_id,
                'name' => $b->name,
                'code' => $b->branch_code,
                'city' => $b->city,
                'revenue_collected_php' => round($revenue, 2),
                'total_appointments' => $totalAppts,
                'completed_appointments' => $completedAppts,
                'active_queue' => $activeQueue,
                'capacity_threshold' => $capacityThreshold,
                'estimated_wait_minutes' => $estimatedWait,
                'is_open' => $b->status === 'Open',
            ];
        });
    }
}
