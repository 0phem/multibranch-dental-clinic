<?php

namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** M18 / PI-29 ("appointment was booked or changed"): the Patient is told when their appointment is rescheduled or cancelled. */
class AppointmentChangedMail extends Mailable
{
    use Queueable;

    /** @param 'rescheduled'|'cancelled' $change */
    public function __construct(public Appointment $appointment, public string $change) {}

    public function envelope(): Envelope
    {
        $what = $this->change === 'cancelled' ? 'Appointment Cancelled' : 'Appointment Rescheduled';

        return new Envelope(subject: $what.' - '.($this->appointment->appointment_code ?? 'Dr. Dana E. Roxas Dental Clinic'));
    }

    public function content(): Content
    {
        return new Content(view: 'emails.appointment-changed', with: ['appointment' => $this->appointment, 'change' => $this->change]);
    }
}
