<?php

namespace App\Mail;

use App\Models\EmailVerificationOtp;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * M1 one-time code email (registration, password reset, email change). Holds only scalars, so the queued (encrypted)
 * payload carries no model. The code never appears in the subject line, so it is not shown on lock screens.
 */
class OneTimeCodeMail extends Mailable
{
    use Queueable;

    public function __construct(public string $code, public string $purpose, public ?string $firstName = null) {}

    private function copy(): array
    {
        $clinic = config('mail.from.name') ?: config('app.name');

        return match ($this->purpose) {
            EmailVerificationOtp::PASSWORD_RESET => [
                'subject' => "Reset your password - $clinic", 'heading' => 'Reset your password',
                'intro' => 'We received a request to reset the password for your account. Enter this code on the password reset page.',
                'ignore' => 'If you did not ask to reset your password, you can ignore this email. Your password stays the same.',
                'reason' => 'You received this because a password reset was requested for the account that uses this email address.',
            ],
            EmailVerificationOtp::EMAIL_CHANGE => [
                'subject' => "Confirm your new email - $clinic", 'heading' => 'Confirm your new email',
                'intro' => "Enter this code to make this address the sign-in email for your $clinic account.",
                'ignore' => 'If you did not ask for this, you can ignore this email. The account keeps its current email address.',
                'reason' => 'You received this because someone asked to move a clinic account to this email address.',
            ],
            default => [
                'subject' => "Your verification code - $clinic", 'heading' => 'Confirm your email',
                'intro' => 'Use this code to finish creating your patient account.',
                'ignore' => 'If you did not create an account, you can ignore this email. No account is activated without this code.',
                'reason' => "You received this because this email address was used to create a patient account at $clinic.",
            ],
        };
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->copy()['subject']);
    }

    public function content(): Content
    {
        $copy = $this->copy();

        return new Content(view: 'emails.one-time-code', text: 'emails.one-time-code-text', with: [
            'subjectLine' => $copy['subject'], 'heading' => $copy['heading'], 'intro' => $copy['intro'], 'ignore' => $copy['ignore'],
            'reason' => $copy['reason'], 'name' => $this->firstName ?: 'there', 'minutes' => (int) config('clinic.otp_ttl_minutes', 10),
            'preheader' => 'Your code expires in '.(int) config('clinic.otp_ttl_minutes', 10).' minutes.',
        ]);
    }
}
