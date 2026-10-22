<?php

namespace Tests\Feature\Archives;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Prescription;
use App\Models\Receipt;
use App\Models\Treatment;
use App\Models\Visit;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

/**
 * M23 Archives & Historical Records Management
 *
 * Simulates complete clinical encounter workflows:
 *   Appointment -> Check-In (Visit) -> Treatment & Chart -> Prescription -> Settle Invoice & Receipt
 *
 * Verifies cross-role data retention, retrieval, and strict patient isolation:
 *   - Patient: retrieves own completed visits, prescriptions, receipts; cannot see foreign records.
 *   - Dentist: retrieves historical clinical procedures and prescriptions at their branch.
 *   - Staff: searches by patient or reference, verifies settled payment proof in branch scope.
 *   - Owner: multi-branch scope (all branches or filtered by branch) with permanent audit retention.
 */
class ArchivesIsolationTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private int $keySeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->setUpSchedulingWorld();

        // M11 billing cutover & service pricing for b1 and b2
        \Illuminate\Support\Facades\DB::table('m11_billing_cutovers')->where('id', 1)->update(['established_at' => '2026-09-01 00:00:00+08']);
        foreach (['b1', 'b2'] as $bKey) {
            \App\Models\ServicePrice::create([
                'service_id' => $this->svc['svc1']->id,
                'branch_id' => $this->b[$bKey]->id,
                'kind' => 'priced',
                'amount' => '350.00',
                'effective_from' => '2026-09-01',
                'source' => 'owner_confirmed',
                'created_by_user_id' => $this->u['owner']->id,
                'created_at' => now(),
            ]);
        }
    }

    private function idempKey(): string
    {
        return 'arch-key-'.(++$this->keySeq).'-'.uniqid();
    }

    private function callQueue(Visit $visit): void
    {
        if ($visit->queueEntry) {
            $visit->queueEntry->update(['status' => 'Called']);
        }
    }

    private function simulateEncounter(string $patientKey, string $dentistKey, string $branchKey, string $staffKey, string $time): array
    {
        // 1. Create Appointment
        $apt = $this->existing($patientKey, $dentistKey, $branchKey, 'svc1', '2026-09-28', $time);

        // 2. Front-Desk Check-In -> Visit
        $this->actingAsUser($staffKey);
        $checkInRes = $this->postJson('/api/visits/check-in', [
            'appointment_id' => $apt->public_id,
            'expected_revision' => 1,
        ], ['Idempotency-Key' => $this->idempKey()])->assertCreated();

        $visit = Visit::where('public_id', $checkInRes->json('data.id'))->sole();
        $this->callQueue($visit);

        // 3. Treatment & Dental Chart
        $dentistUser = match ($dentistKey) {
            'd1' => 'dentist1',
            'd2' => 'dentist2',
            'd3' => 'dentist3',
            default => $dentistKey,
        };
        $this->actingAsUser($dentistUser);
        $this->postJson("/api/visits/{$visit->public_id}/treatment", [
            'expected_revision' => $visit->fresh()->revision,
        ], ['Idempotency-Key' => $this->idempKey()])->assertCreated();

        $treatment = $visit->fresh()->treatment;

        // Document clinical notes and procedure
        $this->postJson("/api/treatments/{$treatment->public_id}/document", [
            'expected_revision' => $treatment->fresh()->revision,
            'chief_complaint' => 'Tooth sensitivity and pain',
            'treatment_plan' => 'Direct composite restoration and medication',
            'procedure_summary' => 'Restoration / Composite Filling on occlusal surface',
            'clinical_notes' => 'Tolerated procedure well under local anesthesia.',
            'prescription_required' => true,
            'followup_required' => false,
            'procedures' => [
                ['service_ref' => 'svc1', 'quantity' => 1, 'notes' => 'Occlusal composite restoration'],
            ],
        ], ['Idempotency-Key' => $this->idempKey()])->assertOk();

        // Complete treatment
        $this->postJson("/api/treatments/{$treatment->public_id}/complete", [
            'expected_revision' => $treatment->fresh()->revision,
        ], ['Idempotency-Key' => $this->idempKey()])->assertOk();

        // 4. Issue Digital Prescription
        $rxDraft = $this->postJson('/api/prescriptions', [
            'visit_id' => $visit->public_id,
            'note' => 'Take prescribed antibiotics after meals.',
            'lines' => [
                [
                    'medicine' => 'Amoxicillin 500 mg capsule',
                    'dosage' => '1 capsule',
                    'frequency' => 'every 8 hours',
                    'duration' => '7 days',
                    'instructions' => 'Finish full course.',
                ],
                [
                    'medicine' => 'Mefenamic Acid 500 mg',
                    'dosage' => '1 capsule',
                    'frequency' => 'every 8 hours as needed',
                    'duration' => '3 days',
                    'instructions' => 'For severe pain.',
                ],
            ],
        ])->assertCreated();

        $rxId = $rxDraft->json('data.id');
        $rxIssued = $this->postJson("/api/prescriptions/{$rxId}/issue", [
            'expected_revision' => 1,
        ])->assertOk();

        // 5. Settle Invoice & Receipt
        $this->actingAsUser($staffKey);
        $invDraft = $this->postJson("/api/invoices/from-treatment/{$treatment->public_id}", [], [
            'Idempotency-Key' => $this->idempKey(),
        ])->assertCreated();

        $invId = $invDraft->json('data.id');
        $invoice = Invoice::where('public_id', $invId)->sole();

        $this->postJson("/api/invoices/{$invId}/review", [
            'expected_revision' => $invoice->fresh()->revision,
        ], ['Idempotency-Key' => $this->idempKey()])->assertOk();

        $this->postJson("/api/invoices/{$invId}/issue", [
            'expected_revision' => $invoice->fresh()->revision,
        ], ['Idempotency-Key' => $this->idempKey()])->assertOk();

        $payRes = $this->postJson("/api/invoices/{$invId}/payment", [
            'expected_revision' => $invoice->fresh()->revision,
            'method' => 'Cash',
            'amount' => (string) $invoice->fresh()->patient_responsibility_amount,
        ], ['Idempotency-Key' => $this->idempKey()])->assertOk();

        return [
            'appointment' => $apt->fresh(),
            'visit' => $visit->fresh(),
            'treatment' => $treatment->fresh(),
            'prescription' => Prescription::where('public_id', $rxId)->sole(),
            'invoice' => $invoice->fresh(),
            'receipt' => Receipt::where('invoice_id', $invoice->id)->sole(),
        ];
    }

    public function test_complete_simulation_workflow_and_four_role_archive_retention(): void
    {
        // Execute simulated workflow for Patient A (at Branch b1 with Dentist d1, StaffB1)
        $simA = $this->simulateEncounter('A', 'd1', 'b1', 'staffB1', '10:00');

        // Execute simulated workflow for Patient B (at Branch b2 with Dentist d3, StaffB2)
        $simB = $this->simulateEncounter('B', 'd3', 'b2', 'staffB2', '14:00');

        // =========================================================================
        // 1. ROLE: PATIENT A (Strict Tenant Isolation & Medical Retention)
        // =========================================================================
        $this->actingAsUser('patientA');

        // Completed Visits: Patient A retrieves their own completed appointment
        $aptRes = $this->getJson('/api/appointments')->assertOk();
        $aptIds = array_column($aptRes->json('data'), 'id');
        $this->assertContains($simA['appointment']->public_id, $aptIds);
        $this->assertNotContains($simB['appointment']->public_id, $aptIds, 'Patient A strictly cannot see Patient B appointments');

        // Prescriptions: Patient A retrieves their own medication lines & Rx details
        $rxRes = $this->getJson('/api/me/prescriptions')->assertOk();
        $rxList = $rxRes->json('data');
        $rxIds = array_column($rxList, 'id');
        $this->assertContains($simA['prescription']->public_id, $rxIds);
        $this->assertNotContains($simB['prescription']->public_id, $rxIds, 'Patient A strictly cannot see Patient B prescriptions');
        $this->assertSame('Amoxicillin 500 mg capsule', $rxList[0]['lines'][0]['medicine']);

        // Invoices: Patient A retrieves their own settled invoice & receipt
        $invRes = $this->getJson('/api/invoices/mine')->assertOk();
        $invIds = array_column($invRes->json('data'), 'id');
        $this->assertContains($simA['invoice']->public_id, $invIds);
        $this->assertNotContains($simB['invoice']->public_id, $invIds, 'Patient A strictly cannot see Patient B invoices');

        // Receipts: Patient A retrieves their official receipt
        $rcpRes = $this->getJson('/api/receipts/mine')->assertOk();
        $rcpIds = array_column($rcpRes->json('data'), 'id');
        $this->assertContains($simA['receipt']->public_id, $rcpIds);
        $this->assertNotContains($simB['receipt']->public_id, $rcpIds, 'Patient A strictly cannot see Patient B receipts');

        // Treatments: Patient A retrieves their completed treatment
        $trtRes = $this->getJson('/api/treatments/mine')->assertOk();
        $trtIds = array_column($trtRes->json('data'), 'id');
        $this->assertContains($simA['treatment']->public_id, $trtIds);
        $this->assertNotContains($simB['treatment']->public_id, $trtIds, 'Patient A strictly cannot see Patient B treatments');

        // Security / Isolation Enforcement:
        // Trying to download Patient B's prescription PDF or invoice PDF is forbidden / not found
        $this->get("/api/prescriptions/{$simB['prescription']->public_id}/pdf")->assertNotFound();
        $invForeignRes = $this->getJson("/api/invoices/{$simB['invoice']->public_id}");
        $this->assertTrue(in_array($invForeignRes->status(), [403, 404], true), 'Foreign invoice access must be denied with 403 or 404');
        $rcpForeignRes = $this->get("/api/invoices/{$simB['invoice']->public_id}/receipt-pdf");
        $this->assertTrue(in_array($rcpForeignRes->status(), [403, 404], true), 'Foreign receipt PDF access must be denied with 403 or 404');

        // Parameter tampering prevention
        $this->getJson("/api/invoices/mine?patient_id={$this->p['B']->public_id}")->assertStatus(422);
        $this->getJson('/api/invoices/mine?branch_id=b2')->assertStatus(422);

        // =========================================================================
        // 2. ROLE: DENTIST 1 (Clinical Continuity & Historical Prescriptions)
        // =========================================================================
        $this->actingAsUser('dentist1');

        // Dentist 1 (assigned to b1) can review past prescriptions issued at b1
        $dRxRes = $this->getJson('/api/prescriptions')->assertOk();
        $dRxIds = array_column($dRxRes->json('data'), 'id');
        $this->assertContains($simA['prescription']->public_id, $dRxIds);
        $this->assertNotContains($simB['prescription']->public_id, $dRxIds, 'Dentist 1 cannot see prescriptions from other branches');

        // Dentist 1 sees their assigned appointment
        $dAptRes = $this->getJson('/api/appointments')->assertOk();
        $dAptIds = array_column($dAptRes->json('data'), 'id');
        $this->assertContains($simA['appointment']->public_id, $dAptIds);
        $this->assertNotContains($simB['appointment']->public_id, $dAptIds);

        // =========================================================================
        // 3. ROLE: STAFF B1 (Front-Desk Verification & Search Scope)
        // =========================================================================
        $this->actingAsUser('staffB1');

        // Staff B1 (scoped to b1) verifies settled invoices and receipts in their branch
        $sInvRes = $this->getJson('/api/invoices')->assertOk();
        $sInvIds = array_column($sInvRes->json('data'), 'id');
        $this->assertContains($simA['invoice']->public_id, $sInvIds);
        $this->assertNotContains($simB['invoice']->public_id, $sInvIds, 'Staff at branch 1 cannot see branch 2 invoices');

        // Staff B1 can filter by patient public id to assist patient inquiries
        $filterRes = $this->getJson("/api/invoices?patient_id={$this->p['A']->public_id}")->assertOk();
        $this->assertSame($simA['invoice']->public_id, $filterRes->json('data.0.id'));

        // Staff B1 can download Patient A receipt PDF
        $staffPdf = $this->get("/api/invoices/{$simA['invoice']->public_id}/receipt-pdf")->assertOk();
        $this->assertSame('application/pdf', $staffPdf->headers->get('Content-Type'));

        // =========================================================================
        // 4. ROLE: OWNER (Cross-Branch Scope & Indefinite Compliance Retention)
        // =========================================================================
        $this->actingAsUser('owner');

        // Owner has cross-branch authority: sees ALL branches without restriction
        $ownerInvAll = $this->getJson('/api/invoices')->assertOk();
        $ownerAllIds = array_column($ownerInvAll->json('data'), 'id');
        $this->assertContains($simA['invoice']->public_id, $ownerAllIds);
        $this->assertContains($simB['invoice']->public_id, $ownerAllIds);

        // Owner can filter by individual branch
        $ownerB1 = $this->getJson('/api/invoices?branch_id=b1')->assertOk();
        $ownerB1Ids = array_column($ownerB1->json('data'), 'id');
        $this->assertContains($simA['invoice']->public_id, $ownerB1Ids);
        $this->assertNotContains($simB['invoice']->public_id, $ownerB1Ids);

        $ownerB2 = $this->getJson('/api/invoices?branch_id=b2')->assertOk();
        $ownerB2Ids = array_column($ownerB2->json('data'), 'id');
        $this->assertContains($simB['invoice']->public_id, $ownerB2Ids);
        $this->assertNotContains($simA['invoice']->public_id, $ownerB2Ids);

        // Retention assertion: All records remain intact in database
        $this->assertSame('Completed', $simA['visit']->fresh()->status);
        $this->assertSame('Completed', $simA['treatment']->fresh()->status);
        $this->assertSame('Issued', $simA['prescription']->fresh()->status);
        $this->assertSame('Paid', $simA['invoice']->fresh()->status);
        $this->assertNotNull($simA['receipt']->fresh()->id);
    }
}
