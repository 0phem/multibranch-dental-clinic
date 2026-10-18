<?php

namespace App\Mail;

use App\Models\SlotOffer;
use App\Support\ActionLink;
use App\Support\ClinicClock;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** F3: "An earlier time is available". The link asks to confirm, works once, and the first patient to accept gets the time. */
class MoveUpOfferMail extends AutomationMail
{
    public function __construct(public SlotOffer $offer) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->w()['subject']);
    }

    private function w(): array
    {
        $a = $this->offer->appointment;
        $new = ClinicClock::local($this->offer->opening->starts_at);

        return $this->wording('move_up_offer', ['first_name' => $a->patient?->person?->first_name ?: 'there', 'branch' => $a->branch?->name ?? 'the clinic',
            'date' => $new->format('M j'), 'time' => ClinicClock::local($a->starts_at)->format('g:i A'), 'new_time' => $new->format('g:i A')]);
    }

    public function content(): Content
    {
        $a = $this->offer->appointment;
        $new = ClinicClock::local($this->offer->opening->starts_at);

        return new Content(view: 'emails.move-up-offer', text: 'emails.move-up-offer-text', with: [
            'appointment' => $a, 'test' => $this->test, 'subjectLine' => $this->envelope()->subject, 'paragraphs' => $this->w()['paragraphs'],
            'firstName' => $a->patient?->person?->first_name ?: 'there', 'newStart' => $new, 'oldStart' => ClinicClock::local($a->starts_at),
            'acceptUrl' => ActionLink::url(ActionLink::make('move_up', (string) $this->offer->public_id, (int) $this->offer->appointment_revision, $this->offer->opening->starts_at)),
        ]);
    }
}
