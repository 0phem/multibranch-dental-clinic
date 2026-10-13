<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ClinicTestMail extends Mailable
{
    use Queueable;

    public function __construct()
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'SMTP Diagnostic Test - '.\App\Support\Brand::name()
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.test-mail',
            text: 'emails.test-mail-text'
        );
    }
}
