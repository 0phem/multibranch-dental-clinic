<?php

namespace Tests\Feature\Operations;

use App\Models\BranchClosure;
use App\Models\Conversation;
use App\Models\Inquiry;
use App\Models\Role;
use App\Models\Service;
use App\Services\Messaging\MessagingService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

class Batch4ServerRulesTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
    }

    public function test_closure_date_range_rejects_end_date_before_start_date(): void
    {
        $this->actingAsUser('owner');
        $this->postJson('/api/branch-closures', [
            'branch_ref' => 'b1',
            'date' => '2026-10-15',
            'end_date' => '2026-10-10',
            'reason' => 'Renovation',
        ])->assertStatus(422)->assertJsonValidationErrors(['end_date']);
    }

    public function test_closure_date_range_rejects_ranges_exceeding_31_days(): void
    {
        $this->actingAsUser('owner');
        $this->postJson('/api/branch-closures', [
            'branch_ref' => 'b1',
            'date' => '2026-10-01',
            'end_date' => '2026-11-05',
            'reason' => 'Extended Renovation',
        ])->assertStatus(422)->assertJsonValidationErrors(['end_date']);
    }

    public function test_closure_creation_refuses_wrong_roles(): void
    {
        $this->actingAsUser('staffB1');
        $this->postJson('/api/branch-closures', [
            'branch_ref' => 'b1',
            'date' => '2026-10-01',
            'reason' => 'Staff closure attempt',
        ])->assertForbidden();

        $this->actingAsUser('patientA');
        $this->postJson('/api/branch-closures', [
            'branch_ref' => 'b1',
            'date' => '2026-10-01',
            'reason' => 'Patient closure attempt',
        ])->assertForbidden();
    }

    public function test_closure_date_range_within_31_days_creates_entries_for_each_date(): void
    {
        $this->actingAsUser('owner');
        $this->postJson('/api/branch-closures', [
            'branch_ref' => 'b1',
            'date' => '2026-10-01',
            'end_date' => '2026-10-03',
            'reason' => 'Clinic repair',
        ])->assertCreated();

        $this->assertSame(3, BranchClosure::where('branch_id', $this->b['b1']->id)->count());
    }

    public function test_closing_conversation_requires_authorization_and_enforces_branch_isolation(): void
    {
        // Patient A starts a conversation at branch B1
        $messaging = app(MessagingService::class);
        $res = $messaging->start($this->u['patientA'], $this->b['b1'], 'Initial message', 'k-start-'.Str::uuid());
        $convPublicId = $res->getData(true)['data']['conversation']['id'];
        $conv = Conversation::where('public_id', $convPublicId)->firstOrFail();

        // Staff of another branch (staffB2, not scoped to b1) cannot close it
        $this->actingAsUser('staffB2');
        $this->postJson("/api/conversations/{$conv->public_id}/close", [
            'expected_revision' => 1,
        ], ['Idempotency-Key' => 'close-foreign-staff'])->assertForbidden();

        // Patient cannot close it
        $this->actingAsUser('patientA');
        $this->postJson("/api/conversations/{$conv->public_id}/close", [
            'expected_revision' => 1,
        ], ['Idempotency-Key' => 'close-patient'])->assertForbidden();

        // Authorized staff member of b1 can close it
        $this->actingAsUser('staffB1');
        $this->postJson("/api/conversations/{$conv->public_id}/close", [
            'expected_revision' => 1,
        ], ['Idempotency-Key' => 'close-auth-staff'])->assertOk()->assertJsonPath('data.status', 'Closed');

        $this->assertSame('Closed', $conv->fresh()->status);
    }

    public function test_inquiry_duplicate_notice_is_branch_scoped_and_preserves_patient_confidentiality(): void
    {
        $this->actingAsUser('staffB1');
        $inquiryRes = $this->postJson('/api/inquiries', [
            'branch_ref' => 'b1',
            'source' => 'Facebook',
            'name' => 'Maria Clara',
            'contact' => 'maria@example.test',
            'topic' => 'Inquiring about dental cleaning and tooth extraction',
        ], ['Idempotency-Key' => 'inq-b1-maria'])->assertCreated();

        $inqId = $inquiryRes->json('data.id');

        // Staff of branch B2 does not see B1 inquiries in worklist (no data leak across branches)
        $this->actingAsUser('staffB2');
        $listRes = $this->getJson('/api/inquiries')->assertOk();
        $this->assertEmpty($listRes->json('data'));

        // Staff of branch B2 cannot view or close B1 inquiry (forbidden)
        $this->postJson("/api/inquiries/{$inqId}/close", [
            'expected_revision' => 1,
        ], ['Idempotency-Key' => 'inq-close-b2'])->assertForbidden();

        // Staff of branch B1 sees only their branch's inquiry
        $this->actingAsUser('staffB1');
        $staff1List = $this->getJson('/api/inquiries')->assertOk();
        $this->assertCount(1, $staff1List->json('data'));
        $this->assertSame($inqId, $staff1List->json('data.0.id'));
    }

    public function test_dentist_only_sees_own_appointments_and_queue_entries_for_their_branch(): void
    {
        // Setup appointments for d1 (branch b1) and d2 (branch b1) and d3 (branch b2)
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '09:00');
        $this->existing('B', 'd2', 'b1', 'svc1', '2026-09-28', '10:00');
        $this->existing('A', 'd3', 'b2', 'svc1', '2026-09-28', '11:00');

        // Setup walk-in queue entries for d1 and d2
        $this->actingAsUser('staffB1');
        $this->postJson('/api/visits/walk-in', [
            'patient_id' => $this->p['A']->public_id,
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'dentist_ref' => 'd1',
        ], ['Idempotency-Key' => 'd-walkin-d1'])->assertCreated();

        $this->postJson('/api/visits/walk-in', [
            'patient_id' => $this->p['B']->public_id,
            'branch_ref' => 'b1',
            'service_ref' => 'svc1',
            'dentist_ref' => 'd2',
        ], ['Idempotency-Key' => 'd-walkin-d2'])->assertCreated();

        // Acting as dentist1 (assigned to d1, b1 only)
        $this->actingAsUser('dentist1');

        $apptRes = $this->getJson('/api/appointments?from=2026-09-28&to=2026-09-28')->assertOk();
        $appts = $apptRes->json('data');
        $this->assertNotEmpty($appts);
        foreach ($appts as $appt) {
            $this->assertSame('d1', $appt['dentist']['id']);
            $this->assertSame('b1', $appt['branch']['id']);
        }

        $queueRes = $this->getJson('/api/queue?date=2026-09-28')->assertOk();
        $entries = $queueRes->json('data');
        $this->assertNotEmpty($entries);
        foreach ($entries as $entry) {
            $this->assertSame('d1', $entry['dentist']['id']);
            $this->assertSame('b1', $entry['branch']['id']);
        }

        // Acting as dentist2 (assigned to d2, b1)
        $this->actingAsUser('dentist2');

        $apptRes2 = $this->getJson('/api/appointments?from=2026-09-28&to=2026-09-28')->assertOk();
        $appts2 = $apptRes2->json('data');
        $this->assertNotEmpty($appts2);
        foreach ($appts2 as $appt) {
            $this->assertSame('d2', $appt['dentist']['id']);
        }

        $queueRes2 = $this->getJson('/api/queue?date=2026-09-28')->assertOk();
        $entries2 = $queueRes2->json('data');
        $this->assertNotEmpty($entries2);
        foreach ($entries2 as $entry) {
            $this->assertSame('d2', $entry['dentist']['id']);
        }
    }

    public function test_service_online_booking_mutation_is_forbidden_to_non_owners_and_cannot_be_mass_assigned(): void
    {
        $service = Service::where('legacy_ref', 'svc2')->firstOrFail();
        $consultation = Service::where('legacy_ref', 'svc1')->firstOrFail();

        // 1. Mass-assignment guard: online_booking and consultation_service_id must NOT be fillable
        $fillable = (new Service())->getFillable();
        $this->assertNotContains('online_booking', $fillable, 'online_booking must not be in Service::$fillable');
        $this->assertNotContains('consultation_service_id', $fillable, 'consultation_service_id must not be in Service::$fillable');

        $attempt = new Service([
            'name' => 'Attempted Mass Assignment',
            'online_booking' => 'hidden',
            'consultation_service_id' => $consultation->id,
        ]);
        $this->assertNull($attempt->online_booking);
        $this->assertNull($attempt->consultation_service_id);

        // 2. Unauthenticated
        $this->patchJson("/api/services/{$service->legacy_ref}/online-booking", [
            'online_booking' => 'bookable',
        ])->assertUnauthorized();

        // 3. Patient
        $this->actingAsUser('patientA');
        $this->patchJson("/api/services/{$service->legacy_ref}/online-booking", [
            'online_booking' => 'bookable',
        ])->assertForbidden();

        // 4. Staff
        $this->actingAsUser('staffB1');
        $this->patchJson("/api/services/{$service->legacy_ref}/online-booking", [
            'online_booking' => 'bookable',
        ])->assertForbidden();

        // 5. Dentist
        $this->actingAsUser('dentist1');
        $this->patchJson("/api/services/{$service->legacy_ref}/online-booking", [
            'online_booking' => 'bookable',
        ])->assertForbidden();

        // 6. Owner can update with audit logging
        $this->actingAsUser('owner');
        $this->patchJson("/api/services/{$service->legacy_ref}/online-booking", [
            'online_booking' => 'consultation_first',
            'consultation_ref' => 'svc1',
        ])->assertOk()->assertJsonPath('data.online_booking', 'consultation_first');

        $this->assertSame('consultation_first', $service->fresh()->online_booking);
        $this->assertSame($consultation->id, $service->fresh()->consultation_service_id);
    }

    public function test_branch_closure_affected_appointments_is_branch_scoped_and_does_not_leak_other_branches(): void
    {
        // Set up appointments on 2026-10-15 for branch b1 and branch b2
        $apptB1 = $this->existing('A', 'd1', 'b1', 'svc1', '2026-10-15', '09:00');
        $apptB2 = $this->existing('B', 'd3', 'b2', 'svc1', '2026-10-15', '10:00');

        // Create a closure for branch b1
        $this->actingAsUser('owner');
        $createRes = $this->postJson('/api/branch-closures', [
            'branch_ref' => 'b1',
            'date' => '2026-10-15',
            'reason' => 'B1 Maintenance',
        ])->assertCreated();

        $closureId = $createRes->json('data.id');
        $closure = BranchClosure::where('public_id', $closureId)->firstOrFail();

        // Staff of branch b1 only sees B1 appointment, never B2
        $this->actingAsUser('staffB1');
        $affectedStaff1 = $this->getJson("/api/branch-closures/{$closure->public_id}/affected")->assertOk();
        $staff1Data = $affectedStaff1->json('data');
        $this->assertCount(1, $staff1Data);
        $this->assertSame($apptB1->public_id, $staff1Data[0]['id']);

        // Staff of branch b2 cannot see B1's affected appointments (empty list due to branch scope)
        $this->actingAsUser('staffB2');
        $affectedStaff2 = $this->getJson("/api/branch-closures/{$closure->public_id}/affected")->assertOk();
        $this->assertEmpty($affectedStaff2->json('data'), 'Staff of B2 must not see B1 closure affected appointments');

        // Owner sees B1 appointment for B1 closure
        $this->actingAsUser('owner');
        $affectedOwner = $this->getJson("/api/branch-closures/{$closure->public_id}/affected")->assertOk();
        $this->assertCount(1, $affectedOwner->json('data'));

        // All-branches closure: Staff B1 sees only B1, Staff B2 sees only B2, Owner sees both
        $allRes = $this->postJson('/api/branch-closures', [
            'date' => '2026-10-20',
            'reason' => 'All Branches Holiday',
        ])->assertCreated();
        $allClosureId = $allRes->json('data.id');

        $apptB1_2 = $this->existing('A', 'd1', 'b1', 'svc1', '2026-10-20', '09:00');
        $apptB2_2 = $this->existing('B', 'd3', 'b2', 'svc1', '2026-10-20', '10:00');

        $this->actingAsUser('staffB1');
        $staff1All = $this->getJson("/api/branch-closures/{$allClosureId}/affected")->assertOk()->json('data');
        $this->assertCount(1, $staff1All);
        $this->assertSame($apptB1_2->public_id, $staff1All[0]['id']);

        $this->actingAsUser('staffB2');
        $staff2All = $this->getJson("/api/branch-closures/{$allClosureId}/affected")->assertOk()->json('data');
        $this->assertCount(1, $staff2All);
        $this->assertSame($apptB2_2->public_id, $staff2All[0]['id']);

        $this->actingAsUser('owner');
        $ownerAll = $this->getJson("/api/branch-closures/{$allClosureId}/affected")->assertOk()->json('data');
        $this->assertCount(2, $ownerAll);
    }
}
