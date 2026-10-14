<?php

namespace App\Services\Assistant;

/**
 * Text matching for the assistant's knowledge mode (no AI). A message is normalised (lower case, no accents or punctuation),
 * split into words, and each word is mapped to a canonical word: English, Filipino and Taglish synonyms ("magkano" -> "price",
 * "saan" -> "where", "bukas" -> "open") and small typos ("apointment" -> "appointment", "magkno" -> "price") resolve to the same
 * canonical word. A candidate (a built-in topic or an Owner-edited answer) is a list of phrases with weights; its confidence is
 * the sum of the weights of the phrases found in the message, capped at 1.
 */
final class KnowledgeMatcher
{
    /** canonical word => words and short phrases that mean it (English, Filipino, Taglish). */
    private const SYNONYMS = [
        'price' => ['price', 'prices', 'pricing', 'magkano', 'magkanu', 'presyo', 'cost', 'costs', 'rate', 'rates', 'fee', 'fees', 'how much', 'singil', 'halaga'],
        'pay' => ['pay', 'paying', 'payment', 'payments', 'bayad', 'magbayad', 'bayaran', 'nagbayad', 'gcash', 'maya', 'paymaya', 'card', 'credit', 'debit', 'paymongo', 'online payment', 'cash'],
        'balance' => ['balance', 'balances', 'utang', 'owe', 'due', 'babayaran', 'unpaid', 'outstanding', 'kulang'],
        'invoice' => ['invoice', 'invoices', 'bill', 'bills', 'billing', 'statement', 'charges', 'charge'],
        'receipt' => ['receipt', 'receipts', 'resibo', 'official receipt', 'proof of payment'],
        'appointment' => ['appointment', 'appointments', 'appt', 'appts', 'sched', 'schedule', 'schedules', 'booking', 'bookings', 'visit', 'visits', 'checkup', 'check up', 'check-up', 'consultation', 'konsulta'],
        'book' => ['book', 'booking', 'magpabook', 'pabook', 'pa book', 'magpa book', 'mag book', 'magbook', 'reserve', 'reservation', 'magpaschedule', 'pa schedule', 'magpa schedule', 'magpaappointment', 'set an appointment', 'make an appointment', 'get an appointment', 'magpatingin', 'pacheck', 'magpacheck'],
        'cancel' => ['cancel', 'cancelled', 'canceled', 'cancellation', 'icancel', 'i cancel', 'kansel', 'ikansela', 'hindi makakapunta', 'di makakapunta', 'hindi ako makakapunta'],
        'reschedule' => ['reschedule', 'resched', 'rebook', 'move', 'ilipat', 'lipat', 'palitan', 'iurong', 'urong', 'change the date', 'change my schedule', 'change date', 'ibang araw', 'ibang oras'],
        'branch' => ['branch', 'branches', 'sangay', 'clinics', 'locations', 'location', 'site', 'sites'],
        'where' => ['where', 'saan', 'nasaan', 'san', 'address', 'located', 'direction', 'directions', 'paano pumunta', 'how to get', 'how do i get', 'map', 'maps', 'landmark', 'papunta'],
        'hours' => ['hours', 'hour', 'oras', 'anong oras', 'what time', 'opening', 'closing', 'schedule ng clinic', 'clinic hours', 'business hours'],
        'open' => ['open', 'bukas', 'bukas ba', 'operating', 'available'],
        'closed' => ['closed', 'close', 'sarado', 'off', 'day off', 'walang pasok'],
        'sunday' => ['sunday', 'sundays', 'linggo'],
        'saturday' => ['saturday', 'saturdays', 'sabado'],
        'weekend' => ['weekend', 'weekends'],
        'holiday' => ['holiday', 'holidays', 'pista', 'christmas', 'pasko', 'new year', 'bagong taon', 'holy week', 'semana santa', 'undas'],
        'service' => ['service', 'services', 'serbisyo', 'offer', 'offers', 'offered', 'treatment', 'treatments', 'procedure', 'procedures', 'ginagawa'],
        'otp' => ['otp', 'code', 'codes', 'verification', 'verify', 'verified', 'iverify', 'six digit', '6 digit'],
        'signin' => ['login', 'log in', 'signin', 'sign in', 'mag login', 'password', 'forgot', 'nakalimutan', 'account', 'register', 'registration', 'sign up', 'signup', 'create an account'],
        'contact' => ['contact', 'phone', 'number', 'numero', 'call', 'tawag', 'tawagan', 'email', 'landline', 'cellphone', 'cp', 'mobile', 'hotline', 'reach'],
        'desk' => ['front desk', 'frontdesk', 'staff', 'receptionist', 'secretary', 'tao', 'human', 'person', 'agent', 'kausap', 'talk to someone', 'real person'],
        'next' => ['next', 'susunod', 'upcoming', 'kailan', 'when', 'coming'],
        'my' => ['my', 'mine', 'ko', 'akin', 'aking', 'ako', 'me'],
        'care' => ['brush', 'brushing', 'toothbrush', 'floss', 'flossing', 'toothpaste', 'mouthwash', 'tips', 'tip', 'alaga', 'alagaan', 'hygiene', 'clean my teeth', 'linisin'],
        'sensitive' => ['sensitive', 'sensitivity', 'ngilo', 'nangingilo'],
        'breath' => ['bad breath', 'mabaho hininga', 'mabahong hininga', 'halitosis', 'hininga'],
        'hmo' => ['hmo', 'hmos', 'insurance', 'maxicare', 'intellicare', 'medicard', 'philcare', 'healthcard', 'health card'],
        'busy' => ['busy', 'crowded', 'matao', 'peak', 'pila', 'queue', 'waiting', 'wait', 'long line', 'mahaba pila', 'less busy', 'konti tao'],
        'clinic_history' => ['since', 'how long', 'gaano katagal', 'history', 'established', 'about the clinic', 'tungkol', 'founded'],
        'hello' => ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'kumusta', 'kamusta', 'magandang umaga', 'magandang hapon', 'magandang gabi', 'helo'],
        'thanks' => ['thanks', 'thank you', 'salamat', 'ty', 'tnx', 'thx', 'maraming salamat'],
        'how' => ['how', 'paano', 'pano', 'what are the steps', 'steps', 'process', 'paraan'],
        'dentist' => ['dentist', 'dentists', 'doctor', 'doc', 'dra', 'dr', 'dentista', 'doktor'],
        'teeth' => ['tooth', 'teeth', 'ngipin', 'dental', 'gums', 'gilagid'],
        'clinic' => ['clinic', 'klinik', 'kayo', 'ninyo', 'niyo', 'nyo', 'dito', 'you', 'your'],
    ];

    /** Typo tolerance applies only to these canonical words' source words of length >= 5 (never to short words like "or"). */
    private static ?array $lookup = null;

    private static ?array $phrases = null;

    public static function normalise(string $text): string
    {
        $text = mb_strtolower($text);
        $text = strtr($text, ['á' => 'a', 'à' => 'a', 'â' => 'a', 'é' => 'e', 'è' => 'e', 'í' => 'i', 'ì' => 'i', 'ó' => 'o', 'ò' => 'o', 'ú' => 'u', 'ù' => 'u', 'ñ' => 'n', '’' => "'"]);
        $text = preg_replace("/'s\b/", '', $text);
        $text = preg_replace('/[^a-z0-9 ]+/', ' ', $text);

        return trim(preg_replace('/\s+/', ' ', $text));
    }

    /** The message as canonical words, with multi-word synonyms joined first ("how much" -> price, "front desk" -> desk). */
    public static function canonical(string $text): array
    {
        self::build();
        $text = ' '.self::normalise($text).' ';
        foreach (self::$phrases as $phrase => $canonical) {
            $text = str_replace(" $phrase ", " $canonical ", $text);
        }
        $words = [];
        foreach (preg_split('/\s+/', trim($text), -1, PREG_SPLIT_NO_EMPTY) as $word) {
            $words[] = self::$lookup[$word] ?? self::fuzzy($word) ?? $word;
        }

        return $words;
    }

    /**
     * Confidence (0..1) that $words matches a candidate: each phrase found adds its weight. A phrase is a space-separated list of
     * canonical (or plain) words that must all appear in the message, in any order.
     *
     * @param  list<string>  $words  canonical words of the message
     * @param  array<string, float>  $phrases
     */
    public static function score(array $words, array $phrases): float
    {
        $set = array_flip($words);
        $total = 0.0;
        foreach ($phrases as $phrase => $weight) {
            $needed = self::canonical((string) $phrase);
            if ($needed && ! array_diff($needed, array_keys($set))) $total += $weight;
        }

        return min(1.0, round($total, 2));
    }

    /** Every canonical word: a message using any of them is about the clinic (an unknown fact is handed over, not refused). */
    public static function concepts(): array
    {
        return array_keys(self::SYNONYMS);
    }

    /** True when the message mentions any of these canonical words. */
    public static function mentions(array $words, string ...$canonical): bool
    {
        return (bool) array_intersect($words, $canonical);
    }

    private static function build(): void
    {
        if (self::$lookup !== null) return;
        self::$lookup = [];
        self::$phrases = [];
        foreach (self::SYNONYMS as $canonical => $words) {
            self::$lookup[$canonical] = $canonical;
            foreach ($words as $word) {
                $word = self::normalise($word);
                if (str_contains($word, ' ')) self::$phrases[$word] = $canonical;
                else self::$lookup[$word] ??= $canonical;
            }
        }
        // Longest phrases first, so "hindi ako makakapunta" wins over shorter phrases inside it.
        uksort(self::$phrases, fn ($a, $b) => strlen($b) <=> strlen($a));
    }

    /** Two neighbouring letters swapped ("reciept", "apponitment"). */
    private static function swapped(string $a, string $b): bool
    {
        if (strlen($a) !== strlen($b)) return false;
        $diff = [];
        for ($i = 0; $i < strlen($a); $i++) if ($a[$i] !== $b[$i]) $diff[] = $i;

        return count($diff) === 2 && $diff[1] === $diff[0] + 1 && $a[$diff[0]] === $b[$diff[1]] && $a[$diff[1]] === $b[$diff[0]];
    }

    /** A small typo in a longer word: one edit for 5-7 letters, two for 8 or more. */
    private static function fuzzy(string $word): ?string
    {
        $length = strlen($word);
        if ($length < 5 || ctype_digit($word)) return null;
        $limit = $length >= 8 ? 2 : 1;
        $best = null;
        $bestDistance = $limit + 1;
        foreach (self::$lookup as $source => $canonical) {
            if (strlen($source) < 5 || abs(strlen($source) - $length) > $limit) continue;
            $distance = levenshtein($word, (string) $source);
            if ($distance === 2 && self::swapped($word, (string) $source)) $distance = 1; // "reciept" for "receipt"
            if ($distance < $bestDistance) {
                $best = $canonical;
                $bestDistance = $distance;
            }
        }

        return $best;
    }
}
