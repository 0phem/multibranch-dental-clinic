<?php

namespace App\Mail;

use App\Support\Brand;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** An adult dependent (or a patient registered at the counter) is invited to claim their own online account with an email code. */
class AccountClaimInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ?string $firstName, public ?string $token = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Create your own patient account - '.Brand::name());
    }

    public function content(): Content
    {
        return new Content(view: 'emails.account-claim-invite', text: 'emails.account-claim-invite-text', with: [
            'firstName' => $this->firstName ?: 'there', 'claimUrl' => rtrim((string) config('app.frontend_url'), '/').'/#claim-account'.($this->token ? '/'.$this->token : ''), 'subjectLine' => $this->envelope()->subject]);
    }
}
