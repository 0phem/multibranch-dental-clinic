<?php

namespace App\Services\Assistant;

use App\Support\Brand;

/**
 * The fixed answers for messages IntentGuard screens out (emergency, medical advice, extraction attempts, off-topic), in every
 * mode and with no model call. The emergency answer uses the clinic phone from the clinic settings. Everything else in knowledge
 * mode is answered by KnowledgeAssistant.
 */
final class AssistantFallback
{
    public function __construct(private readonly AssistantTools $tools) {}

    /** @return array{answer:string, outcome:string, actions:list<array>, handoff:bool} */
    public function fixed(string $class): array
    {
        $b = Brand::forEmail();
        $phone = $b['phone'] ?: 'the clinic';
        $desk = ['type' => 'contact_front_desk', 'label' => 'Message the front desk'];

        return match ($class) {
            IntentGuard::EMERGENCY => ['answer' => "This may need urgent care. Please call the clinic now at {$phone}, or go to the nearest emergency room if you cannot reach us or it is getting worse.",
                'outcome' => 'emergency', 'actions' => array_filter([$b['phone'] ? ['type' => 'call_clinic', 'label' => "Call {$phone}", 'phone' => preg_replace('/[^0-9+]/', '', $b['phone'])] : null, $desk]), 'handoff' => true],
            IntentGuard::MEDICAL => ['answer' => 'I can’t give a diagnosis or advice about medicines. A dentist can check it properly: please book a consultation, or message the front desk if you are unsure.',
                'outcome' => 'refused_medical', 'actions' => [['type' => 'open_booking', 'label' => 'Book a consultation', 'service' => 'svc1'], $desk], 'handoff' => true],
            IntentGuard::EXTRACTION => ['answer' => 'I can only help with this clinic, your own appointments and billing, and using the portal.', 'outcome' => 'refused_extraction', 'actions' => [], 'handoff' => false],
            default => ['answer' => 'I can only help with the clinic: our services, booking, your appointments and billing, and general dental care. What would you like to know about those?',
                'outcome' => 'refused_off_topic', 'actions' => [], 'handoff' => false],
        };
    }
}
