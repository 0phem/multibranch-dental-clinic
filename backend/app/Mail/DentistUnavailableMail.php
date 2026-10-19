<?php

namespace App\Mail;

use App\Models\Appointment;
use App\Support\Brand;
use App\Support\ClinicClock;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** M3/M15: the dentist is no longer available at this visit's time (schedule change or leave). NOT cancelled; the patient rebooks. */
class DentistUnavailableMail extends AutomationMail
{
    public function __construct(public Appointment $appointment) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->w()['subject']);
    }

    private function w(): array
    {
        $a = $this->appointment;
        $start = ClinicClock::local($a->starts_at);

        return $this->wording('dentist_unavailable_notice', ['first_name' => $a->patient?->person?->first_name ?: 'there', 'branch' => $a->branch?->name ?? 'The branch',
            'date' => $start->format('l, F j'), 'time' => $start->format('g:i A')]);
    }

    public function content(): Content
    {
        $a = $this->appointment;

        return new Content(view: 'emails.dentist-unavailable', text: 'emails.dentist-unavailable-text', with: [
            'appointment' => $a, 'start' => ClinicClock::local($a->starts_at), 'test' => $this->test, 'subjectLine' => $this->envelope()->subject,
            'paragraphs' => $this->w()['paragraphs'], 'firstName' => $a->patient?->person?->first_name ?: 'there', 'reason' => null,
            'phone' => $a->branch?->phone, 'rescheduleUrl' => Brand::appointmentUrl((string) $a->public_id),
        ]);
    }
}
