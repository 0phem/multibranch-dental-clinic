<?php

namespace Database\Seeders;

use App\Models\AssistantAnswer;
use App\Support\ClinicDatabaseGuard;
use Illuminate\Database\Seeder;

/**
 * The Clinic Assistant's answers, written ONLY from facts already in the repository (the clinic interviews, the portal's own
 * behaviour). Clinic staff confirmed them in the second interview (2026-10-19); each stays a DRAFT until the Owner signs it off
 * in Administration → Assistant answers. The three care answers give no health advice until a Dentist approves wording (R2-11). Live facts
 * (services, branches, hours, payment methods, contact) are not copied here: the assistant reads them from the records.
 * Idempotent: an entry is added once (by seed_key) and an Owner's later edit is never overwritten.
 * On the clinic database dental_clinic this is a data change that needs approval: it refuses unless ALLOW_CLINIC_DATABASE=yes.
 */
class AssistantAnswerSeeder extends Seeder
{
    public const ENTRIES = [
        ['about-since', 'about', 'How long has the clinic been operating?',
            'The clinic has been caring for patients since 1981.',
            ['since', 'how long', 'gaano katagal', 'history', 'established', 'kailan nagsimula', 'ilang taon'], 'Clinic interview Q1 and Q3 · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
        ['services-kinds', 'services', 'What kinds of dental care do you provide?',
            'The clinic provides general dentistry, orthodontics (braces), oral surgery and dental X-rays (radiographic imaging). You can see every service you can book online in Book a visit.',
            ['orthodontics', 'braces', 'oral surgery', 'x ray', 'xray', 'radiograph', 'kinds of dental care', 'anong klase'], 'Clinic interview Q1 · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
        ['busy-times', 'hours', 'When is the clinic less busy?',
            'Wednesdays and Thursdays are usually less busy. Saturdays can fill up fast, so book early.',
            ['busy', 'matao', 'peak', 'crowded', 'less busy', 'pila', 'waiting', 'best time', 'konti tao'], 'Clinic interview R2-18 (Sunday is closed) · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
        ['hmo', 'hmo', 'Do you accept HMO?',
            'Yes, we accept some HMOs. Please message the front desk with your HMO provider before your visit; coverage is checked at the clinic.',
            ['hmo', 'insurance', 'maxicare', 'intellicare', 'medicard', 'philcare', 'health card', 'healthcard'], 'Clinic interview Q22 and R2-16 (HMO names are not listed until the clinic verifies the list) · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
        ['care-home', 'care', 'How should I take care of my teeth at home?',
            'I can\'t give treatment advice here. Please book a check-up or message the front desk, and your dentist will advise you.',
            ['brush', 'toothbrush', 'floss', 'toothpaste', 'alaga', 'tips', 'take care', 'hygiene', 'linisin'], 'No health advice from the assistant · Needs dentist-approved wording (R2-11); no treatment advice until then · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
        ['care-sensitive', 'care', 'My teeth feel sensitive. What should I do?',
            'I can\'t give treatment advice here. Please book a check-up or message the front desk, and your dentist will advise you.',
            ['sensitive', 'ngilo', 'nangingilo', 'sensitivity'], 'No health advice from the assistant · Needs dentist-approved wording (R2-11); no treatment advice until then · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
        ['care-breath', 'care', 'What can I do about bad breath?',
            'I can\'t give treatment advice here. Please book a check-up or message the front desk, and your dentist will advise you.',
            ['bad breath', 'hininga', 'mabaho', 'halitosis'], 'No health advice from the assistant · Needs dentist-approved wording (R2-11); no treatment advice until then · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
        ['booking-no-payment', 'booking', 'Do I pay when I book online?',
            'You don\'t pay when you book. After your visit you\'ll get an invoice, which you can pay online in Billing or at the clinic.',
            ['pay when i book', 'bayad sa booking', 'downpayment', 'down payment', 'reservation fee', 'deposit'], 'Patient portal behaviour (decision 4) · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
        ['messages-reply', 'contact', 'Can I message the clinic here?',
            'Yes. Open Messages and write to the front desk of your branch. A staff member replies here, and if you are away when they answer, you get a short email alert.',
            ['message the clinic', 'chat', 'messenger', 'facebook', 'reply', 'sagot', 'mag message'], 'Patient portal behaviour (M17 messaging); PI-42 and PI-43 · Confirmed by clinic staff 2026-10-19 (interview R2), Owner sign-off pending'],
    ];

    public function run(): void
    {
        if ($refusal = ClinicDatabaseGuard::refusal('AssistantAnswerSeeder')) {
            $this->command?->error($refusal);

            return;
        }
        $added = 0;
        foreach (self::ENTRIES as [$key, $category, $question, $answer, $keywords, $source]) {
            $entry = AssistantAnswer::firstOrCreate(['seed_key' => $key], [
                'category' => $category, 'question' => $question, 'answer' => $answer, 'keywords' => $keywords,
                'source' => $source, 'active' => true, 'draft' => true,
            ]);
            if ($entry->wasRecentlyCreated) $added++;
        }
        $this->command?->info("Assistant answers: {$added} draft answer(s) added; existing answers unchanged.");
    }
}
