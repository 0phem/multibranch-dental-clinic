<?php

namespace App\Services\Automations;

use App\Mail\AppointmentReminderMail;
use App\Mail\AutomationMail;
use App\Mail\ClosureNoticeMail;
use App\Mail\LateCheckMail;
use App\Mail\MoveUpOfferMail;
use App\Mail\InvoiceOverdueMail;
use App\Mail\NoShowRebookMail;
use App\Mail\OwnerDailySummaryMail;
use App\Mail\RecallMail;
use App\Mail\WaitlistOpeningMail;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Service;
use App\Models\SlotOffer;
use App\Models\SlotOpening;
use App\Models\User;
use App\Models\Visit;
use App\Models\WaitlistEntry;
use App\Services\Mail\MailDispatcher;
use App\Support\ClinicClock;

/**
 * "Send a test to myself": each automation's email, built from example records that are never saved (a real branch, the
 * signed-in Owner's first name, a sample reference), sent once to the signed-in Owner only, marked [Test]. The Owner summary
 * test uses today's real numbers (counts only). The send is recorded like every email (purpose `automation_test`).
 */
final class TestEmails
{
    public function send(string $key, User $owner): array
    {
        if (! Recipient::deliverable($owner->email)) {
            return ['status' => 'failed', 'mailer' => null, 'transport_kind' => null, 'message' => 'Your account email cannot receive mail (a reserved example address). Use an Owner account with a real email.'];
        }
        $template = (AutomationCatalog::TEMPLATES[$key] ?? [])[0] ?? null;
        if (! $template) return ['status' => 'failed', 'mailer' => null, 'transport_kind' => null, 'message' => 'This setting sends no email.'];

        return $this->sendTemplate($template, $owner);
    }

    public function sendTemplate(string $template, User $owner): array
    {
        return app(MailDispatcher::class)->send($owner->email, $this->sample($template, $owner)->asTest(), 'automation_test', $owner);
    }

    /** One template's email built from example records that are never saved (also the Owner's wording preview). */
    public function sample(string $template, User $owner): AutomationMail
    {
        $branch = Branch::orderBy('id')->first();
        $patient = (new Patient())->setRelation('person', $owner->person)->setRelation('user', $owner);
        $tomorrow = ClinicClock::addDays(ClinicClock::today(), 1);
        $start = ClinicClock::at($tomorrow, $branch?->hoursOnDate($tomorrow)['open'] ?? '10:00')->addHour();
        $appointment = (new Appointment(['appointment_code' => 'TEST-0001', 'status' => 'Confirmed', 'revision' => 1, 'starts_at' => $start->utc(), 'ends_at' => $start->addMinutes(30)->utc()]))
            ->setRelation('branch', $branch)->setRelation('patient', $patient);
        $appointment->public_id = str_repeat('0', 26);

        return match ($template) {
            'appointment_reminder' => new AppointmentReminderMail($appointment, 'lead'),
            'late_check' => new LateCheckMail($appointment),
            'no_show_rebook' => new NoShowRebookMail($appointment),
            'move_up_offer' => (function () use ($appointment, $start) {
                $later = (clone $appointment)->forceFill(['starts_at' => $start->addHours(3)->utc(), 'ends_at' => $start->addHours(3)->addMinutes(30)->utc()]);
                $offer = (new SlotOffer(['appointment_revision' => 1, 'status' => 'offered']))->setRelation('appointment', $later)
                    ->setRelation('opening', new SlotOpening(['starts_at' => $start->utc(), 'ends_at' => $start->addMinutes(60)->utc(), 'status' => 'open']));
                $offer->public_id = str_repeat('0', 26);

                return new MoveUpOfferMail($offer);
            })(),
            'invoice_overdue' => (function () use ($branch, $patient) {
                $invoice = (new Invoice(['invoice_number' => 'TEST-INVOICE', 'status' => 'Issued', 'patient_responsibility_amount' => '1000.00', 'paid_amount' => '0.00', 'issued_at' => ClinicClock::now()->subDays(3)->utc()]))
                    ->setRelation('branch', $branch)->setRelation('patient', $patient);
                $invoice->public_id = str_repeat('0', 26);

                return new InvoiceOverdueMail($invoice);
            })(),
            'recall_due' => new RecallMail((new Visit())->setRelation('branch', $branch)->setRelation('patient', $patient)),
            'waitlist_opening' => new WaitlistOpeningMail((new WaitlistEntry(['clinic_date' => $tomorrow]))->setRelation('branch', $branch)->setRelation('patient', $patient)
                ->setRelation('service', Service::where('status', 'Active')->orderBy('id')->first())->setRelation('dentist', null)),
            'owner_daily_summary' => new OwnerDailySummaryMail($owner, ClinicClock::today()),
            'closure_notice' => new ClosureNoticeMail($appointment, 'Example reason'),
        };
    }
}
