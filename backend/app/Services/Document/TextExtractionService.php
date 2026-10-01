<?php

namespace App\Services\Document;

use App\Models\Document;
use App\Models\DocumentExtraction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;
use Throwable;

class TextExtractionService
{
    /**
     * Extracts text or metadata from a document into a non-authoritative draft record.
     * Guaranteed to never throw fatal errors or block the caller.
     */
    public function extract(Document $document): DocumentExtraction
    {
        $rawText = null;
        $structured = [];
        $confidence = 0.0;
        $method = 'native_text';

        try {
            $disk = Storage::disk('local');
            if ($disk->exists($document->file_path)) {
                $content = $disk->get($document->file_path);

                if ($document->mime_type === 'application/pdf') {
                    $rawText = $this->extractPdfText($content);
                    $method = 'native_text';
                    $confidence = ! empty($rawText) ? 0.95 : 0.40;
                } else {
                    $method = 'heuristic_parser';
                    $rawText = $this->heuristicExtractImage($document);
                    $confidence = 0.75;
                }

                $structured = $this->parseKeyEntities($rawText, $document);
            }
        } catch (Throwable $e) {
            $method = 'native_text';
            $rawText = null;
            $structured = ['error' => 'Extraction failed gracefully: ' . $e->getMessage()];
            $confidence = 0.0;
        }

        return DocumentExtraction::create([
            'document_id' => $document->id,
            'extraction_method' => $method,
            'status' => 'Draft',
            'raw_text' => $rawText ? substr($rawText, 0, 65000) : null,
            'structured_payload' => $structured,
            'confidence_score' => $confidence,
            'extracted_at' => CarbonImmutable::now('Asia/Manila'),
        ]);
    }

    /**
     * Native PDF stream text extraction without external dependencies.
     */
    private function extractPdfText(string $pdfContent): ?string
    {
        $text = '';

        // Extract streams
        if (preg_match_all('/stream[\r\n]+(.*?)[\r\n]+endstream/s', $pdfContent, $matches)) {
            foreach ($matches[1] as $stream) {
                // Try decompressing flate streams if zlib is present
                $decompressed = @gzuncompress($stream);
                if ($decompressed === false) {
                    $decompressed = @gzinflate($stream);
                }
                $data = ($decompressed !== false) ? $decompressed : $stream;

                // Extract text operators in PDF (Tj, TJ, ' )
                if (preg_match_all('/\((.*?)\)\s*Tj/s', $data, $textMatches)) {
                    $text .= implode(' ', $textMatches[1]) . "\n";
                } elseif (preg_match_all('/\[(.*?)\]\s*TJ/s', $data, $arrayMatches)) {
                    foreach ($arrayMatches[1] as $arr) {
                        if (preg_match_all('/\((.*?)\)/s', $arr, $subMatches)) {
                            $text .= implode('', $subMatches[1]) . ' ';
                        }
                    }
                    $text .= "\n";
                }
            }
        }

        $cleaned = trim(preg_replace('/[^\x20-\x7E\t\r\n]/', '', $text));
        return ! empty($cleaned) ? $cleaned : null;
    }

    private function heuristicExtractImage(Document $document): string
    {
        $category = $document->category;
        $title = $document->title;
        $meta = $document->metadata ?? [];

        $parts = ["Scanned Document: {$title}", "Category: {$category}"];
        if (! empty($meta['provider'])) {
            $parts[] = "Provider: {$meta['provider']}";
        }
        if (! empty($meta['member_number'])) {
            $parts[] = "Member ID: {$meta['member_number']}";
        }

        return implode("\n", $parts);
    }

    /**
     * Extracts structured candidates (HMO member numbers, dates, provider names) from text.
     */
    private function parseKeyEntities(?string $text, Document $document): array
    {
        $entities = [
            'document_category' => $document->category,
            'detected_dates' => [],
            'member_number_candidate' => null,
            'provider_candidate' => null,
            'is_draft_only' => true,
        ];

        if (! $text) {
            return $entities;
        }

        // Detect YYYY-MM-DD or DD/MM/YYYY dates
        if (preg_match_all('/\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b/', $text, $dMatches)) {
            $entities['detected_dates'] = array_values(array_unique($dMatches[0]));
        }

        // Detect common Philippine HMO provider names
        $providers = ['Maxicare', 'Intellicare', 'Medicard', 'PhilCare', 'Caritas', 'Cocolife', 'ValuCare', 'Insurer'];
        foreach ($providers as $p) {
            if (stripos($text, $p) !== false || stripos($document->title, $p) !== false) {
                $entities['provider_candidate'] = $p;
                break;
            }
        }

        // Detect member numbers (e.g. alphanumeric strings 8-16 chars with hyphens/digits)
        if (preg_match('/\b([A-Z0-9]{2,4}-[0-9]{4,10}|[0-9]{10,16})\b/i', $text, $mMatch)) {
            $entities['member_number_candidate'] = $mMatch[1];
        }

        return $entities;
    }
}
