<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// An extraction is a DRAFT: non-authoritative candidate data for a human to review in the owning module. The list projection
// carries only the summary; the extracted text and candidates appear only in the single-document detail response.
class DocumentExtractionResource extends JsonResource
{
    public static bool $detail = false;

    public function toArray($request): array
    {
        $e = $this->resource;
        $summary = [
            'id' => $e->public_id,
            'method' => $e->extraction_method,
            'status' => $e->status,
            'is_draft' => $e->status === 'Draft',
            'confidence_score' => $e->confidence_score !== null ? (float) $e->confidence_score : null,
            'extracted_at' => $e->extracted_at?->toIso8601String(),
        ];

        return $this->additional['detail'] ?? false
            ? $summary + ['raw_text' => $e->raw_text, 'structured_payload' => $e->structured_payload]
            : $summary;
    }
}
