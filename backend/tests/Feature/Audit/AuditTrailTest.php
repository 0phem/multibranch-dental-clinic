<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use App\Services\Audit\AuditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

class AuditTrailTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private AuditService $auditService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        $this->auditService = app(AuditService::class);
        Storage::fake('local');
    }

    public function test_audit_logs_are_append_only_and_cannot_be_updated_or_deleted(): void
    {
        $log = $this->auditService->record([
            'action' => 'user.login',
            'category' => 'security',
            'severity' => 'info',
            'actor' => $this->u['owner'],
            'payload' => ['ip' => '127.0.0.1'],
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Audit logs are append-only');
        $log->update(['action' => 'tampered.action']);
    }

    public function test_audit_logs_cannot_be_deleted(): void
    {
        $log = $this->auditService->record([
            'action' => 'user.login',
            'category' => 'security',
            'severity' => 'info',
            'actor' => $this->u['owner'],
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Audit logs are immutable');
        $log->delete();
    }

    public function test_only_owner_can_access_audit_logs(): void
    {
        $this->auditService->record([
            'action' => 'config.updated',
            'category' => 'administrative',
            'actor' => $this->u['owner'],
        ]);

        // Owner can read
        $this->actingAsUser('owner');
        $this->getJson('/api/audit-logs')->assertOk()->assertJsonCount(1, 'data');

        // Staff is forbidden
        $this->actingAsUser('staffB1');
        $this->getJson('/api/audit-logs')->assertStatus(403);

        // Dentist is forbidden
        $this->actingAsUser('dentist1');
        $this->getJson('/api/audit-logs')->assertStatus(403);

        // Patient is forbidden
        $this->actingAsUser('patientA');
        $this->getJson('/api/audit-logs')->assertStatus(403);
    }

    public function test_sensitive_credentials_and_tokens_are_strictly_redacted_from_payload(): void
    {
        $log = $this->auditService->record([
            'action' => 'auth.attempt',
            'category' => 'security',
            'actor' => $this->u['staffB1'],
            'payload' => [
                'username' => 'staff@example.test',
                'password' => 'SuperSecret123!',
                'nested' => [
                    'api_token' => 'bearer-token-abc',
                    'otp_code' => '123456',
                    'normal_info' => 'harmless',
                ],
            ],
        ]);

        $fresh = $log->fresh();
        $this->assertSame('[REDACTED]', $fresh->payload['password']);
        $this->assertSame('[REDACTED]', $fresh->payload['nested']['api_token']);
        $this->assertSame('[REDACTED]', $fresh->payload['nested']['otp_code']);
        $this->assertSame('harmless', $fresh->payload['nested']['normal_info']);
        $this->assertSame('staff@example.test', $fresh->payload['username']);
    }

    public function test_owner_can_filter_audit_logs_by_category_severity_and_search_term(): void
    {
        $this->actingAsUser('owner');

        $this->auditService->record([
            'action' => 'billing.payment_received',
            'category' => 'financial',
            'severity' => 'info',
            'actor' => $this->u['staffB1'],
            'payload' => ['amount' => '1500.00'],
        ]);

        $this->auditService->record([
            'action' => 'auth.failed_attempt',
            'category' => 'security',
            'severity' => 'warning',
            'actor' => null,
            'actor_name' => 'Unknown Actor',
            'payload' => ['ip' => '192.168.1.100'],
        ]);

        // Filter by category
        $fin = $this->getJson('/api/audit-logs?category=financial')->assertOk()->json('data');
        $this->assertCount(1, $fin);
        $this->assertSame('billing.payment_received', $fin[0]['action']);

        // Filter by severity
        $warn = $this->getJson('/api/audit-logs?severity=warning')->assertOk()->json('data');
        $this->assertCount(1, $warn);
        $this->assertSame('auth.failed_attempt', $warn[0]['action']);

        // Filter by search term
        $search = $this->getJson('/api/audit-logs?search=Unknown')->assertOk()->json('data');
        $this->assertCount(1, $search);
        $this->assertSame('auth.failed_attempt', $search[0]['action']);
    }

    public function test_csv_export_streams_logs_and_neutralizes_formula_injection(): void
    {
        $this->actingAsUser('owner');

        $this->auditService->record([
            'action' => '=cmd|"/C calc"!A0',
            'category' => 'security',
            'severity' => 'critical',
            'actor' => null,
            'actor_name' => '+malicious_user',
            'payload' => ['note' => '@evil_payload'],
        ]);

        $response = $this->get('/api/audit-logs/export')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $content = $response->streamedContent();

        // Formula injection prefixes (=, +, @) must be escaped with single quote '
        $this->assertStringContainsString("'=cmd", $content);
        $this->assertStringContainsString("'+malicious_user", $content);
    }

    public function test_document_upload_and_retraction_generate_real_audit_logs(): void
    {
        $this->actingAsUser('patientA');
        $file = UploadedFile::fake()->create('id.jpg', 200, 'image/jpeg');

        // Document upload
        $doc = $this->postJson('/api/documents', [
            'file' => $file,
            'category' => 'valid_id',
            'title' => 'Patient National ID',
        ])->json('data');

        $uploadLog = AuditLog::where('action', 'document.uploaded')->firstOrFail();
        $this->assertSame('administrative', $uploadLog->category);
        $this->assertSame('info', $uploadLog->severity);
        $this->assertSame($this->u['patientA']->id, $uploadLog->actor_user_id);
        $this->assertSame('valid_id', $uploadLog->payload['category']);

        // Document retraction
        $this->postJson("/api/documents/{$doc['id']}/retract", [
            'reason' => 'Uploaded wrong side of card',
        ])->assertOk();

        $retractLog = AuditLog::where('action', 'document.retracted')->firstOrFail();
        $this->assertSame('warning', $retractLog->severity);
        $this->assertSame('Uploaded wrong side of card', $retractLog->payload['reason']);
    }
}
