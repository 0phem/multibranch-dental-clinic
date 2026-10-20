<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** M19: tells the patient (or guardian) a prescription is ready in the portal. It NEVER contains the medicine, dose or note. */
class PrescriptionReadyMail extends Mailable
{
    use Queueable;

    public function __construct(public ?string $firstName = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'A prescription from your visit is ready - '.\App\Support\Brand::name());
    }

    public function content(): Content
    {
        return new Content(view: 'emails.prescription-ready', text: 'emails.prescription-ready-text', with: [
            'subjectLine' => $this->envelope()->subject, 'name' => $this->firstName ?: 'there', 'link' => rtrim((string) config('app.frontend_url'), '/').'/#p/visits',
        ]);
    }
}
