<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * M17/M18 offline alert: tells a Patient that the clinic wrote to them in the portal. It NEVER contains the message, the sender, the
 * branch or any clinical detail — only that a message is waiting and how to sign in.
 */
class MessageAlertMail extends Mailable
{
    use Queueable;

    public function __construct(public ?string $firstName = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'You have a new message from '.\App\Support\Brand::name());
    }

    public function content(): Content
    {
        $clinic = \App\Support\Brand::name();

        return new Content(view: 'emails.message-alert', text: 'emails.message-alert-text', with: [
            'subjectLine' => $this->envelope()->subject, 'clinic' => $clinic, 'name' => $this->firstName ?: 'there',
            'link' => rtrim((string) config('app.frontend_url'), '/').'/#sign-in',
        ]);
    }
}
