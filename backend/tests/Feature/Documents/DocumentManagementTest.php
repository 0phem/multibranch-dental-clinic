<?php

namespace Tests\Feature\Documents;

use App\Enums\Role;
use App\Models\Document;
use App\Models\DocumentExtraction;
use App\Models\PatientConsent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

class DocumentManagementTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        Storage::fake('local');
    }

    public function test_patient_can_upload_own_document_and_generates_sha256_checksum(): void
    {
        $this->actingAsUser('patientA');
        $file = UploadedFile::fake()->create('id_card.pdf', 500, 'application/pdf');

        $response = $this->postJson('/api/documents', [
            'file' => $file,
            'category' => 'valid_id',
            'title' => 'My National ID',
        ])->assertCreated();

        $response->assertJsonPath('data.category', 'valid_id');
        $response->assertJsonPath('data.title', 'My National ID');
        $response->assertJsonPath('data.patient.id', $this->p['A']->public_id);
        $this->assertNotEmpty($response->json('data.checksum_sha256'));

        $doc = Document::firstOrFail();
        $this->assertSame($this->p['A']->id, $doc->patient_id);
        $this->assertSame('Active', $doc->status);
        $this->assertTrue(Storage::disk('local')->exists($doc->file_path));
    }

    public function test_disallowed_mime_types_and_oversized_files_are_rejected(): void
    {
        $this->actingAsUser('patientA');

        // Disallowed executable / script type
        $badFile = UploadedFile::fake()->create('exploit.exe', 100, 'application/x-msdownload');
        $this->postJson('/api/documents', [
            'file' => $badFile,
            'category' => 'other',
        ])->assertStatus(422)->assertJsonPath('code', 'disallowed_mime_type');

        // Oversized file (> 10MB)
        $hugeFile = UploadedFile::fake()->create('huge.pdf', 15000, 'application/pdf');
        $this->postJson('/api/documents', [
            'file' => $hugeFile,
            'category' => 'other',
        ])->assertStatus(422);
    }

    public function test_patient_cannot_upload_document_for_another_patient(): void
    {
        $this->actingAsUser('patientA');
        $file = UploadedFile::fake()->create('card.jpg', 200, 'image/jpeg');

        // Patient A specifies Patient B's ID in request
        $response = $this->postJson('/api/documents', [
            'file' => $file,
            'patient_id' => $this->p['B']->public_id,
            'category' => 'hmo_card',
        ])->assertCreated();

        // Server overrides client-provided patient_id and binds strictly to Patient A
        $this->assertSame($this->p['A']->id, Document::firstOrFail()->patient_id);
        $response->assertJsonPath('data.patient.id', $this->p['A']->public_id);
    }

    public function test_staff_can_upload_document_within_branch_scope(): void
    {
        $this->actingAsUser('staffB1');
        $file = UploadedFile::fake()->create('consent.pdf', 300, 'application/pdf');

        $response = $this->postJson('/api/documents', [
            'file' => $file,
            'patient_id' => $this->p['A']->public_id,
            'branch_id' => 'b1',
            'category' => 'consent_document',
            'title' => 'Signed Treatment Consent',
        ])->assertCreated();

        $response->assertJsonPath('data.branch.id', 'b1');
        $this->assertSame(1, Document::count());
    }

    public function test_staff_cannot_upload_document_outside_branch_scope(): void
    {
        $this->actingAsUser('staffB1'); // Only scoped to b1
        $file = UploadedFile::fake()->create('consent.pdf', 300, 'application/pdf');

        $this->postJson('/api/documents', [
            'file' => $file,
            'patient_id' => $this->p['A']->public_id,
            'branch_id' => 'b2', // Attempting branch B
            'category' => 'consent_document',
        ])->assertStatus(403)->assertJsonPath('code', 'forbidden');

        $this->assertSame(0, Document::count());
    }

    public function test_document_download_streams_from_private_storage_with_security_headers(): void
    {
        $this->actingAsUser('patientA');
        $file = UploadedFile::fake()->create('statement.pdf', 400, 'application/pdf');
        $created = $this->postJson('/api/documents', ['file' => $file, 'category' => 'other'])->json('data');

        $response = $this->get("/api/documents/{$created['id']}/download")
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_patient_isolation_patient_cannot_download_another_patients_document(): void
    {
        // Patient B uploads a document
        $this->actingAsUser('patientB');
        $file = UploadedFile::fake()->create('secret.pdf', 200, 'application/pdf');
        $docB = $this->postJson('/api/documents', ['file' => $file, 'category' => 'valid_id'])->json('data');

        // Patient A tries to view or download it
        $this->actingAsUser('patientA');
        $this->getJson("/api/documents/{$docB['id']}")->assertStatus(403);
        $this->get("/api/documents/{$docB['id']}/download")->assertStatus(403);

        // /api/documents/mine returns only Patient A's records
        $mine = $this->getJson('/api/documents/mine')->assertOk()->json('data');
        $this->assertCount(0, $mine);
    }

    public function test_text_extraction_generates_draft_record_without_mutating_domain_state(): void
    {
        $this->actingAsUser('patientA');
        $file = UploadedFile::fake()->create('Maxicare_card.jpg', 300, 'image/jpeg');

        $docData = $this->postJson('/api/documents', [
            'file' => $file,
            'category' => 'hmo_card',
            'title' => 'Maxicare Card 2026',
            'metadata' => ['provider' => 'Maxicare', 'member_number' => 'MAX-12345678'],
        ])->json('data');

        $this->assertCount(1, $docData['extractions']);
        $extraction = $docData['extractions'][0];
        $this->assertSame('Draft', $extraction['status']);
        $this->assertSame('Maxicare', $extraction['structured_payload']['provider_candidate']);
        $this->assertSame('MAX-12345678', $extraction['structured_payload']['member_number_candidate']);
        $this->assertTrue($extraction['structured_payload']['is_draft_only']);
    }

    public function test_document_retraction_requires_reason_and_updates_status(): void
    {
        $this->actingAsUser('patientA');
        $file = UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf');
        $doc = $this->postJson('/api/documents', ['file' => $file, 'category' => 'other'])->json('data');

        // Empty reason fails
        $this->postJson("/api/documents/{$doc['id']}/retract", ['reason' => ''])->assertStatus(422);

        // Valid retraction
        $retracted = $this->postJson("/api/documents/{$doc['id']}/retract", [
            'reason' => 'Uploaded incorrect file by mistake',
        ])->assertOk()->json('data');

        $this->assertSame('Retracted', $retracted['status']);
        $this->assertSame('Uploaded incorrect file by mistake', $retracted['retraction_reason']);
        $this->assertNotNull($retracted['retracted_at']);

        // Subsequent download by patient is rejected with 410 Gone / document_retracted
        $this->get("/api/documents/{$doc['id']}/download")->assertStatus(410);
    }

    public function test_patient_consent_grant_and_withdrawal_lifecycle(): void
    {
        $this->actingAsUser('patientA');

        // Grant consent
        $consent = $this->postJson("/api/patients/{$this->p['A']->public_id}/consents", [
            'consent_type' => 'general_treatment',
            'version' => '1.0',
            'notes' => 'Agreed at front desk',
        ])->assertCreated()->json('data');

        $this->assertSame('general_treatment', $consent['consent_type']);
        $this->assertSame('Granted', $consent['status']);

        // Withdraw consent
        $withdrawn = $this->postJson("/api/patients/{$this->p['A']->public_id}/consents/{$consent['id']}/withdraw")
            ->assertOk()
            ->json('data');

        $this->assertSame('Withdrawn', $withdrawn['status']);
        $this->assertNotNull($withdrawn['withdrawn_at']);

        // Cannot withdraw twice
        $this->postJson("/api/patients/{$this->p['A']->public_id}/consents/{$consent['id']}/withdraw")->assertStatus(422);
    }

    public function test_patient_can_inspect_their_own_consents_via_mine_endpoint(): void
    {
        $this->actingAsUser('patientA');

        PatientConsent::create([
            'patient_id' => $this->p['A']->id,
            'consent_type' => 'data_privacy',
            'version' => '1.0',
            'status' => 'Granted',
            'signed_at' => now(),
            'recorded_by_user_id' => $this->u['patientA']->id,
        ]);

        $response = $this->getJson('/api/consents/mine')->assertOk()->json('data');
        $this->assertCount(1, $response);
        $this->assertSame('data_privacy', $response[0]['consent_type']);
    }
}
