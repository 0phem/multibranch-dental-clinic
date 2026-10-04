<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use App\Services\Audit\AuditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Representative events from the hardened modules: minimal metadata, one event per logical change, and audit participating in
// the authoritative transaction. Clock frozen by SchedulingFixture.
class AuditEmittersTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    private function failingAudit(): void
    {
        $this->app->bind(AuditService::class, fn () => new class extends AuditService {
            public function record(array $attributes): AuditLog
            {
                throw new \RuntimeException('audit store unavailable');
            }
        });
    }

    // ---- M1 -------------------------------------------------------------------------------------------------------

    public function test_login_events_identify_the_actor_and_never_record_credentials_or_the_attempted_email(): void
    {
        $this->postJson('/api/login', ['email' => $this->u['owner']->email, 'password' => 'wrong-password-123'])->assertStatus(422);
        $failed = AuditLog::where('action', 'auth.login_failed')->sole();
        $this->assertSame([null, 'anonymous', 'security'], [$failed->actor_user_id, $failed->actor_role, $failed->category]);
        $this->assertStringNotContainsString($this->u['owner']->email, json_encode($failed->toArray()));
        $this->assertStringNotContainsString('wrong-password', json_encode($failed->toArray()));

        $this->postJson('/api/login', ['email' => $this->u['owner']->email, 'password' => 'Passw0rd!'])->assertOk();
        $ok = AuditLog::where('action', 'auth.login')->sole();
        $this->assertSame([$this->u['owner']->id, 'owner'], [$ok->actor_user_id, $ok->actor_role]);
    }

    public function test_account_changes_record_field_names_not_values_and_repeats_do_not_duplicate(): void
    {
        $this->actingAsUser('owner');
        $id = $this->u['patientA']->public_id;
        $this->patchJson("/api/users/{$id}", ['first_name' => 'Renamed', 'phone' => '+639171234567'])->assertOk();
        $log = AuditLog::where('action', 'account.updated')->sole();
        $this->assertEqualsCanonicalizing(['first_name', 'phone'], $log->payload['fields']);
        $this->assertStringNotContainsString('Renamed', json_encode($log->payload));
        $this->assertSame($id, $log->auditable_public_id);

        $this->postJson("/api/users/{$id}/suspend")->assertOk();
        $this->postJson("/api/users/{$id}/suspend")->assertOk(); // repeat-safe command
        $this->assertSame(1, AuditLog::where('action', 'account.suspended')->count(), 'one event for one logical change');
        $this->postJson("/api/users/{$id}/restore")->assertOk();
        $this->postJson("/api/users/{$id}/restore")->assertOk();
        $this->assertSame(1, AuditLog::where('action', 'account.restored')->count());
    }

    public function test_a_staff_account_hitting_an_owner_route_is_recorded_as_a_security_event(): void
    {
        $this->actingAsUser('staffB1');
        $this->getJson('/api/users')->assertForbidden();
        $log = AuditLog::where('action', 'account.access_denied')->sole();
        $this->assertSame(['security', 'warning', $this->u['staffB1']->id], [$log->category, $log->severity, $log->actor_user_id]);
    }

    public function test_repeated_forbidden_requests_cannot_write_unlimited_audit_rows(): void
    {
        // There is no throttle on these routes, so the audit write itself is bounded per account (framework RateLimiter).
        $this->actingAsUser('staffB1');
        for ($i = 0; $i < 12; $i++) {
            $this->getJson('/api/users')->assertForbidden(); // authorization is never weakened or hidden
        }
        $this->assertSame(5, AuditLog::where('action', 'account.access_denied')->count(), 'the first denials are recorded, the rest are bounded');
        $first = AuditLog::where('action', 'account.access_denied')->orderBy('id')->first();
        $this->assertSame([$this->u['staffB1']->id, 'security', 'warning'], [$first->actor_user_id, $first->category, $first->severity], 'the first meaningful denial is not suppressed');

        // Another account has its own budget.
        $this->actingAsUser('dentist1');
        $this->getJson('/api/users')->assertForbidden();
        $this->assertSame(6, AuditLog::where('action', 'account.access_denied')->count());

        // The next window records again and reports how many were not written.
        $this->travel(61)->seconds();
        $this->actingAsUser('staffB1');
        $this->getJson('/api/users')->assertForbidden();
        $latest = AuditLog::where('action', 'account.access_denied')->where('actor_user_id', $this->u['staffB1']->id)->orderByDesc('id')->first();
        $this->assertSame(7, $latest->payload['suppressed_since_last_event']);
        $this->assertSame(7, AuditLog::where('action', 'account.access_denied')->count());
    }

    public function test_a_client_cannot_influence_whether_a_denial_is_audited(): void
    {
        $this->actingAsUser('staffB1');
        $this->getJson('/api/users?audit=false', ['X-Skip-Audit' => '1', 'X-Forwarded-For' => '203.0.113.9'])->assertForbidden();
        $this->assertSame(1, AuditLog::where('action', 'account.access_denied')->count());
        $this->assertSame(0, AuditLog::where('action', 'account.access_denied')->whereNotNull('payload->suppressed_since_last_event')->count());
    }

    // ---- M2 / M4: the event and the change commit or roll back together ---------------------------------------------------

    public function test_branch_update_and_its_audit_event_commit_together_with_field_names_only(): void
    {
        $this->actingAsUser('owner');
        $this->patchJson('/api/branches/b1', ['phone' => '(02) 8123 9999'])->assertOk();
        $log = AuditLog::where('action', 'branch.updated')->sole();
        $this->assertSame(['phone'], $log->payload['fields']);
        $this->assertSame($this->b['b1']->id, $log->branch_id);
        $this->assertStringNotContainsString('9999', json_encode($log->payload));
    }

    public function test_a_failed_audit_rolls_back_the_patient_profile_change(): void
    {
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-30', '10:00');
        $before = $this->p['A']->person->fresh()->phone;
        $this->failingAudit();
        $this->actingAsUser('staffB1');
        $this->withoutExceptionHandling();
        try {
            $this->patchJson('/api/patients/'.$this->p['A']->public_id, ['expected_revision' => 1, 'phone' => '+639171111111']);
            $this->fail('the change should not succeed without its audit event');
        } catch (\RuntimeException $e) {
            $this->assertSame('audit store unavailable', $e->getMessage());
        }
        $this->assertSame($before, $this->p['A']->person->fresh()->phone);
        $this->assertSame(1, $this->p['A']->fresh()->revision);
        $this->assertSame(0, AuditLog::count());
    }

    public function test_a_replayed_walk_in_registration_writes_one_audit_event(): void
    {
        $this->actingAsUser('staffB1');
        $body = ['first_name' => 'Walk', 'last_name' => 'In', 'email' => 'walk@example.test'];
        $first = $this->postJson('/api/patients', $body, ['Idempotency-Key' => 'reg-1'])->assertCreated()->json('data.id');
        $second = $this->postJson('/api/patients', $body, ['Idempotency-Key' => 'reg-1'])->assertCreated()->json('data.id');
        $this->assertSame($first, $second);
        $this->assertSame(1, AuditLog::where('action', 'patient.registered')->count());
        $log = AuditLog::where('action', 'patient.registered')->sole();
        $this->assertStringNotContainsString('walk@example.test', json_encode($log->payload));
        $this->assertSame($first, $log->auditable_public_id);
    }

    public function test_the_patient_profile_event_carries_field_names_and_no_values(): void
    {
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-30', '10:00');
        $this->actingAsUser('staffB1');
        $this->patchJson('/api/patients/'.$this->p['A']->public_id, ['expected_revision' => 1, 'phone' => '+639171111111', 'emergency_contact' => 'Secret Person 0917'])->assertOk();
        $log = AuditLog::where('action', 'patient.profile.updated')->sole();
        $this->assertEqualsCanonicalizing(['phone', 'emergency_contact'], $log->payload['fields']);
        $this->assertStringNotContainsString('Secret Person', json_encode($log->payload));
        $this->assertStringNotContainsString('639171111111', json_encode($log->payload));
        $this->assertSame('clinical', $log->category);
    }
}
