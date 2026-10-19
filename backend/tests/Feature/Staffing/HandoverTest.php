<?php

namespace Tests\Feature\Staffing;

use App\Models\AuditLog;
use App\Models\PatientHandover;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

/** M25 Patient Handovers, frozen at Monday 2026-09-28 10:00 Asia/Manila (SchedulingFixture: b1 with d1, d2; b2 with d3). */
class HandoverTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private const SUMMARY = 'Root canal started on tooth 36, temporary filling placed';

    private const PENDING = 'Finish obturation and crown';

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->setUpSchedulingWorld();
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-21', '10:00', 30, 'Completed'); // patient A is cared for at b1 by d1
    }

    private function send(array $extra = [])
    {
        return $this->postJson('/api/handovers', $extra + ['patient_id' => $this->p['A']->public_id, 'from_branch_ref' => 'b1', 'to_branch_ref' => 'b2', 'to_dentist_ref' => 'd3',
            'summary' => self::SUMMARY, 'pending_treatment' => self::PENDING, 'notes' => 'Patient prefers mornings']);
    }

    private function access(string $who): string
    {
        $this->actingAsUser($who);

        return $this->getJson('/api/patients/'.$this->p['A']->public_id)->assertOk()->json('data.profile_access');
    }

    public function test_a_handover_grants_the_receiving_branch_and_dentist_and_ends_after_the_owner_days(): void
    {
        $this->assertSame('identity', $this->access('staffB2'));
        $this->actingAsUser('staffB1');
        $id = $this->send()->assertCreated()->assertJsonPath('data.status', 'Sent')->json('data.id');

        $this->assertSame('full', $this->access('staffB2')); // the receiving front desk, through the branch rule
        $this->actingAsUser('staffB2');
        $this->getJson("/api/handovers/$id")->assertOk()->assertJsonPath('data.summary', self::SUMMARY)->assertJsonPath('data.side', 'receiving');
        $this->actingAsUser('dentist3');
        $this->getJson("/api/handovers/$id")->assertOk()->assertJsonPath('data.pending_treatment', self::PENDING);
        $this->getJson('/api/patients/'.$this->p['A']->public_id)->assertForbidden(); // dentists still have no generic record access
        $this->assertTrue(UserNotification::where('user_id', $this->u['dentist3']->id)->where('kind', 'handover_received')->exists());
        $this->assertTrue(UserNotification::where('user_id', $this->u['staffB2']->id)->where('kind', 'handover_received')->exists());

        // Not widened for anyone else.
        $this->actingAsUser('dentist2');
        $this->getJson("/api/handovers/$id")->assertNotFound();
        $this->actingAsUser('staffNone');
        $this->getJson("/api/handovers/$id")->assertNotFound();
        $this->actingAsUser('patientA');
        $this->getJson("/api/handovers/$id")->assertForbidden();

        // Acknowledge, then the access lasts the Owner's days (60 by default) unless the patient has a visit there.
        $this->actingAsUser('staffB2');
        $this->postJson("/api/handovers/$id/acknowledge")->assertOk()->assertJsonPath('data.status', 'Acknowledged');
        $this->postJson("/api/handovers/$id/acknowledge")->assertStatus(422);
        $this->travel(59)->days();
        $this->assertSame('full', $this->access('staffB2'));
        $this->travel(2)->days();
        $this->assertSame('identity', $this->access('staffB2'));
    }

    public function test_the_owner_sees_metadata_only_the_patient_a_neutral_notice_and_audit_holds_no_clinical_text(): void
    {
        $this->actingAsUser('staffB1');
        $id = $this->send()->assertCreated()->json('data.id');
        $this->actingAsUser('staffB2');
        $this->getJson("/api/handovers/$id")->assertOk();

        $this->actingAsUser('owner');
        $list = $this->getJson('/api/handovers')->assertOk();
        $this->assertSame('Branch B2', $list->json('data.0.to.branch.name'));
        $one = $this->getJson("/api/handovers/$id")->assertOk();
        foreach ([$list->getContent(), $one->getContent()] as $body) {
            $this->assertStringNotContainsString(self::SUMMARY, $body);
            $this->assertStringNotContainsString(self::PENDING, $body);
        }

        $notice = UserNotification::where('user_id', $this->u['patientA']->id)->where('kind', 'record_shared')->sole();
        $this->assertSame('Your patient record was shared with Branch B2 so they can continue your care.', $notice->body);

        $audit = AuditLog::where('action', 'like', 'handover.%')->get();
        $this->assertSame(['handover.created', 'handover.viewed'], $audit->pluck('action')->all());
        $everything = $audit->toJson().UserNotification::all()->toJson();
        foreach ([self::SUMMARY, self::PENDING, 'mornings'] as $text) $this->assertStringNotContainsString($text, $everything);
        $this->assertNotSame(self::SUMMARY, \DB::table('patient_handovers')->value('summary')); // encrypted at rest
    }

    public function test_only_the_caring_side_sends_documents_must_be_the_patients_and_the_sender_alone_cancels(): void
    {
        $this->actingAsUser('staffB2');
        $this->send(['from_branch_ref' => 'b2', 'to_branch_ref' => 'b1', 'to_dentist_ref' => null])->assertForbidden(); // patient A is not theirs
        $this->actingAsUser('dentist2');
        $this->send()->assertForbidden(); // not the treating dentist
        $this->actingAsUser('dentist1');
        $this->send(['document_ids' => ['01JXXXXXXXXXXXXXXXXXXXXXXX']])->assertStatus(422);
        $this->send(['to_dentist_ref' => 'd1'])->assertStatus(422); // d1 does not work at b2
        $id = $this->send()->assertCreated()->assertJsonPath('data.from.dentist.id', 'd1')->json('data.id');

        $this->actingAsUser('staffB2');
        $this->postJson("/api/handovers/$id/cancel")->assertForbidden();
        $this->actingAsUser('staffB1');
        $this->postJson("/api/handovers/$id/cancel")->assertOk()->assertJsonPath('data.status', 'Cancelled');
        $this->assertSame('identity', $this->access('staffB2')); // a cancelled handover grants nothing
        $this->expectException(\Illuminate\Database\QueryException::class);
        PatientHandover::query()->delete();
    }

    public function test_request_handover_from_the_duplicate_guard_asks_the_branch_that_has_the_record(): void
    {
        $this->actingAsUser('staffB2');
        $this->postJson('/api/handovers/request', ['patient_id' => $this->p['A']->public_id])->assertOk()->assertJsonPath('data.branch', 'Branch B1');
        $this->assertTrue(UserNotification::where('user_id', $this->u['staffB1']->id)->where('kind', 'handover_received')->exists());
        $this->assertTrue(AuditLog::where('action', 'handover.requested')->exists());
        $this->actingAsUser('staffB1');
        $this->postJson('/api/handovers/request', ['patient_id' => $this->p['A']->public_id])->assertStatus(422); // nothing to ask: it is theirs
    }
}
