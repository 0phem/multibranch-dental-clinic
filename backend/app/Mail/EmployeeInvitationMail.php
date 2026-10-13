<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** M1 employee invitation. Carries a single-use set-password link; never a password. */
class EmployeeInvitationMail extends Mailable
{
    use Queueable;

    public function __construct(public User $invitee, public string $link, public int $expireHours) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your invitation to '.(config('mail.from.name') ?: config('app.name')));
    }

    public function content(): Content
    {
        return new Content(view: 'emails.employee-invitation', text: 'emails.employee-invitation-text', with: [
            'subjectLine' => $this->envelope()->subject, 'clinic' => config('mail.from.name') ?: config('app.name'),
            'name' => $this->invitee->person?->first_name ?: 'there',
            'role' => $this->invitee->role->value === 'dentist' ? 'Dentist' : 'Staff',
        ]);
    }
}
