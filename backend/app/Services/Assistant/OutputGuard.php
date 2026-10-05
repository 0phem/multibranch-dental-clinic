<?php

namespace App\Services\Assistant;

// Last structural check on model text before a Patient sees it. It rejects output that claims an action the assistant cannot take,
// gives patient-specific clinical judgment, echoes the internal instructions, contains a credential-like or identifier-like
// string, or is empty/oversized. A rejected answer is replaced by a fixed safe text (never shown, never repaired).
final class OutputGuard
{
    public const CANARY = 'M7-INTERNAL-8d41c2';

    private const PATTERNS = [
        'action_claim' => '/\b(i\'?ve|i have|i\'ll|i will|i am going to|i can|i)\s+(now\s+|just\s+|already\s+)?(booked|book|cancel(?:l)?ed|cancel|rescheduled|reschedule|notified|notify|approved|approve|sent|send|processed|process|paid|pay|scheduled|schedule|marked|mark|changed|change|checked you in|submitted|submit)\b/i',
        'action_done' => '/\b(your (appointment|booking|payment|prescription|claim|request) (has been|was|is now) (booked|cancel(?:l)?ed|rescheduled|approved|sent|processed|paid|confirmed|submitted))/i',
        'clinical' => '/\b(you (probably |likely |may |might )?(have|has|need|should take|should get)\b.{0,30}\b(cavity|cavities|infection|abscess|cancer|root canal|extraction|antibiotic|medication|filling|crown)|i (diagnose|prescribe|recommend (that )?you (take|get|have|use)))|\b\d+(\.\d+)?\s?(mg|ml|mcg|tablets?|capsules?)\b/i',
        'unconfirmed_fact' => '/\b(open|opens|closed|closes|hours?)\b.{0,40}\b\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)|\b\d{1,2}(:\d{2})?\s?(am|pm)\s?(-|–|to)\s?\d{1,2}|(₱|\bphp\b|\bpesos?\b|\$)\s?\d|\b\d[\d,]*(\.\d\d)?\s?(php|pesos?)\b|\b(we|the clinic)\s+(accept|accepts|take|takes|honou?rs?)\b.{0,30}\b(hmo|insurance|maxicare|intellicare|medicard|philcare)|\b(best|top-rated|most experienced)\s+dentist\b/i',
        'internal' => '/\b(system prompt|my instructions|hidden instruction|knowledge block|patient_message|internal rules?)\b/i',
        'secret' => '/(sk-[A-Za-z0-9_-]{8,}|api[_ -]?key|bearer\s+[A-Za-z0-9._-]{8,}|password\s*[:=]|-----BEGIN)/i',
        'identifier' => '/\b[0-9A-HJKMNP-TV-Z]{26}\b|\bPAT-\d{3,}\b|\bINV-\d{4}-\d+\b/',
    ];

    /** @return string|null the reason a model answer is unsafe, or null when it may be shown */
    public static function violation(string $text): ?string
    {
        $text = trim($text);
        if ($text === '' || mb_strlen($text) > 1500) {
            return 'unusable';
        }
        if (str_contains($text, self::CANARY)) {
            return 'internal';
        }
        foreach (self::PATTERNS as $reason => $pattern) {
            if (preg_match($pattern, $text)) {
                return $reason;
            }
        }

        return null;
    }
}
