<?php

namespace App\Services\Document;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Document;
use App\Models\HmoCase;
use App\Models\Patient;
use App\Models\User;
use App\Models\UserBranchScope;
use App\Models\Visit;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Str;

class DocumentStorageService
{
    public const ALLOWED_MIMES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
    ];

    public const MAX_BYTES = 10485760; // 10MB

    public function __construct(private readonly TextExtractionService $extractor) {}

    public function store(User $actor, UploadedFile $file, array $attributes): Document
    {
        $this->validateFile($file);

        $patient = $this->resolvePatient($actor, $attributes['patient_id'] ?? null);
        $visit = ! empty($attributes['visit_id']) ? $this->resolveVisit($actor, $attributes['visit_id'], $patient) : null;
        $hmoCase = ! empty($attributes['hmo_case_id']) ? $this->resolveHmoCase($actor, $attributes['hmo_case_id'], $patient) : null;
        $branch = ! empty($attributes['branch_id']) ? $this->resolveBranch($actor, $attributes['branch_id']) : ($visit?->branch);

        $category = $attributes['category'] ?? 'other';
        if (! in_array($category, Document::CATEGORIES, true)) {
            throw new DocumentException(422, 'invalid_document_category', "Category '{$category}' is not supported.", ['allowed' => Document::CATEGORIES]);
        }

        $title = trim((string) ($attributes['title'] ?? $file->getClientOriginalName()));
        if (empty($title)) {
            $title = 'Document ' . CarbonImmutable::now('Asia/Manila')->format('Y-m-d H:i');
        }

        $sha256 = hash_file('sha256', $file->getRealPath());
        $ext = strtolower($file->getClientOriginalExtension());
        if (empty($ext)) {
            $ext = match ($file->getMimeType()) {
                'application/pdf' => 'pdf',
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => 'bin',
            };
        }

        $ulid = strtolower((string) Str::ulid());
        $folder = "documents/{$patient->public_id}";
        $filename = "{$ulid}.{$ext}";
        $storagePath = "{$folder}/{$filename}";

        return DB::transaction(function () use ($actor, $patient, $visit, $hmoCase, $branch, $category, $title, $file, $storagePath, $folder, $filename, $sha256, $attributes) {
            // Write to private local disk
            $stored = Storage::disk('local')->putFileAs($folder, $file, $filename);
            if (! $stored) {
                throw new DocumentException(500, 'storage_write_failed', 'Failed to store the document to private disk.');
            }

            $doc = Document::create([
                'patient_id' => $patient->id,
                'visit_id' => $visit?->id,
                'hmo_case_id' => $hmoCase?->id,
                'branch_id' => $branch?->id,
                'category' => $category,
                'title' => $title,
                'file_path' => $storagePath,
                'original_filename' => substr($file->getClientOriginalName(), 0, 255),
                'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                'file_size_bytes' => $file->getSize(),
                'checksum_sha256' => $sha256,
                'status' => 'Active',
                'metadata' => $attributes['metadata'] ?? null,
                'uploaded_by_user_id' => $actor->id,
            ]);

            // Execute non-authoritative draft extraction
            $this->extractor->extract($doc);

            return $doc->fresh(['patient.person', 'visit', 'hmoCase', 'branch', 'uploadedBy', 'extractions']);
        });
    }

    public function download(User $actor, Document $document): StreamedResponse
    {
        if (! Document::visibleTo($actor)->whereKey($document->id)->exists()) {
            throw new DocumentException(403, 'forbidden', 'You are not authorized to view or download this document.');
        }

        if ($document->status === 'Retracted' && $actor->role !== Role::Owner) {
            throw new DocumentException(410, 'document_retracted', 'This document was retracted and is no longer accessible.');
        }

        $disk = Storage::disk('local');
        if (! $disk->exists($document->file_path)) {
            throw new DocumentException(404, 'file_not_found', 'The physical file could not be found in private storage.');
        }

        $safeName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $document->original_filename ?: 'document');

        return response()->stream(function () use ($disk, $document) {
            $stream = $disk->readStream($document->file_path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $document->mime_type,
            'Content-Length' => (string) $document->file_size_bytes,
            'Content-Disposition' => 'inline; filename="' . $safeName . '"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-cache, no-store, must-revalidate',
        ]);
    }

    public function retract(User $actor, Document $document, string $reason): Document
    {
        if (! Document::visibleTo($actor)->whereKey($document->id)->exists()) {
            throw new DocumentException(403, 'forbidden', 'You are not authorized to act on this document.');
        }

        if ($actor->role === Role::Patient && $document->uploaded_by_user_id !== $actor->id) {
            throw new DocumentException(403, 'forbidden', 'Patients may only retract documents they uploaded themselves.');
        }

        if ($document->status === 'Retracted') {
            throw new DocumentException(422, 'already_retracted', 'This document has already been retracted.');
        }

        $reason = trim($reason);
        if (empty($reason)) {
            throw new DocumentException(422, 'reason_required', 'A reason is required to retract a document.');
        }

        $document->update([
            'status' => 'Retracted',
            'retracted_at' => CarbonImmutable::now('Asia/Manila'),
            'retracted_by_user_id' => $actor->id,
            'retraction_reason' => substr($reason, 0, 255),
        ]);

        return $document->fresh(['patient.person', 'visit', 'hmoCase', 'branch', 'uploadedBy', 'retractedBy']);
    }

    private function validateFile(UploadedFile $file): void
    {
        if (! $file->isValid()) {
            throw new DocumentException(422, 'invalid_upload', 'The uploaded file was corrupted or incomplete.');
        }

        $size = $file->getSize();
        if ($size <= 0 || $size > self::MAX_BYTES) {
            throw new DocumentException(422, 'file_too_large', 'Document size must be greater than 0 and at most 10MB.', ['size_bytes' => $size, 'max_bytes' => self::MAX_BYTES]);
        }

        $mime = $file->getMimeType();
        if (! in_array($mime, self::ALLOWED_MIMES, true)) {
            throw new DocumentException(422, 'disallowed_mime_type', "File type '{$mime}' is not permitted. Only PDF and JPG/PNG/WebP images are allowed.", ['allowed_mimes' => self::ALLOWED_MIMES]);
        }
    }

    private function resolvePatient(User $actor, ?string $patientId): Patient
    {
        if ($actor->role === Role::Patient) {
            $patient = $actor->patient;
            if (! $patient) {
                throw new DocumentException(403, 'forbidden', 'Patient profile not found for authenticated user.');
            }
            return $patient;
        }

        if (empty($patientId)) {
            throw new DocumentException(422, 'patient_required', 'patient_id is required.');
        }

        $patient = Patient::where('public_id', $patientId)
            ->orWhere('patient_code', $patientId)
            ->orWhere('id', is_numeric($patientId) ? (int) $patientId : 0)
            ->first();
        if (! $patient) {
            throw new DocumentException(404, 'patient_not_found', 'Specified patient does not exist.');
        }

        return $patient;
    }

    private function resolveVisit(User $actor, string $visitId, Patient $patient): Visit
    {
        $visit = Visit::where('public_id', $visitId)->orWhere('id', is_numeric($visitId) ? (int) $visitId : 0)->first();
        if (! $visit) {
            throw new DocumentException(404, 'visit_not_found', 'Specified visit does not exist.');
        }
        if ($visit->patient_id !== $patient->id) {
            throw new DocumentException(422, 'visit_patient_mismatch', 'The visit does not belong to the specified patient.');
        }
        if ($actor->role === Role::Staff && ! UserBranchScope::where('user_id', $actor->id)->where('branch_id', $visit->branch_id)->exists()) {
            throw new DocumentException(403, 'forbidden', 'You do not have branch scope access for this visit.');
        }
        return $visit;
    }

    private function resolveHmoCase(User $actor, string $caseId, Patient $patient): HmoCase
    {
        $case = HmoCase::where('public_id', $caseId)->orWhere('id', is_numeric($caseId) ? (int) $caseId : 0)->first();
        if (! $case) {
            throw new DocumentException(404, 'hmo_case_not_found', 'Specified HMO case does not exist.');
        }
        if ($case->patient_id !== $patient->id) {
            throw new DocumentException(422, 'hmo_patient_mismatch', 'The HMO case does not belong to the specified patient.');
        }
        return $case;
    }

    private function resolveBranch(User $actor, string|int $branchId): Branch
    {
        $branch = Branch::where('legacy_ref', $branchId)->orWhere('id', is_numeric($branchId) ? (int) $branchId : 0)->first();
        if (! $branch) {
            throw new DocumentException(404, 'branch_not_found', 'Specified branch does not exist.');
        }
        if ($actor->role === Role::Staff && ! UserBranchScope::where('user_id', $actor->id)->where('branch_id', $branch->id)->exists()) {
            throw new DocumentException(403, 'forbidden', 'Staff user cannot upload documents outside their branch scope.');
        }
        return $branch;
    }
}
