<?php

namespace App\Services\Assistant;

use App\Models\Service;

// The ONLY facts the assistant may use. Two classes, nothing else:
//   B. static, repository-authored descriptions of how THIS system works for a Patient (the same wording the Patient screens
//      already show). They are navigation help, not clinic policy, medical guidance, prices, hours or availability.
//   A. live server data limited to non-sensitive identity: active service NAMES (M13 catalog).
//      No price (M13 prices are Owner-confirmed and have no Patient projection), no duration, no Patient data of any kind.
//      NO BRANCH DATA: M2 branch records are operational placeholders ("Branch A/B/C", unconfirmed addresses/phones/hours) whose
//      mapping to the clinic's public branches is not stakeholder-confirmed, so they must never become public clinic truth.
//      A question about branches or locations therefore gets the normal "no confirmed clinic information" handoff.
// Retrieval is deterministic keyword matching; when nothing matches the answer is "no confirmed information" WITHOUT a model call.
// Content changes only through code review (there is no knowledge editor and no draft/publish lifecycle: POLICY DECISION REQUIRED).
final class AssistantKnowledge
{
    public const VERSION = '2026-10-05.2';

    /** @var array<string, array{title:string, keywords:string, text:string}> */
    private const STATIC = [
        'booking' => ['title' => 'Booking an appointment', 'keywords' => '/\b(book|booking|appointment|schedule|slot|smart find|manual|dentist assign|reserve)/i',
            'text' => 'Open Book, choose Smart Find or Manual booking, then pick any validated available slot. A Dentist is assigned automatically.'],
        'hmo' => ['title' => 'HMO documents', 'keywords' => '/\b(hmo|insurance|coverage|requirement|provider|loa|claim)/i',
            'text' => 'Your HMO case lists missing requirements. You can record document metadata; clinic staff checks local requirements. This app does not upload files or contact the provider.'],
        'queue' => ['title' => 'How the queue works', 'keywords' => '/\b(queue|wait|waiting|position|arriv|check.?in|turn|called)/i',
            'text' => 'After Staff records your arrival, your Home shows your position and an estimated wait from this workspace’s current data.'],
        'payments' => ['title' => 'Payments and receipts', 'keywords' => '/\b(pay|payment|invoice|receipt|bill|billing|balance)/i',
            'text' => 'Receipts & Payments lists the invoices the clinic has issued and your receipts. The clinic records payments. Nothing is charged when you book.'],
    ];

    /**
     * Grounding coverage for MIXED questions: every substantive clause (three or more words) must itself match an approved topic.
     * A clause that matches nothing is an unsupported part of the question; the caller then refuses the WHOLE request instead of
     * letting the model answer that part from general knowledge just because another part retrieved approved text.
     */
    public static function everyClauseIsCovered(string $message): bool
    {
        foreach (preg_split('/[?;!]|\b(?:and|also|plus|but|then)\b|,/iu', $message) ?: [] as $clause) {
            $clause = trim($clause);
            if (count(preg_split('/\s+/u', $clause, -1, PREG_SPLIT_NO_EMPTY)) < 3) {
                continue;                       // a greeting, "please", a one- or two-word tail
            }
            if (! self::matchesAnyTopic($clause)) {
                return false;
            }
        }

        return true;
    }

    private static function matchesAnyTopic(string $text): bool
    {
        foreach (self::STATIC as $entry) {
            if (preg_match($entry['keywords'], $text)) {
                return true;
            }
        }

        return (bool) preg_match(self::SERVICES, $text);
    }

    private const SERVICES = '/\b(service|services|procedure|procedures|offer|offered|treatments? (do|does) you|what do you do)/i';

    /** @return list<array{id:string,title:string,text:string}> */
    public static function relevant(string $message): array
    {
        $found = [];
        foreach (self::STATIC as $id => $entry) {
            if (preg_match($entry['keywords'], $message)) {
                $found[] = ['id' => $id, 'title' => $entry['title'], 'text' => $entry['text']];
            }
        }
        if (preg_match(self::SERVICES, $message)) {
            $names = Service::where('status', 'Active')->orderBy('name')->pluck('name')->all();
            if ($names) {
                $found[] = ['id' => 'services', 'title' => 'Services in the clinic catalog', 'text' => 'Active services: '.implode(', ', $names).'. Availability and prices are confirmed with clinic staff.'];
            }
        }
        return array_slice($found, 0, 3);
    }
}
