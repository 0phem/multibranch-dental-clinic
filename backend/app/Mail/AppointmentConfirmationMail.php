<?php

namespace App\Mail;

use App\Models\Appointment;
use App\Support\Ics;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Appointment $appointment)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Appointment Confirmed - ' . ($this->appointment->appointment_code ?? \App\Support\Brand::name())
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.appointment-confirmation',
            text: 'emails.appointment-confirmation-text',
            with: [
                'appointment' => $this->appointment,
            ]
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => Ics::appointment($this->appointment), 'appointment.ics')
                ->withMime('text/calendar'),
        ];
    }
}
