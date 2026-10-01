<?php

namespace Tests\Feature\Automation;

use App\Models\AutomatedAction;
use App\Models\AuditLog;
use App\Models\SystemEvent;
use App\Models\WorkflowRule;
use App\Services\Automation\WorkflowAutomationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

class AutomationControlTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private WorkflowAutomationService $automationService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        $this->automationService = app(WorkflowAutomationService::class);
    }

    public function test_unauthenticated_cannot_access_automation_endpoints(): void
    {
        $this->getJson('/api/automation/snapshot')->assertStatus(401);
        $this->getJson('/api/automation/rules')->assertStatus(401);
        $this->getJson('/api/automation/actions')->assertStatus(401);
        $this->postJson('/api/automation/dispatch', ['rule_code' => 'R1_APPT_LIFECYCLE'])->assertStatus(401);
    }

    public function test_staff_and_dentist_and_patient_are_forbidden_from_automation(): void
    {
        $this->actingAsUser('staffB1');
        $this->getJson('/api/automation/snapshot')->assertStatus(403);

        $this->actingAsUser('dentist1');
        $this->getJson('/api/automation/snapshot')->assertStatus(403);

        $this->actingAsUser('patientA');
        $this->getJson('/api/automation/snapshot')->assertStatus(403);
    }

    public function test_owner_can_view_automation_rules_and_snapshot(): void
    {
        $this->actingAsUser('owner');

        $response = $this->getJson('/api/automation/snapshot')->assertStatus(200);

        $response->assertJsonStructure([
            'data' => [
                'health_rate',
                'total_actions',
                'success_count',
                'warning_count',
                'failed_count',
                'active_rules_count',
                'rules',
                'recent_actions',
                'recent_exceptions',
            ],
        ]);

        $rulesResponse = $this->getJson('/api/automation/rules')->assertStatus(200);

        $rulesResponse->assertJsonFragment(['rule_code' => 'R1_APPT_LIFECYCLE']);
        $rulesResponse->assertJsonFragment(['rule_code' => 'R2_HMO_FOLLOWUP_REMINDER']);
    }

    public function test_system_event_recording_executes_rule_and_is_idempotent(): void
    {
        $eventKey = 'test_event_treatment_001';

        // 1st recording
        $event1 = $this->automationService->recordEvent([
            'event_type' => 'clinical.treatment.completed',
            'idempotency_key' => $eventKey,
            'domain' => 'clinical',
            'aggregate_type' => 'treatment',
            'aggregate_id' => 'trt_123',
            'branch_id' => $this->b['b1']->id,
            'actor_user_id' => $this->u['owner']->id,
            'payload' => [
                'prescription_required' => true,
                'followup_required' => false,
            ],
        ]);

        $this->assertNotNull($event1->id);
        $this->assertEquals(1, $event1->actions()->count());
        $action = $event1->actions()->first();
        $this->assertEquals('Success', $action->status);
        $this->assertStringContainsString('Treatment completed', $action->result_summary);

        // 2nd recording with identical idempotency key returns exact same event without duplicate actions
        $event2 = $this->automationService->recordEvent([
            'event_type' => 'clinical.treatment.completed',
            'idempotency_key' => $eventKey,
            'domain' => 'clinical',
            'aggregate_type' => 'treatment',
            'aggregate_id' => 'trt_123',
        ]);

        $this->assertEquals($event1->id, $event2->id);
        $this->assertEquals(1, AutomatedAction::where('system_event_id', $event1->id)->count());
    }

    public function test_automated_actions_and_system_events_are_append_only(): void
    {
        $event = $this->automationService->recordEvent([
            'event_type' => 'communication.message.received',
            'idempotency_key' => 'msg_evt_append_test',
            'domain' => 'communication',
            'payload' => ['message_id' => 'msg_999'],
        ]);

        $action = $event->actions()->first();
        $this->assertNotNull($action);

        $this->expectException(RuntimeException::class);
        $action->update(['status' => 'Failed']);
    }

    public function test_system_event_delete_throws_runtime_exception(): void
    {
        $event = $this->automationService->recordEvent([
            'event_type' => 'access.user.changed',
            'idempotency_key' => 'user_sync_test',
            'domain' => 'access',
            'payload' => ['role' => 'Staff'],
        ]);

        $this->expectException(RuntimeException::class);
        $event->delete();
    }

    public function test_owner_can_trigger_manual_evaluation_and_audit_is_created(): void
    {
        $this->actingAsUser('owner');

        $response = $this->postJson('/api/automation/dispatch', [
            'rule_code' => 'R2_HMO_FOLLOWUP_REMINDER',
            'payload' => [
                'pending_hours' => 14,
            ],
        ])->assertStatus(201);

        $response->assertJsonPath('data.status', 'Warning');
        $response->assertJsonPath('data.rule_code', 'R2_HMO_FOLLOWUP_REMINDER');

        // Verify audit log entry was created
        $audit = AuditLog::where('category', 'automation')->latest('id')->first();
        $this->assertNotNull($audit);
        $this->assertEquals('warning', $audit->severity);
        $this->assertStringContainsString('R2_HMO_FOLLOWUP_REMINDER', $audit->action);
    }

    public function test_csv_export_neutralizes_formula_injection(): void
    {
        $this->automationService->recordEvent([
            'event_type' => 'appointment.lifecycle.changed',
            'idempotency_key' => 'csv_formula_test',
            'domain' => 'appointment',
            'payload' => [
                'action_type' => '=cmd|/c calc!A0',
            ],
        ]);

        $this->actingAsUser('owner');

        $response = $this->get('/api/automation/export-csv')
            ->assertStatus(200);

        $this->assertEquals('text/csv; charset=UTF-8', $response->headers->get('Content-Type'));

        $content = $response->streamedContent();
        $this->assertStringNotContainsString('",=cmd', $content);
    }
}
