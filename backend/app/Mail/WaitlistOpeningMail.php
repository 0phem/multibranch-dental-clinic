<?php

namespace App\Mail;

use App\Models\WaitlistEntry;
use App\Support\Brand;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A5: a time opened on the day the patient waited for. First come, first served; nothing is held. */
class WaitlistOpeningMail extends AutomationMail
{
    public function __construct(public WaitlistEntry $entry) {}

    private function day(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', $this->entry->dateString(), ClinicClock::TIMEZONE);
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine('A time opened on '.$this->day()->format('M j').' - '.Brand::name()));
    }

    public function content(): Content
    {
        $e = $this->entry;

        return new Content(view: 'emails.waitlist-opening', text: 'emails.waitlist-opening-text', with: [
            'entry' => $e, 'branch' => $e->branch, 'day' => $this->day(), 'test' => $this->test, 'subjectLine' => $this->envelope()->subject,
            'firstName' => $e->patient?->person?->first_name ?: 'there', 'bookUrl' => Brand::pageUrl('book'),
            'dentist' => $e->dentist?->person ? 'Dr. '.$e->dentist->person->first_name.' '.$e->dentist->person->last_name : null,
        ]);
    }
}
