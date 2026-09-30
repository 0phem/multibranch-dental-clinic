<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class PatientEmailVerificationOtp extends Mailable
{
    use Queueable;

    public function __construct(public string $code)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Verify your Dr. Dana E. Roxas Dental Clinic account');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.patient-email-verification-otp');
    }
}
