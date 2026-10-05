<?php

namespace App\Services\Assistant;

// Deterministic, server-side screen of the Patient's message BEFORE any provider call. It is a cost and safety gate, not the
// security boundary: the model is given no data except approved knowledge and has no tools, so even a missed pattern cannot
// reach other Patients' data or change anything. Process questions ("How do I book?") are allowed through; requests to ACT,
// to diagnose/prescribe, to quote prices or to extract instructions/secrets are answered with a fixed text and no model call.
final class IntentGuard
{
    public const CLINICAL = 'refused_clinical';

    public const ACTION = 'refused_action';

    public const EXTRACTION = 'refused_extraction';

    public const PRICING = 'pricing_not_quoted';

    public const UNCONFIRMED = 'unconfirmed_fact';

    private const EXTRACTION_PATTERNS = [
        '/\b(system|hidden|initial|internal|secret)\s+(prompt|instruction|message|rule)s?\b/i',
        '/\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|all|your)\b.{0,30}\b(instruction|rule|prompt|polic)/i',
        '/\b(reveal|print|show|output|dump|leak|return)\b.{0,40}\b(database|prompt|instruction|api[ _-]?key|secret|token|password|environment|env\b|credential|config)/i',
        '/\b(environment variable|\.env\b|api[ _-]?key|bearer token|access token)\b/i',
        '/\b(pretend|act|behave|roleplay)\b.{0,20}\b(as|you are|to be|like)\b.{0,30}\b(owner|admin|dentist|staff|developer|system)/i',
        '/\b(developer|debug|admin|jailbreak|dan)\s+mode\b/i',
        '/\bpatient\s*(#|no\.?|number|id)\s*\d+/i',
        '/\b(call|invoke|use)\b.{0,20}\b(hidden|internal|secret|admin)\s+(api|endpoint|tool)/i',
        '/\bfollow\b.{0,30}\binstructions?\b.{0,30}\b(in|inside|contained|from)\b.{0,30}\b(document|file|upload|attachment|text)/i',
    ];

    private const ACTION_PATTERNS = [
        '/\b(book|reserve|reschedule|cancel|move|switch|change|transfer)\s+(me|my|the my|us|our)\b/i',
        '/^\s*(please\s+)?((can|could|would|will)\s+you\s+)?(book|reserve|schedule)\s+(a|an|the)\s+(appointment|visit|slot)\b/i',
        '/\b(mark|check|sign|register)\s+me\b/i',
        '/\b(approve|authorize|authorise|confirm|submit|file)\s+(my|the)\s+(treatment|hmo|claim|prescription|invoice|payment|appointment)/i',
        '/\b(pay|refund|settle|charge)\s+(my|the|this)\b/i',
        '/\b(write|issue|send|give|prepare|renew|refill)\s+(me\s+)?(a|an|my|the)\s+(prescription|medicine|medication|refill)/i',
        '/\b(notify|tell|message|email|text|call)\s+(my|the)\s+(dentist|doctor|staff|clinic)\b/i',
    ];

    private const CLINICAL_PATTERNS = [
        '/\bis\s+(this|it|that|my)\b.{0,40}\b(cavity|cancer|infect|abscess|normal|serious|dangerous|decay|gum disease|tumou?r|cyst)/i',
        '/\b(diagnos|cavity|cavities|cancer|abscess|infection|infected|swelling|swollen|toothache|bleeding|pus\b|decay|gingivitis|periodontitis|wisdom tooth)/i',
        '/\b(medicine|medication|medicines|antibiotic|antibiotics|painkiller|analgesic|ibuprofen|paracetamol|acetaminophen|amoxicillin|dosage|dose|doses|mg\b|milligram)/i',
        '/\bprescri/i',
        '/\b(x-?ray|radiograph|panoramic|ct scan|lab result|biopsy)/i',
        '/\bshould\s+i\s+(get|have|take|use|do|choose|undergo|pull|remove|extract)\b/i',
        '/\b(root canal|extraction|filling|crown|implant|braces|whitening)\b.{0,30}\b(or|versus|vs\.?|better|necessary|needed|safe)\b/i',
        '/\b(which|what)\s+(treatment|procedure|medicine|medication|drug)\b/i',
        '/\b(is|are)\b.{0,30}\b(medically\s+)?(necessary|safe|harmful)\b/i',
        '/\bwhat\s+should\s+i\s+(take|do|use|apply)\b/i',
        '/\b(pain|hurts?|aching|sore)\b/i',
    ];

