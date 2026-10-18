<?php

namespace App\Mail;

use App\Models\Appointment;
use App\Support\Brand;
use App\Support\ClinicClock;
use App\Support\Ics;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A1 reminder: when and where, how to reschedule or cancel, and a calendar file. No service, Dentist, prices or health advice. */
class AppointmentReminderMail extends AutomationMail
{
    public function __construct(public Appointment $appointment, public string $kind = 'lead') {}

    public function envelope(): Envelope
    {
        $start = ClinicClock::local($this->appointment->starts_at);

        return new Envelope(subject: $this->subjectLine('Reminder: your visit on '.$start->format('M j').' at '.$start->format('g:i A').' - '.Brand::name()));
    }

    public function content(): Content
    {
        $a = $this->appointment;
        $start = ClinicClock::local($a->starts_at);
        $today = ClinicClock::today();
        $when = $start->toDateString() === $today ? 'today' : ($start->toDateString() === ClinicClock::addDays($today, 1) ? 'tomorrow' : 'on '.$start->format('l, F j'));
        $hours = $a->branch?->hoursOnDate($start->toDateString());

        return new Content(view: 'emails.appointment-reminder', text: 'emails.appointment-reminder-text', with: [
            'appointment' => $a, 'start' => $start, 'when' => $when, 'test' => $this->test, 'subjectLine' => $this->envelope()->subject,
            'firstName' => $a->patient?->person?->first_name ?: 'there',
            'hours' => $hours && ClinicClock::validTime($hours['open']) && ClinicClock::validTime($hours['close']) ? \App\Support\BranchHours::time($hours['open']).' to '.\App\Support\BranchHours::time($hours['close']) : null,
            'phone' => $a->branch?->phone, 'manageUrl' => Brand::appointmentUrl((string) $a->public_id),
        ]);
    }

    public function attachments(): array
    {
        return [Attachment::fromData(fn () => Ics::appointment($this->appointment), 'appointment.ics')->withMime('text/calendar')];
    }
}
