<?php

namespace App\Services\Assistant;

// Deterministic, server-side screen of the Patient's message BEFORE any model call (and before the rule-based fallback). It is a
// safety and cost gate, not the only boundary: the model also has strict instructions, read-only tools bound to the signed-in
// Patient and an output check. Four classes get a fixed answer with no model call:
//   emergency  — severe pain, swelling, heavy bleeding, trauma, a knocked-out tooth, trouble breathing or swallowing, fever with swelling
//   medical    — a request for a diagnosis, medicine, dosage or prescription, or to interpret an X-ray or result (book a consultation)
//   extraction — attempts to get the instructions, keys or another person's data
//   off_topic  — clearly unrelated requests (coding, homework, politics, finance, recipes, entertainment…)
// Questions about the clinic, its services, booking, billing, the portal and general dental care go through.
final class IntentGuard
{
    public const EMERGENCY = 'emergency';
    public const MEDICAL = 'refused_medical';
    public const EXTRACTION = 'refused_extraction';
    public const OFF_TOPIC = 'refused_off_topic';

    private const EMERGENCY_PATTERNS = [
        '/\b(severe|unbearable|extreme|intense|terrible|worst)\b.{0,25}\b(pain|toothache|ache|bleeding|swelling)/i',
        '/\b(swollen|swelling)\b.{0,40}\b(face|jaw|cheek|eye|neck|throat)\b|\b(face|jaw|cheek|eye|neck|throat)\b.{0,25}\b(swollen|swelling)\b/i',
        '/\b(bleeding|bleeds?)\b.{0,30}\b(won\'?t stop|will not stop|not stopping|a lot|heavily|non-?stop|for hours)\b|\bheavy bleeding\b/i',
        '/\b(knocked[- ]out|knocked out|broken jaw|broke my jaw|fell on my (face|mouth)|hit (in|on) the (face|mouth)|accident|trauma|injur(y|ed))\b/i',
        '/\b(can\'?t|cannot|difficulty|hard to|trouble)\s+(breathe|breathing|swallow|swallowing|open my mouth)\b/i',
        '/\b(fever)\b.{0,40}\b(swell|swollen|tooth|gum|jaw)|\b(swell|swollen|tooth|gum|jaw)\b.{0,40}\bfever\b/i',
        '/\b(emergency|urgent|ambulance|er\b|emergency room)\b/i',
        // Filipino / Taglish
        '/\b(sobrang|napaka|grabe(ng)?)\s*(sakit|kirot)\b|\bnapakasakit\b|\bhindi (ko )?(na )?(kaya|matiis) ang sakit\b/i',
        '/\b(namamaga|maga|lumaki)\b.{0,25}\b(mukha|panga|pisngi|mata|leeg|lalamunan)\b|\b(mukha|panga|pisngi)\b.{0,20}\b(namamaga|maga)\b/i',
        '/\b(dumudugo|nagdudugo|dugo)\b.{0,30}\b(hindi|di|ayaw)\s+(tumitigil|humihinto|tumigil|huminto)\b/i',
        '/\b(hindi|di|hirap)\s+(ako\s+)?(makahinga|huminga|makalunok|lumunok|maibuka ang bibig)\b/i',
        '/\blagnat\b.{0,40}\b(maga|ngipin|gilagid|panga)\b|\b(maga|ngipin|gilagid|panga)\b.{0,40}\blagnat\b/i',
        '/\b(naaksidente|nabagok|nabangga|natanggal ang ngipin|nabali ang (ngipin|panga))\b/i',
    ];

