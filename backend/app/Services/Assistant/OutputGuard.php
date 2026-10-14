<?php

namespace App\Services\Assistant;

// Last structural check on a model answer before the Patient keeps it. It rejects an answer that claims an action the assistant
// cannot take, gives patient-specific clinical judgment or a dose, echoes the internal instructions, contains a credential, or
// mentions a peso amount or an invoice/receipt number that did not come from this turn's tool results (no invented prices or
// balances). A rejected answer is replaced by a fixed safe text (streamed text is withdrawn in the portal).
final class OutputGuard
{
    public const CANARY = 'M7-INTERNAL-8d41c2';

    private const PATTERNS = [
        'action_claim' => '/\b(i\'?ve|i have|i\'ll|i will|i am going to|i)\s+(now\s+|just\s+|already\s+)?(booked|cancel(?:l)?ed|rescheduled|notified|approved|processed|paid|scheduled|marked|submitted|reserved)\b/i',
        'action_done' => '/\b(your (appointment|booking|payment|prescription|request) (has been|was|is now) (booked|cancel(?:l)?ed|rescheduled|approved|sent|processed|paid|confirmed|submitted))/i',
        'clinical' => '/\b(you (probably |likely |may |might )?(have|has)\b.{0,30}\b(cavity|cavities|infection|abscess|cancer|gum disease)|i (diagnose|prescribe)|you should take)\b|\b\d+(\.\d+)?\s?(mg|ml|mcg|tablets?|capsules?)\b/i',
        'internal' => '/\b(system prompt|my instructions|hidden instruction|internal rules?)\b/i',
        'secret' => '/(sk-[A-Za-z0-9_-]{8,}|api[_ -]?key|bearer\s+[A-Za-z0-9._-]{8,}|password\s*[:=]|-----BEGIN)/i',
        'identifier' => '/\b[0-9A-HJKMNP-TV-Z]{26}\b|\bPAT-\d{3,}\b/',
    ];

    /**
     * @param  list<string>  $grounded  peso amounts and invoice/receipt numbers that tool results returned this turn
     * @return string|null the reason the answer is unsafe, or null when it may stay
     */
    public static function violation(string $text, array $grounded = []): ?string
    {
        $text = trim($text);
        if ($text === '' || mb_strlen($text) > 2000) {
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
        preg_match_all('/₱\s?[\d,]+(?:\.\d{2})?|\b(?:PHP|Php)\s?[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s?(?:pesos?)\b|\bINV-\d{4}-\d+\b|\bRCT-\d{4}-\d+\b/u', $text, $m);
        $allowed = array_map([self::class, 'normal'], $grounded);
        foreach ($m[0] as $token) {
            if (! in_array(self::normal($token), $allowed, true)) {
                return 'ungrounded_amount_or_reference';
            }
        }

        return null;
    }

    /** "₱1,800.00", "PHP 1800" and "1,800 pesos" are the same amount; reference numbers compare exactly. */
    private static function normal(string $token): string
    {
        if (preg_match('/^(INV|RCT)-/', trim($token))) return trim($token);
        $digits = preg_replace('/[^\d.]/', '', $token);

        return 'PHP'.number_format((float) $digits, 2, '.', '');
    }
}
