<?php

namespace App\Services\Document;

use App\Models\Document;
use App\Models\DocumentExtraction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;
use Throwable;

// M14 text extraction infrastructure. The output is ALWAYS a Draft, non-authoritative record: it never changes an HMO case,
// prescription, treatment, billing, Patient identity or consent, and only an authorized human in the owning module can act
// on it. Extracted text is untrusted DATA (an uploaded document may contain anything, including text that looks like an
// instruction); nothing here interprets it as a command, and no language model or tool-calling is involved.
//
// What exists: NATIVE text extraction from machine-readable PDFs only. What does not: OCR. Images (and scanned PDFs with no
// text layer) therefore get no extraction at all — never a fabricated one — and the document reports that honestly.
class TextExtractionService
{
    /** Hard bound on any decompressed PDF stream (a compressed stream can expand enormously). */
    private const MAX_INFLATED_BYTES = 5_000_000;

    public const PDF_MIME = 'application/pdf';

    /** True when this service can attempt native extraction for the document's type. */
    public function supports(Document $document): bool
    {
        return $document->mime_type === self::PDF_MIME;
    }

    /**
     * Returns the Draft extraction, or null when the type is unsupported (no OCR) or the PDF has no extractable text layer.
     * Never throws and never blocks the upload: an unreadable PDF simply yields no extraction.
     */
    public function extract(Document $document): ?DocumentExtraction
    {
        if (! $this->supports($document)) {
            return null;
        }

        try {
            $disk = Storage::disk('local');
            if (! $disk->exists($document->file_path)) {
                return null;
            }
            $text = $this->extractPdfText((string) $disk->get($document->file_path));
        } catch (Throwable) {
            return null; // no internal exception text is stored or returned
        }
        if ($text === null) {
            return null;
        }

        return DocumentExtraction::create([
            'document_id' => $document->id,
            'extraction_method' => 'native_text',
            'status' => 'Draft',
            'raw_text' => substr($text, 0, 65000),
            'structured_payload' => $this->candidates($text, $document),
            // Native text has no measurable accuracy, so no confidence figure is invented.
            'confidence_score' => null,
            'extracted_at' => CarbonImmutable::now('Asia/Manila'),
        ]);
    }

    private function extractPdfText(string $pdf): ?string
    {
        $text = '';
        if (preg_match_all('/stream[\r\n]+(.*?)[\r\n]+endstream/s', $pdf, $matches)) {
            foreach ($matches[1] as $stream) {
                $data = @gzuncompress($stream, self::MAX_INFLATED_BYTES);
                if ($data === false) {
                    $data = @gzinflate($stream, self::MAX_INFLATED_BYTES);
                }
                $data = $data !== false ? $data : $stream;

                if (preg_match_all('/\((.*?)\)\s*Tj/s', $data, $runs)) {
                    $text .= implode(' ', $runs[1])."\n";
                } elseif (preg_match_all('/\[(.*?)\]\s*TJ/s', $data, $arrays)) {
                    foreach ($arrays[1] as $array) {
                        if (preg_match_all('/\((.*?)\)/s', $array, $parts)) {
                            $text .= implode('', $parts[1]).' ';
                        }
                    }
                    $text .= "\n";
                }
            }
        }

        $cleaned = trim((string) preg_replace('/[^\x20-\x7E\t\r\n]/', '', $text));

        return $cleaned !== '' ? $cleaned : null;
    }

    /** Candidate values found IN THE EXTRACTED TEXT (never the title or client metadata). Candidates are not facts. */
    private function candidates(string $text, Document $document): array
    {
        $candidates = [
            'document_category' => $document->category,
            'detected_dates' => [],
            'member_number_candidate' => null,
            'provider_candidate' => null,
            'is_draft_only' => true,
            'provenance' => ['source' => 'document_text', 'method' => 'native_text', 'human_reviewed' => false],
        ];
        if (preg_match_all('/\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b/', $text, $dates)) {
            $candidates['detected_dates'] = array_values(array_unique($dates[0]));
        }
        foreach (['Maxicare', 'Intellicare', 'Medicard', 'PhilCare', 'Caritas', 'Cocolife', 'ValuCare'] as $provider) {
            if (stripos($text, $provider) !== false) {
                $candidates['provider_candidate'] = $provider;
                break;
            }
        }
        if (preg_match('/\b([A-Z0-9]{2,4}-[0-9]{4,10}|[0-9]{10,16})\b/i', $text, $member)) {
            $candidates['member_number_candidate'] = $member[1];
        }

        return $candidates;
    }
}
