<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class DocumentResource extends JsonResource
{
    public function toArray($request): array
    {
        $d = $this->resource;
        return [
            'id' => $d->public_id,
            'category' => $d->category,
            'title' => $d->title,
            'original_filename' => $d->original_filename,
            'mime_type' => $d->mime_type,
            'file_size_bytes' => (int) $d->file_size_bytes,
            'checksum_sha256' => $d->checksum_sha256,
            'status' => $d->status,
            'metadata' => $d->metadata,
            'patient' => $d->patient ? [
                'id' => $d->patient->public_id,
                'code' => $d->patient->patient_code,
                'name' => $d->patient->person?->fullName(),
            ] : null,
            'visit_id' => $d->visit?->public_id,
            'hmo_case_id' => $d->hmoCase?->public_id,
            'branch' => $d->branch ? [
                'id' => $d->branch->legacy_ref,
                'name' => $d->branch->name,
            ] : null,
            'uploaded_by' => $d->uploadedBy ? [
                'id' => $d->uploadedBy->public_id,
                'name' => $d->uploadedBy->person?->fullName() ?? $d->uploadedBy->name,
                'role' => $d->uploadedBy->role?->value,
            ] : null,
            'retracted_at' => $d->retracted_at?->toIso8601String(),
            'retraction_reason' => $d->retraction_reason,
            'extractions' => DocumentExtractionResource::collection($d->relationLoaded('extractions') ? $d->extractions : []),
            'created_at' => $d->created_at?->toIso8601String(),
            'updated_at' => $d->updated_at?->toIso8601String(),
        ];
    }
}
