<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class DocumentExtractionResource extends JsonResource
{
    public function toArray($request): array
    {
        $e = $this->resource;
        return [
            'id' => $e->public_id,
            'method' => $e->extraction_method,
            'status' => $e->status,
            'raw_text' => $e->raw_text,
            'structured_payload' => $e->structured_payload,
            'confidence_score' => $e->confidence_score !== null ? (float) $e->confidence_score : null,
            'extracted_at' => $e->extracted_at?->toIso8601String(),
        ];
    }
}
