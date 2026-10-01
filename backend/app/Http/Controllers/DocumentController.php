<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Resources\DocumentResource;
use App\Http\Resources\PatientConsentResource;
use App\Models\Document;
use App\Models\Patient;
use App\Models\PatientConsent;
use App\Services\Audit\AuditService;
use App\Services\Document\DocumentException;
use App\Services\Document\DocumentStorageService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function __construct(
        private readonly DocumentStorageService $storage,
        private readonly AuditService $audit
    ) {}

    private function fail(DocumentException $e): JsonResponse
    {
        return response()->json($e->responseBody(), $e->getStatusCode());
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $q = Document::visibleTo($user)
            ->with(['patient.person', 'visit', 'hmoCase', 'branch', 'uploadedBy.person', 'extractions'])
            ->latest('id');

        if ($request->filled('patient_id')) {
            $patientId = $request->input('patient_id');
            $patient = Patient::where('public_id', $patientId)
                ->orWhere('patient_code', $patientId)
                ->orWhere('id', is_numeric($patientId) ? (int) $patientId : 0)
                ->first();
            $q->where('patient_id', $patient?->id ?? 0);
        }

        if ($request->filled('visit_id')) {
            $visitId = $request->input('visit_id');
            $q->whereHas('visit', fn ($v) => $v->where('public_id', $visitId)->orWhere('id', is_numeric($visitId) ? (int) $visitId : 0));
        }

        if ($request->filled('hmo_case_id')) {
            $caseId = $request->input('hmo_case_id');
            $q->whereHas('hmoCase', fn ($c) => $c->where('public_id', $caseId)->orWhere('id', is_numeric($caseId) ? (int) $caseId : 0));
        }

        if ($request->filled('category')) {
            $q->where('category', $request->input('category'));
        }

        if ($request->filled('status')) {
            $q->where('status', $request->input('status'));
        }

        return response()->json([
            'data' => DocumentResource::collection($q->limit(100)->get()),
        ]);
    }

    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === Role::Patient && $user->patient, 403, 'Only patients can access their personal document library.');

        $rows = Document::where('patient_id', $user->patient->id)
            ->where('status', '!=', 'Retracted')
            ->with(['patient.person', 'visit', 'hmoCase', 'branch', 'uploadedBy.person', 'extractions'])
            ->latest('id')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => DocumentResource::collection($rows),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:10240'], // 10MB
            'patient_id' => ['nullable', 'string'],
            'visit_id' => ['nullable', 'string'],
            'hmo_case_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'category' => ['nullable', 'string'],
            'title' => ['nullable', 'string', 'max:255'],
            'metadata' => ['nullable', 'array'],
        ]);

        try {
            $doc = $this->storage->store($request->user(), $request->file('file'), $request->all());

            $this->audit->record([
                'action' => 'document.uploaded',
                'category' => 'administrative',
                'severity' => 'info',
                'actor' => $request->user(),
                'target' => $doc,
                'branch_id' => $doc->branch_id,
                'payload' => [
                    'category' => $doc->category,
                    'title' => $doc->title,
                    'file_size_bytes' => $doc->file_size_bytes,
                    'checksum_sha256' => $doc->checksum_sha256,
                ],
            ]);

            return response()->json([
                'data' => new DocumentResource($doc),
            ], 201);
        } catch (DocumentException $e) {
            return $this->fail($e);
        }
    }

    public function show(Request $request, Document $document): JsonResponse
    {
        abort_unless(Document::visibleTo($request->user())->whereKey($document->id)->exists(), 403);

        return response()->json([
            'data' => new DocumentResource($document->load(['patient.person', 'visit', 'hmoCase', 'branch', 'uploadedBy.person', 'extractions'])),
        ]);
    }

    public function download(Request $request, Document $document): StreamedResponse|JsonResponse
    {
        try {
            return $this->storage->download($request->user(), $document);
        } catch (DocumentException $e) {
            return $this->fail($e);
        }
    }

    public function retract(Request $request, Document $document): JsonResponse
    {
        $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        try {
            $updated = $this->storage->retract($request->user(), $document, $request->input('reason'));

            $this->audit->record([
                'action' => 'document.retracted',
                'category' => 'administrative',
                'severity' => 'warning',
                'actor' => $request->user(),
                'target' => $updated,
                'branch_id' => $updated->branch_id,
                'payload' => [
                    'reason' => $request->input('reason'),
                ],
            ]);

            return response()->json([
                'data' => new DocumentResource($updated),
            ]);
        } catch (DocumentException $e) {
            return $this->fail($e);
        }
    }

    public function consents(Request $request, Patient $patient): JsonResponse
    {
        $user = $request->user();
        if ($user->role === Role::Patient && $user->patient?->id !== $patient->id) {
            abort(403, 'Patients may only inspect their own consents.');
        }

        $consents = PatientConsent::where('patient_id', $patient->id)
            ->with(['patient', 'document', 'recordedBy.person'])
            ->latest('id')
            ->get();

        return response()->json([
            'data' => PatientConsentResource::collection($consents),
        ]);
    }

    public function consentsMine(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === Role::Patient && $user->patient, 403);

        $consents = PatientConsent::where('patient_id', $user->patient->id)
            ->with(['patient', 'document', 'recordedBy.person'])
            ->latest('id')
            ->get();

        return response()->json([
            'data' => PatientConsentResource::collection($consents),
        ]);
    }

    public function grantConsent(Request $request, Patient $patient): JsonResponse
    {
        $user = $request->user();
        if ($user->role === Role::Patient && $user->patient?->id !== $patient->id) {
            abort(403, 'Patients may only grant consents for themselves.');
        }

        $v = $request->validate([
            'consent_type' => ['required', 'string', 'in:' . implode(',', PatientConsent::TYPES)],
            'version' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'document_id' => ['nullable', 'string'],
        ]);

        $documentId = null;
        if (! empty($v['document_id'])) {
            $doc = Document::where('public_id', $v['document_id'])->orWhere('id', is_numeric($v['document_id']) ? (int) $v['document_id'] : 0)->first();
            if ($doc && $doc->patient_id === $patient->id) {
                $documentId = $doc->id;
            }
        }

        $consent = PatientConsent::create([
            'patient_id' => $patient->id,
            'document_id' => $documentId,
            'consent_type' => $v['consent_type'],
            'version' => $v['version'] ?? '1.0',
            'status' => 'Granted',
            'notes' => $v['notes'] ?? null,
            'signed_at' => CarbonImmutable::now('Asia/Manila'),
            'recorded_by_user_id' => $user->id,
        ]);

        $this->audit->record([
            'action' => 'consent.granted',
            'category' => 'clinical',
            'severity' => 'info',
            'actor' => $user,
            'target' => $consent,
            'payload' => [
                'consent_type' => $consent->consent_type,
                'version' => $consent->version,
                'patient_code' => $patient->patient_code,
            ],
        ]);

        return response()->json([
            'data' => new PatientConsentResource($consent->load(['patient', 'document', 'recordedBy.person'])),
        ], 201);
    }

    public function withdrawConsent(Request $request, Patient $patient, PatientConsent $consent): JsonResponse
    {
        $user = $request->user();
        if ($user->role === Role::Patient && $user->patient?->id !== $patient->id) {
            abort(403);
        }
        if ($consent->patient_id !== $patient->id) {
            abort(422, 'Consent does not belong to this patient.');
        }
        if ($consent->status === 'Withdrawn') {
            return response()->json(['message' => 'Consent already withdrawn.', 'code' => 'already_withdrawn'], 422);
        }

        $consent->update([
            'status' => 'Withdrawn',
            'withdrawn_at' => CarbonImmutable::now('Asia/Manila'),
        ]);

        $this->audit->record([
            'action' => 'consent.withdrawn',
            'category' => 'clinical',
            'severity' => 'warning',
            'actor' => $user,
            'target' => $consent,
            'payload' => [
                'consent_type' => $consent->consent_type,
                'version' => $consent->version,
                'patient_code' => $patient->patient_code,
            ],
        ]);

        return response()->json([
            'data' => new PatientConsentResource($consent->fresh(['patient', 'document', 'recordedBy.person'])),
        ]);
    }
}
