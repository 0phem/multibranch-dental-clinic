<?php

namespace App\Mail;

use App\Models\Appointment;
use App\Support\Brand;
use App\Support\ClinicClock;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** F5: the branch will be closed on the day of this visit. The appointment was NOT cancelled; the patient chooses a new time. */
class ClosureNoticeMail extends AutomationMail
{
    public function __construct(public Appointment $appointment, public ?string $reason = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->w()['subject']);
    }

    private function w(): array
    {
        $a = $this->appointment;
        $start = ClinicClock::local($a->starts_at);

        return $this->wording('closure_notice', ['first_name' => $a->patient?->person?->first_name ?: 'there', 'branch' => $a->branch?->name ?? 'The branch',
            'date' => $start->format('l, F j'), 'time' => $start->format('g:i A')]);
    }

    public function content(): Content
    {
        $a = $this->appointment;

        return new Content(view: 'emails.closure-notice', text: 'emails.closure-notice-text', with: [
            'appointment' => $a, 'start' => ClinicClock::local($a->starts_at), 'test' => $this->test, 'subjectLine' => $this->envelope()->subject,
            'paragraphs' => $this->w()['paragraphs'], 'firstName' => $a->patient?->person?->first_name ?: 'there', 'reason' => $this->reason,
            'phone' => $a->branch?->phone, 'rescheduleUrl' => Brand::appointmentUrl((string) $a->public_id),
        ]);
    }
}