    // The narrow project-known UNRESOLVED clinic-fact classes (not a general blacklist; structural knowledge restriction and the
    // clause-coverage rule are the primary boundary): hours/closures, insurance participation, HMO response times, consent and
    // signature requirements, procedure instructions, and Dentist quality/recommendation.
    private const UNCONFIRMED_PATTERNS = [
        '/\b(opening|closing|business|clinic|office|working)\s+hours?\b|\bwhat\s+time\b.{0,30}\b(open|close|closed|opens|closes)\b|\b(are|is)\s+(you|the clinic|it)\b.{0,20}\b(open|closed)\b|\b(open|closed)\b.{0,20}\b(on\s+)?(sunday|saturday|monday|tuesday|wednesday|thursday|friday|weekend|holiday|holidays|today|tomorrow|late)\b/i',
        '/\b(holiday|holidays|closure|closures|closed on|day off)\b/i',
        '/\b(which|what)\s+(insurance|hmo|health\s*card|provider)s?\b.{0,30}\b(accept|accepted|take|honou?r|cover|covered|partner|participat|in[- ]network|work with)|\b(do|does)\s+(you|the clinic)\s+(accept|take|honou?r|work with)\b.{0,30}\b(hmo|insurance|maxicare|intellicare|medicard|philcare)/i',
        '/\bhow\s+long\b.{0,40}\b(approval|approve|approved|hmo|claim|loa|processing|process|response)\b|\b(approval|hmo|claim|loa)\b.{0,30}\b(take|takes|time|days|weeks|turnaround)\b/i',
        '/\b(consent|signature|waiver|guardian)\b|\b(parent|parents|parent.s)\b.{0,30}\b(consent|sign|permission|present|accompany)|\bsign(ed)?\b.{0,20}\b(form|waiver|consent|document)/i',
        '/\b(before|after|prior to|following)\s+(my|the|an?|your)\s+(procedure|surgery|extraction|cleaning|operation|treatment|appointment|visit)\b.{0,40}\b(eat|drink|take|avoid|do|should|fast|brush|rinse|bring)|\b(aftercare|after-?care|pre-?op|post-?op|fasting|instructions? (before|after))\b/i',
        '/\b(best|top|better|good|worst|most experienced|recommended?|highly rated|ranking|rated)\s+(dentist|doctor|dental)\b|\bwhich\s+(dentist|doctor)\b|\brecommend\s+(a|an|me a|the)\s+(dentist|doctor|branch)\b/i',
    ];

    private const PRICING_PATTERNS = ['/\b(price|prices|pricing|cost|costs|fee|fees|how much|rate|rates|quote|estimate|charge for|₱|php|peso|pesos|discount|promo|affordable|cheap)\b/i'];

    /** @return string|null the refusal outcome, or null when the message may continue to approved-knowledge retrieval */
    public static function screen(string $message): ?string
    {
        foreach ([[self::EXTRACTION, self::EXTRACTION_PATTERNS], [self::ACTION, self::ACTION_PATTERNS], [self::CLINICAL, self::CLINICAL_PATTERNS], [self::PRICING, self::PRICING_PATTERNS], [self::UNCONFIRMED, self::UNCONFIRMED_PATTERNS]] as [$outcome, $patterns]) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $message)) {
                    return $outcome;
                }
            }
        }

        return null;
    }
}