    private const MEDICAL_PATTERNS = [
        '/\b(medicine|medication|medicines|antibiotic|antibiotics|painkiller|analgesic|ibuprofen|paracetamol|acetaminophen|amoxicillin|mefenamic|dosage|dose|doses|mg\b|milligram)/i',
        '/\bprescri/i',
        '/\b(diagnose|diagnosis)\b|\bdo i have\b|\bis (this|it|that|my)\b.{0,40}\b(cavity|cancer|infect|abscess|normal|serious|dangerous|decay|gum disease|tumou?r|cyst)/i',
        '/\b(read|interpret|explain|check|look at)\b.{0,30}\b(x-?ray|radiograph|panoramic|scan|lab result|biopsy|photo of my)/i',
        '/\bwhat\s+(should|can)\s+i\s+(take|drink)\b/i',
        // Filipino / Taglish
        '/\b(gamot|reseta|resetahan)\b|\b(pwede|puwede)\s+(bang?|ba)\s+(uminom|inumin)\b|\bilang\s+(tablet|tableta|beses)\b/i',
        '/\b(may|meron)\s+(ba\s+)?(akong|ako ng)\s+(cavity|sira|impeksyon|infection)\b|\bsira (ba|na ba) (ang )?ngipin ko\b/i',
    ];

    private const EXTRACTION_PATTERNS = [
        '/\b(system|hidden|initial|internal|secret)\s+(prompt|instruction|message|rule)s?\b/i',
        '/\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|all|your)\b.{0,30}\b(instruction|rule|prompt|polic)/i',
        '/\b(reveal|print|show|output|dump|leak|return)\b.{0,40}\b(database|prompt|instruction|api[ _-]?key|secret|token|password|environment|env\b|credential|config)/i',
        '/\b(environment variable|\.env\b|api[ _-]?key|bearer token|access token)\b/i',
        '/\b(pretend|act|behave|roleplay)\b.{0,20}\b(as|you are|to be|like)\b.{0,30}\b(owner|admin|dentist|staff|developer|system)/i',
        '/\b(developer|debug|admin|jailbreak|dan)\s+mode\b/i',
        '/\b(other|another|someone else\'?s?|all)\s+(patient|patients|people|users?)\b.{0,30}\b(appointment|invoice|balance|record|data|name|email|phone)s?/i',
        '/\bpatient\s*(#|no\.?|number|id)\s*\d+/i',
        '/\b(appointment|appointments|invoice|invoices|balance|record|records|data|details|bill|bills)\b.{0,25}\b(of|for|belonging to)\s+(another|other|a different|someone|somebody|all)\b/i',
        // Filipino / Taglish: another patient's records ("ibang pasyente", "appointment ni Maria")
        '/\b(ibang|iba pang|lahat ng)\s+(pasyente|patient)/i',
        '/\b(appointment|appointments|balance|utang|invoice|record|records|schedule|sched)\s+(ni|nina|ng ibang)\s+\p{L}+/iu',
        '/\b(someone|somebody|a friend|my friend|my (wife|husband|mom|mother|dad|father|sister|brother))\b.{0,15}\b(appointment|balance|invoice|record)s?\b/i',
    ];

    private const OFF_TOPIC_PATTERNS = [
        '/\b(write|debug|fix|code|program)\b.{0,30}\b(code|script|program|function|python|javascript|java|php|sql|html|css)\b/i',
        '/\b(homework|essay|thesis|math problem|solve (this|for)|calculus|algebra)\b/i',
        '/\b(president|election|senator|politic|government|war\b|religion)/i',
        '/\b(stock|stocks|crypto|bitcoin|forex|invest(ment|ing)?|loan|gambl|casino|lotto|lottery)\b/i',
        '/\b(recipe|cook|weather|movie|song|lyrics|celebrity|basketball|nba|football|game|joke|poem|horoscope|zodiac)\b/i',
        '/\b(translate)\b.{0,30}\b(into|to)\b/i',
        '/\b(tula|kanta|lutuin|ulam|panahon bukas)\b/i',
    ];

    /** @return string|null the fixed-answer class, or null when the message may go on to the assistant */
    public static function screen(string $message): ?string
    {
        foreach ([[self::EMERGENCY, self::EMERGENCY_PATTERNS], [self::EXTRACTION, self::EXTRACTION_PATTERNS], [self::MEDICAL, self::MEDICAL_PATTERNS], [self::OFF_TOPIC, self::OFF_TOPIC_PATTERNS]] as [$outcome, $patterns]) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $message)) {
                    return $outcome;
                }
            }
        }

        return null;
    }
}
