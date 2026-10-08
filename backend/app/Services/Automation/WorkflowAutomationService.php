<?php

namespace App\Services\Automation;

use App\Models\AutomatedAction;
use App\Models\Branch;
use App\Models\HmoCase;
use App\Models\SystemEvent;
use App\Models\User;
use App\Models\WorkflowRule;
use App\Services\Audit\AuditService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class WorkflowAutomationService
{
    /** Unconfirmed demonstration value; not clinic policy and not an active alert threshold. */
    private const DEMONSTRATION_WAIT_MINUTES = 35;

    public function __construct(
        private readonly AuditService $auditService
    ) {}

    /**
     * Record a system event and automatically evaluate any matching active rules.
     * Duplicate event idempotency is strictly enforced.
     */
    public function recordEvent(array $data): SystemEvent
    {
        $idempotencyKey = $data['idempotency_key'] ?? ('event_' . md5(($data['event_type'] ?? 'generic') . '_' . ($data['aggregate_id'] ?? '') . '_' . microtime(true)));

        // Idempotency check: return existing event if key matches
        $existing = SystemEvent::where('idempotency_key', $idempotencyKey)->first();
        if ($existing) {
            return $existing->load(['actions.rule']);
        }

        $now = CarbonImmutable::now('Asia/Manila');

        return DB::transaction(function () use ($data, $idempotencyKey, $now) {
            $event = SystemEvent::create([
                'public_id' => strtolower((string) Ulid::generate()),
                'event_type' => $data['event_type'],
                'idempotency_key' => $idempotencyKey,
                'domain' => $data['domain'] ?? 'workflow',
                'aggregate_type' => $data['aggregate_type'] ?? null,
                'aggregate_id' => $data['aggregate_id'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
                'actor_user_id' => $data['actor_user_id'] ?? null,
                'payload' => $data['payload'] ?? [],
                'occurred_at' => $data['occurred_at'] ?? $now,
                'created_at' => $now,
            ]);

            // Dispatch matching active rules
            $this->evaluateRulesForEvent($event);

            return $event->fresh(['actions.rule', 'actor.person', 'branch']);
        });
    }

    /**
     * Evaluate active rules for the given system event with duplicate-execution prevention.
     *
     * @return Collection<int, AutomatedAction>
     */
    public function evaluateRulesForEvent(SystemEvent $event): Collection
    {
        $rules = WorkflowRule::where('is_active', true)
            ->where('trigger_event', $event->event_type)
            ->get();

        $actions = new Collection();

        foreach ($rules as $rule) {
            $action = $this->executeRule($rule, $event);
            if ($action) {
                $actions->push($action);
            }
        }

        return $actions;
    }

    /**
     * Execute a single rule for a system event idempotently.
     */
    public function executeRule(WorkflowRule $rule, SystemEvent $event): AutomatedAction
    {
        $actionKey = "rule:{$rule->id}:event:{$event->id}";

        // Check if this action was already performed for this event/rule pair
        $existing = AutomatedAction::where('idempotency_key', $actionKey)->first();
        if ($existing) {
            return $existing->load(['rule', 'event']);
        }

        $now = CarbonImmutable::now('Asia/Manila');
        $execution = $this->resolveRuleOutcome($rule, $event);

        $action = AutomatedAction::create([
            'public_id' => strtolower((string) Ulid::generate()),
            'workflow_rule_id' => $rule->id,
            'system_event_id' => $event->id,
            'idempotency_key' => $actionKey,
            'status' => $execution['status'],
            'result_summary' => $execution['summary'],
            'details' => $execution['details'],
            'executed_at' => $now,
            'created_at' => $now,
        ]);

        // Audit log integration
        $severity = match ($execution['status']) {
            'Failed' => 'critical',
            'Warning' => 'warning',
            default => 'info',
        };

        $this->auditService->recordAutomation(
            action: "automation.rule.{$rule->rule_code}",
            jobName: "Automation Rule {$rule->rule_code}",
            payload: [
                'rule_code' => $rule->rule_code,
                'summary' => $execution['summary'],
                'event_type' => $event->event_type,
                'action_public_id' => $action->public_id,
                'status' => $execution['status'],
                'aggregate' => $event->aggregate_type ? "{$event->aggregate_type}:{$event->aggregate_id}" : null,
            ],
            severity: $severity
        );

        return $action->fresh(['rule', 'event']);
    }

    /**
     * Evaluate one rule against the recorded event. M23 today is an EVALUATION RECORDER: it creates no invoice, task,
     * notification, route, conversation, follow-up or profile. Every summary therefore says what was evaluated and
     * that no business action was performed; the rule's proposed action is shown separately as "proposed". Statuses keep
     * their existing meaning: Success = evaluated without a flagged condition, Warning = a (demonstration) condition
     * matched, Failed = the rule could not be evaluated. A missing observation is never assumed to be zero.
     *
     * The numeric thresholds below are unconfirmed demonstration values (see the follow-up policy map §7); they are not
     * clinic policy and no emitter feeds them.
     */
    private function resolveRuleOutcome(WorkflowRule $rule, SystemEvent $event): array
    {
        $payload = $event->payload ?? [];
        $evaluated = ['execution' => 'evaluation_only'];

        switch ($rule->rule_code) {
            case 'R1_APPT_LIFECYCLE':
                $actionType = is_string($payload['action_type'] ?? null) ? $payload['action_type'] : 'change';

                return [
                    'status' => 'Success',
                    'summary' => "Appointment {$actionType} event evaluated. Evaluation only: no slot, calendar entry or notification was created by this rule.",
                    'details' => $evaluated + ['action' => $actionType, 'appointment_id' => $event->aggregate_id],
                ];

            case 'R2_HMO_FOLLOWUP_REMINDER':
                if (! $this->isWholeNumber($payload['pending_hours'] ?? null)) {
                    return $this->notEvaluable('pending_hours', $evaluated);
                }
                $hours = (int) $payload['pending_hours'];
                $limit = HmoCase::FOLLOW_UP_HOURS;
                $matched = $hours >= $limit;

                return [
                    'status' => $matched ? 'Warning' : 'Success',
                    'summary' => "HMO pending time {$hours}h ".($matched ? 'meets' : 'is below')." the {$limit}-hour demonstration threshold (an unconfirmed project value, not clinic policy). Evaluation only: no follow-up task or notification was created.",
                    'details' => $evaluated + ['pending_hours' => $hours, 'demonstration_threshold_hours' => $limit, 'hmo_case_id' => $event->aggregate_id],
                ];

            case 'R3_CAPACITY_ALERT':
                if (! $this->isWholeNumber($payload['estimated_wait_minutes'] ?? null)) {
                    return $this->notEvaluable('estimated_wait_minutes', $evaluated);
                }
                $minutes = (int) $payload['estimated_wait_minutes'];
                $limit = self::DEMONSTRATION_WAIT_MINUTES;
                $matched = $minutes > $limit;

                return [
                    'status' => $matched ? 'Warning' : 'Success',
                    'summary' => "Estimated wait {$minutes}m ".($matched ? 'exceeds' : 'does not exceed')." the {$limit}-minute demonstration threshold (an unconfirmed project value, not clinic policy). Branch load is not evaluated by this rule. Evaluation only: no alert was sent.",
                    'details' => $evaluated + ['estimated_wait_minutes' => $minutes, 'demonstration_threshold_minutes' => $limit, 'branch_id' => $event->branch_id],
                ];

            case 'R4_TREATMENT_DOWNSTREAM':
                // The follow-up and prescription flags are whatever the emitting caller put in the payload. M23 does not
                // verify that they come from a Dentist-documented Treatment, so they are reported as supplied, never as a
                // clinical decision, and nothing downstream is created.
                $flags = [];
                if (! empty($payload['prescription_required'])) {
                    $flags[] = 'prescription flag';
                }
                if (! empty($payload['followup_required'])) {
                    $flags[] = 'follow-up flag';
                }
                $suppliedFlags = $flags ? ' Caller-supplied '.implode(' and ', $flags).' present; its origin is not verified by M23 and it is not a Dentist-authorized decision.' : '';

                return [
                    'status' => 'Success',
                    'summary' => 'Treatment completed event evaluated.'.$suppliedFlags.' Evaluation only: no invoice, prescription task, follow-up or recall was created.',
                    'details' => $evaluated + ['treatment_id' => $event->aggregate_id, 'prescription_flag_supplied' => ! empty($payload['prescription_required']), 'followup_flag_supplied' => ! empty($payload['followup_required']), 'flag_origin' => 'caller_supplied_unverified'],
                ];

            case 'R5_MESSAGE_ROUTING':
                return [
                    'status' => 'Success',
                    'summary' => 'Message received event evaluated. Evaluation only: nothing was routed, assigned or created; messaging has no routing or creation command.',
                    'details' => $evaluated + ['message_id' => $event->aggregate_id],
                ];

            case 'R6_USER_PROFILE_SYNC':
                return [
                    'status' => 'Success',
                    'summary' => 'User change event evaluated. Evaluation only: no personnel profile was created or synchronised; privileged provisioning is not implemented.',
                    'details' => $evaluated + ['user_id' => $event->aggregate_id],
                ];

            default:
                return [
                    'status' => 'Success',
                    'summary' => "Rule {$rule->name} evaluated. Evaluation only: no business action was performed.",
                    'details' => $evaluated,
                ];
        }
    }

    /** A non-negative whole number (int or digit string); a fraction, exponent or sign is never silently truncated. */
    private function isWholeNumber(mixed $value): bool
    {
        return is_int($value) ? $value >= 0 : (is_string($value) && preg_match('/^\d{1,9}$/', $value) === 1);
    }

    private function notEvaluable(string $field, array $evaluated): array
    {
        return [
            'status' => 'Failed',
            'summary' => "Rule could not be evaluated: the event did not include {$field} as a whole number. Nothing was assumed and no action was performed.",
            'details' => $evaluated + ['missing_observation' => $field],
        ];
    }

    /**
     * Provide authoritative automation monitoring snapshot for Owner/Admin.
     */
    public function getAutomationSnapshot(?int $branchId = null): array
    {
        $rules = WorkflowRule::orderBy('id')->get();
        $actionsQuery = AutomatedAction::with(['rule', 'event.actor.person', 'event.branch']);

        if ($branchId !== null) {
            $actionsQuery->whereHas('event', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            });
        }

        $totalActions = (clone $actionsQuery)->count();
        $successCount = (clone $actionsQuery)->where('status', 'Success')->count();
        $warningCount = (clone $actionsQuery)->where('status', 'Warning')->count();
        $failedCount = (clone $actionsQuery)->where('status', 'Failed')->count();

        // Share of recorded rule EVALUATIONS that finished without a warning or failure. Null when there are none (never 100).
        $successRate = $totalActions > 0 ? (int) round(($successCount / $totalActions) * 100) : null;

        $recentActions = (clone $actionsQuery)
            ->orderByDesc('executed_at')
            ->limit(25)
            ->get();

        $recentExceptions = (clone $actionsQuery)
            ->whereIn('status', ['Warning', 'Failed'])
            ->orderByDesc('executed_at')
            ->limit(15)
            ->get();

        // Calculate rule stats
        $ruleStats = $rules->map(function (WorkflowRule $rule) {
            $ruleActions = AutomatedAction::where('workflow_rule_id', $rule->id);
            $count = $ruleActions->count();
            $lastAction = (clone $ruleActions)->orderByDesc('executed_at')->first();

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
                'total_executions' => $count,
                'last_executed_at' => $lastAction?->executed_at?->toIso8601String(),
                'last_status' => $lastAction?->status ?? 'Active',
            ];
        });

        return [
            'health_rate' => $successRate,
            'execution_model' => 'evaluation_only',
            'total_actions' => $totalActions,
            'success_count' => $successCount,
            'warning_count' => $warningCount,
            'failed_count' => $failedCount,
            'active_rules_count' => $rules->where('is_active', true)->count(),
            'rules' => $ruleStats,
            'recent_actions' => $recentActions->map(fn($a) => $this->formatActionResource($a)),
            'recent_exceptions' => $recentExceptions->map(fn($a) => $this->formatActionResource($a)),
        ];
    }

    /**
     * Trigger manual evaluation / diagnostics run by Owner.
     */
    public function triggerManualEvaluation(User $actor, string $ruleCode, array $context = []): AutomatedAction
    {
        $rule = WorkflowRule::where('rule_code', $ruleCode)->firstOrFail();
        $idempotencyKey = 'manual_eval_' . $rule->rule_code . '_' . microtime(true);

        $event = $this->recordEvent([
            'event_type' => $rule->trigger_event,
            'idempotency_key' => $idempotencyKey,
            'domain' => strtolower($rule->owner_domain),
            'aggregate_type' => $context['aggregate_type'] ?? 'manual_evaluation',
            'aggregate_id' => $context['aggregate_id'] ?? ('eval_' . $rule->rule_code),
            'branch_id' => $context['branch_id'] ?? null,
            'actor_user_id' => $actor->id,
            'payload' => array_merge($context['payload'] ?? [], [
                'triggered_by' => 'Owner Manual Verification',
            ]),
        ]);

        return $this->executeRule($rule, $event);
    }

    public function isLegacyDescription(AutomatedAction $action): bool
    {
        return ! is_array($action->details) || ($action->details['execution'] ?? null) !== 'evaluation_only';
    }

    public function formatActionResource(AutomatedAction $action): array
    {
        return [
            'id' => $action->public_id,
            'rule_code' => $action->rule?->rule_code,
            'rule_name' => $action->rule?->name,
            'owner_domain' => $action->rule?->owner_domain,
            'event_type' => $action->event?->event_type,
            'domain' => $action->event?->domain,
            'status' => $action->status,
            // Every automated_actions row is written by executeRule, which has no side effects: nothing was ever executed.
            'execution' => 'evaluation_only',
            // Rows written before the truthfulness correction carry no `details.execution` marker; their stored wording described a
            // proposed action in the past/present tense. The text is not rewritten, but it is classified so no consumer shows it as proof.
            'summary_kind' => $this->isLegacyDescription($action) ? 'legacy_proposed_description' : 'evaluation_result',
            'result_summary' => $action->result_summary,
            'details' => $action->details,
            'executed_at' => $action->executed_at?->toIso8601String(),
            'executed_at_human' => $action->executed_at?->format('Y-m-d H:i'),
            'aggregate' => $action->event?->aggregate_type ? [
                'type' => $action->event->aggregate_type,
                'id' => $action->event->aggregate_id,
            ] : null,
            'actor' => $action->event?->actor ? [
                'name' => $action->event->actor->name(),
                'email' => $action->event->actor->email,
            ] : null,
            'branch' => $action->event?->branch ? [
                'name' => $action->event->branch->name,
                'code' => $action->event->branch->branch_code,
            ] : null,
        ];
    }
}
