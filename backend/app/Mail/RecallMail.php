<?php

namespace App\Mail;

use App\Models\Visit;
use App\Support\Brand;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A4: "time for your check-up". No treatment, service or clinical detail. */
class RecallMail extends AutomationMail
{
    public function __construct(public Visit $visit) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine('Time for your check-up - '.Brand::name()));
    }

    public function content(): Content
    {
        return new Content(view: 'emails.recall', text: 'emails.recall-text', with: [
            'branch' => $this->visit->branch, 'test' => $this->test, 'subjectLine' => $this->envelope()->subject,
            'firstName' => $this->visit->patient?->person?->first_name ?: 'there', 'bookUrl' => Brand::pageUrl('book'),
        ]);
    }
}
