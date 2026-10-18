<?php

namespace App\Mail;

use App\Models\Appointment;
use App\Support\ActionLink;
use App\Support\Brand;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** F2: "Are you on your way?" a few minutes after the start, with "On my way" (one click) and "Reschedule". No health content. */
class LateCheckMail extends AutomationMail
{
    public function __construct(public Appointment $appointment, public int $releaseMinutes = 15) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->w()['subject']);
    }

    private function w(): array
    {
        $a = $this->appointment;
        $start = ClinicClock::local($a->starts_at);

        return $this->wording('late_check', ['first_name' => $a->patient?->person?->first_name ?: 'there', 'branch' => $a->branch?->name ?? 'the clinic',
            'date' => $start->format('M j'), 'time' => $start->format('g:i A')]);
    }

    public function content(): Content
    {
        $a = $this->appointment;
        $start = ClinicClock::local($a->starts_at);
        $until = CarbonImmutable::instance($a->starts_at)->addMinutes($this->releaseMinutes);

        return new Content(view: 'emails.late-check', text: 'emails.late-check-text', with: [
            'appointment' => $a, 'start' => $start, 'test' => $this->test, 'subjectLine' => $this->envelope()->subject, 'paragraphs' => $this->w()['paragraphs'],
            'firstName' => $a->patient?->person?->first_name ?: 'there', 'phone' => $a->branch?->phone, 'releaseAt' => ClinicClock::local($until)->format('g:i A'),
            'onMyWayUrl' => ActionLink::url(ActionLink::make('on_my_way', (string) $a->public_id, (int) $a->revision, $until, 'late')),
            'rescheduleUrl' => Brand::appointmentUrl((string) $a->public_id),
        ]);
    }
}
