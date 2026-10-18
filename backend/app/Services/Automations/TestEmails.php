<?php

namespace App\Services\Automations;

use App\Mail\AppointmentReminderMail;
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
        $branch = Branch::orderBy('id')->first();
        $patient = (new Patient())->setRelation('person', $owner->person)->setRelation('user', $owner);
        $tomorrow = ClinicClock::addDays(ClinicClock::today(), 1);
        $start = ClinicClock::at($tomorrow, $branch?->hoursOnDate($tomorrow)['open'] ?? '10:00')->addHour();
        $appointment = (new Appointment(['appointment_code' => 'TEST-0001', 'status' => 'Confirmed', 'revision' => 1, 'starts_at' => $start->utc(), 'ends_at' => $start->addMinutes(30)->utc()]))
            ->setRelation('branch', $branch)->setRelation('patient', $patient);
        $appointment->public_id = str_repeat('0', 26);
        $mail = match ($key) {
            'appointment_reminders' => new AppointmentReminderMail($appointment, 'lead'),
            'no_show' => new NoShowRebookMail($appointment),
            'overdue_invoices' => (function () use ($branch, $patient) {
                $invoice = (new Invoice(['invoice_number' => 'TEST-INVOICE', 'status' => 'Issued', 'patient_responsibility_amount' => '1000.00', 'paid_amount' => '0.00', 'issued_at' => ClinicClock::now()->subDays(3)->utc()]))
                    ->setRelation('branch', $branch)->setRelation('patient', $patient);
                $invoice->public_id = str_repeat('0', 26);

                return new InvoiceOverdueMail($invoice);
            })(),
            'recall' => new RecallMail((new Visit())->setRelation('branch', $branch)->setRelation('patient', $patient)),
            'waitlist' => new WaitlistOpeningMail((new WaitlistEntry(['clinic_date' => $tomorrow]))->setRelation('branch', $branch)->setRelation('patient', $patient)
                ->setRelation('service', Service::where('status', 'Active')->orderBy('id')->first())->setRelation('dentist', null)),
            'owner_summary' => new OwnerDailySummaryMail($owner, ClinicClock::today()),
        };

        return app(MailDispatcher::class)->send($owner->email, $mail->asTest(), 'automation_test', $owner);
    }
}
