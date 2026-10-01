<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Services\Analytics\AnalyticsService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AnalyticsController extends Controller
{
    public function __construct(
        private readonly AnalyticsService $analyticsService
    ) {}

    private function authorizeOwner(Request $request): void
    {
        abort_unless($request->user() && $request->user()->role === Role::Owner, 403, 'Executive analytics and reports are restricted to the clinic Owner.');
    }

    public function executiveSummary(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $period = $request->input('period', 'today');
        $branchId = $request->filled('branch_id') && $request->input('branch_id') !== 'all'
            ? (int) $request->input('branch_id')
            : null;
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $summary = $this->analyticsService->getExecutiveSummary($period, $branchId, $dateFrom, $dateTo);

        return response()->json([
            'data' => $summary,
        ]);
    }

    public function branchPerformance(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $period = $request->input('period', 'today');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $branches = $this->analyticsService->getBranchPerformance($period, $dateFrom, $dateTo);

        return response()->json([
            'data' => $branches,
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorizeOwner($request);

        $period = $request->input('period', 'today');
        $branchId = $request->filled('branch_id') && $request->input('branch_id') !== 'all'
            ? (int) $request->input('branch_id')
            : null;
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $summary = $this->analyticsService->getExecutiveSummary($period, $branchId, $dateFrom, $dateTo);
        $branches = $this->analyticsService->getBranchPerformance($period, $dateFrom, $dateTo);

        $filename = 'operational-analytics-' . CarbonImmutable::now('Asia/Manila')->format('Ymd-His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache',
        ];

        return response()->stream(function () use ($summary, $branches) {
            $handle = fopen('php://output', 'w');

            // BOM for UTF-8
            fputs($handle, "\xEF\xBB\xBF");

            $sanitize = function (?string $value): string {
                if ($value === null || $value === '') {
                    return '';
                }
                $first = $value[0] ?? '';
                if (in_array($first, ['=', '+', '-', '@'], true)) {
                    return "'" . $value;
                }
                return $value;
            };

            // Section 1: Executive KPI Summary
            fputcsv($handle, ['EXECUTIVE OPERATIONAL SUMMARY']);
            fputcsv($handle, ['Reporting Period', $sanitize($summary['period_label'])]);
            fputcsv($handle, []);
            fputcsv($handle, ['Metric Category', 'Metric Name', 'Value (PHP / Count)']);
            fputcsv($handle, ['Financial', 'Total Revenue Collected', number_format($summary['financials']['total_collected_php'], 2)]);
            fputcsv($handle, ['Financial', 'Gross Invoiced Amount', number_format($summary['financials']['total_gross_php'], 2)]);
            fputcsv($handle, ['Financial', 'HMO Covered Amount', number_format($summary['financials']['total_hmo_covered_php'], 2)]);
            fputcsv($handle, ['Financial', 'Outstanding Balance', number_format($summary['financials']['outstanding_balance_php'], 2)]);
            fputcsv($handle, ['Financial', 'Paid Invoices Count', $summary['financials']['paid_invoices_count']]);
            fputcsv($handle, ['Scheduling', 'Total Appointments', $summary['scheduling']['total_appointments']]);
            fputcsv($handle, ['Scheduling', 'Completed Appointments', $summary['scheduling']['completed']]);
            fputcsv($handle, ['Scheduling', 'Completion Rate (%)', $summary['scheduling']['completion_rate_pct'] . '%']);
            fputcsv($handle, ['Patient Flow', 'Total Patient Visits', $summary['patient_flow']['total_visits']]);
            fputcsv($handle, ['Patient Flow', 'Served From Queue', $summary['patient_flow']['served_from_queue']]);
            fputcsv($handle, ['HMO Operations', 'Approved Claims Count', $summary['hmo']['approved']]);
            fputcsv($handle, ['HMO Operations', 'Approved Amount (PHP)', number_format($summary['hmo']['approved_amount_php'], 2)]);
            fputcsv($handle, ['Automation', 'Automation Health Rate (%)', $summary['automation']['health_rate_pct'] . '%']);
            fputcsv($handle, []);

            // Section 2: Branch Comparative Performance
            fputcsv($handle, ['BRANCH COMPARATIVE BREAKDOWN']);
            fputcsv($handle, [
                'Branch Name',
                'Code',
                'City',
                'Revenue Collected (PHP)',
                'Appointments',
                'Completed Appointments',
                'Active Queue',
                'Capacity Threshold (%)',
                'Estimated Wait (min)',
            ]);

            foreach ($branches as $b) {
                fputcsv($handle, [
                    $sanitize($b['name']),
                    $sanitize($b['code']),
                    $sanitize($b['city']),
                    number_format($b['revenue_collected_php'], 2),
                    $b['total_appointments'],
                    $b['completed_appointments'],
                    $b['active_queue'],
                    $b['capacity_threshold'],
                    $b['estimated_wait_minutes'],
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
