<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\AutomatedAction;
use App\Models\WorkflowRule;
use App\Services\Automation\WorkflowAutomationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AutomationController extends Controller
{
    public function __construct(
        private readonly WorkflowAutomationService $automationService
    ) {}

    private function authorizeOwner(Request $request): void
    {
        abort_unless($request->user() && $request->user()->role === Role::Owner, 403, 'Automation control and monitoring is restricted to the clinic Owner.');
    }

    public function snapshot(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $branchId = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $snapshot = $this->automationService->getAutomationSnapshot($branchId);

        return response()->json([
            'data' => $snapshot,
        ]);
    }

    public function rules(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $rules = WorkflowRule::orderBy('id')->get()->map(function (WorkflowRule $rule) {
            $actionsQuery = AutomatedAction::where('workflow_rule_id', $rule->id);
            $last = (clone $actionsQuery)->orderByDesc('executed_at')->first();

            return [
                'id' => $rule->public_id,
                'rule_code' => $rule->rule_code,
                'name' => $rule->name,
                'trigger_event' => $rule->trigger_event,
                'target_domains' => $rule->target_domains,
                'condition' => $rule->condition_description,
                'action' => $rule->action_description,
                'owner' => $rule->owner_domain,
                'is_active' => $rule->is_active,
                'total_executions' => (clone $actionsQuery)->count(),
                'last_executed_at' => $last?->executed_at?->toIso8601String(),
                'last_status' => $last?->status ?? 'Active',
            ];
        });

        return response()->json([
            'data' => $rules,
        ]);
    }

    public function actions(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $query = AutomatedAction::with(['rule', 'event.actor.person', 'event.branch']);

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->status($request->input('status'));
        }

        if ($request->filled('rule_code')) {
            $query->whereHas('rule', function ($q) use ($request) {
                $q->where('rule_code', $request->input('rule_code'));
            });
        }

        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('result_summary', 'ilike', "%{$s}%")
                    ->orWhereHas('rule', function ($rq) use ($s) {
                        $rq->where('name', 'ilike', "%{$s}%")
                            ->orWhere('rule_code', 'ilike', "%{$s}%");
                    });
            });
        }

        if ($request->filled('date_from')) {
            $from = CarbonImmutable::parse($request->input('date_from'), 'Asia/Manila')->startOfDay();
            $query->where('executed_at', '>=', $from);
        }

        if ($request->filled('date_to')) {
            $to = CarbonImmutable::parse($request->input('date_to'), 'Asia/Manila')->endOfDay();
            $query->where('executed_at', '<=', $to);
        }

        $perPage = min((int) ($request->input('per_page', 25)), 100);
        $paginator = $query->orderByDesc('executed_at')->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn($a) => $this->automationService->formatActionResource($a)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function dispatch(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $validated = $request->validate([
            'rule_code' => ['required', 'string', 'exists:workflow_rules,rule_code'],
            'payload' => ['nullable', 'array'],
        ]);

        $action = $this->automationService->triggerManualEvaluation(
            actor: $request->user(),
            ruleCode: $validated['rule_code'],
            context: ['payload' => $validated['payload'] ?? []]
        );

        return response()->json([
            'data' => $this->automationService->formatActionResource($action),
            'message' => "Rule {$action->rule->name} executed with status {$action->status}.",
        ], 201);
    }

    public function exportCsv(Request $request): StreamedResponse|JsonResponse
    {
        $this->authorizeOwner($request);

        $query = AutomatedAction::with(['rule', 'event.actor.person', 'event.branch'])
            ->orderByDesc('executed_at');

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->status($request->input('status'));
        }

        $filename = 'automation-activity-' . CarbonImmutable::now('Asia/Manila')->format('Ymd-His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache',
        ];

        return response()->stream(function () use ($query) {
            $handle = fopen('php://output', 'w');

            // BOM for Excel UTF-8 compliance
            fputs($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Executed At (Manila)',
                'Status',
                'Rule Code',
                'Rule Name',
                'Owner Domain',
                'Event Type',
                'Result Summary',
                'Aggregate',
                'Actor',
                'Branch',
            ]);

            $query->chunk(100, function ($actions) use ($handle) {
                foreach ($actions as $action) {
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

                    fputcsv($handle, [
                        $action->executed_at?->format('Y-m-d H:i:s'),
                        $action->status,
                        $sanitize($action->rule?->rule_code),
                        $sanitize($action->rule?->name),
                        $sanitize($action->rule?->owner_domain),
                        $sanitize($action->event?->event_type),
                        $sanitize($action->result_summary),
                        $sanitize($action->event?->aggregate_type ? "{$action->event->aggregate_type}:{$action->event->aggregate_id}" : ''),
                        $sanitize($action->event?->actor?->email ?? 'System Automation'),
                        $sanitize($action->event?->branch?->name ?? 'All Branches'),
                    ]);
                }
            });

            fclose($handle);
        }, 200, $headers);
    }
}
