<?php

namespace Database\Seeders;

use App\Models\AssistantAnswer;
use App\Support\ClinicDatabaseGuard;
use Illuminate\Database\Seeder;

/**
 * The Clinic Assistant's first answers, written ONLY from facts already in the repository (the clinic interview, the portal's
 * own behaviour). Every entry is a DRAFT until the clinic confirms it in Administration → Assistant answers. Live facts
 * (services, branches, hours, payment methods, contact) are not copied here: the assistant reads them from the records.
 * Idempotent: an entry is added once (by seed_key) and an Owner's later edit is never overwritten.
 * On the clinic database dental_clinic this is a data change that needs approval: it refuses unless ALLOW_CLINIC_DATABASE=yes.
 */
class AssistantAnswerSeeder extends Seeder
{
    public const ENTRIES = [
        ['about-since', 'about', 'How long has the clinic been operating?',
            'The clinic has been caring for patients since 1981.',
            ['since', 'how long', 'gaano katagal', 'history', 'established', 'kailan nagsimula', 'ilang taon'], 'Clinic interview Q1 and Q3'],
        ['services-kinds', 'services', 'What kinds of dental care do you provide?',
            'The clinic provides general dentistry, orthodontics (braces), oral surgery and dental X-rays (radiographic imaging). You can see every service you can book online in Book a visit.',
            ['orthodontics', 'braces', 'oral surgery', 'x ray', 'xray', 'radiograph', 'kinds of dental care', 'anong klase'], 'Clinic interview Q1'],
        ['busy-times', 'hours', 'When is the clinic less busy?',
            'Weekends are usually busier, especially from October to February. Booking ahead online helps you get the time you want.',
            ['busy', 'matao', 'peak', 'crowded', 'less busy', 'pila', 'waiting', 'best time', 'konti tao'], 'Clinic interview Q10'],
        ['hmo', 'hmo', 'Do you accept HMO?',
            'The clinic handles HMO claims, but approval comes from your HMO company and can take time. Please message the front desk to check whether your HMO card is accepted before your visit.',
            ['hmo', 'insurance', 'maxicare', 'intellicare', 'medicard', 'philcare', 'health card', 'healthcard'], 'Clinic interview Q22'],
        ['care-home', 'care', 'How should I take care of my teeth at home?',
            'General tips: brush twice a day with fluoride toothpaste for about two minutes, clean between your teeth every day (for example with floss), limit sugary food and drinks, and keep regular check-ups. For advice about your own teeth, book a consultation.',
            ['brush', 'toothbrush', 'floss', 'toothpaste', 'alaga', 'tips', 'take care', 'hygiene', 'linisin'], 'General dental-care information, not clinic-specific (for the clinic to confirm)'],
        ['care-sensitive', 'care', 'My teeth feel sensitive. What should I do?',
            'Sensitivity can have different causes, so a dentist should check it. Please book a consultation. If you have severe pain or swelling, call the clinic right away.',
            ['sensitive', 'ngilo', 'nangingilo', 'sensitivity'], 'General dental-care information, not clinic-specific (for the clinic to confirm)'],
        ['care-breath', 'care', 'What can I do about bad breath?',
            'Bad breath has many possible causes. Brushing your teeth and tongue and cleaning between your teeth every day help; a dentist can check the cause at a consultation.',
            ['bad breath', 'hininga', 'mabaho', 'halitosis'], 'General dental-care information, not clinic-specific (for the clinic to confirm)'],
        ['booking-no-payment', 'booking', 'Do I pay when I book online?',
            'No. Nothing is charged when you book. After your visit the clinic issues your invoice, and you can pay online in Billing or at the clinic.',
            ['pay when i book', 'bayad sa booking', 'downpayment', 'down payment', 'reservation fee', 'deposit'], 'Patient portal behaviour (decision 4)'],
        ['messages-reply', 'contact', 'Can I message the clinic here?',
            'Yes. Open Messages and write to the front desk of your branch. A staff member replies here, and if you are away when they answer, you get a short email alert.',
            ['message the clinic', 'chat', 'messenger', 'facebook', 'reply', 'sagot', 'mag message'], 'Patient portal behaviour (M17 messaging); PI-42 and PI-43'],
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
