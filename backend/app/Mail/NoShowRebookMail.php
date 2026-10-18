<?php

namespace App\Mail;

use App\Models\Appointment;
use App\Support\Brand;
use App\Support\ClinicClock;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A2 (optional): after the front desk confirms a no-show, a friendly invitation to book a new time. */
class NoShowRebookMail extends AutomationMail
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

        return $this->wording('no_show_rebook', ['first_name' => $a->patient?->person?->first_name ?: 'there', 'branch' => $a->branch?->name ?? 'the clinic',
            'date' => $start->format('F j'), 'time' => $start->format('g:i A')]);
    }

    public function content(): Content
    {
        $start = ClinicClock::local($this->appointment->starts_at);

        return new Content(view: 'emails.no-show-rebook', text: 'emails.no-show-rebook-text', with: [
            'appointment' => $this->appointment, 'start' => $start, 'test' => $this->test, 'subjectLine' => $this->envelope()->subject,
            'firstName' => $this->appointment->patient?->person?->first_name ?: 'there', 'bookUrl' => Brand::pageUrl('book'), 'paragraphs' => $this->w()['paragraphs'],
        ]);
    }
}
