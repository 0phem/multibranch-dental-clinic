<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * M1 account security notices. Holds only scalars (no model) because it is queued with an encrypted payload.
 *   registration_attempt         someone registered with an email that already has a usable account (no account was made)
 *   registration_attempt_record  the email is already on file but has no usable online account (contact the clinic)
 *   password_changed             the password was reset or changed
 *   email_changed                sent to the OLD address after the sign-in email moved to a new one
 */
class SecurityNoticeMail extends Mailable
{
    use Queueable;

    public const KINDS = ['registration_attempt', 'registration_attempt_record', 'password_changed', 'email_changed'];

    public function __construct(public string $kind, public ?string $firstName = null, public ?string $when = null, public ?string $maskedEmail = null)
    {
        if (! in_array($kind, self::KINDS, true)) throw new \InvalidArgumentException("Unknown security notice '$kind'.");
    }

    public static function mask(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');
        return mb_substr($name, 0, 2).str_repeat('•', max(1, mb_strlen($name) - 2)).'@'.$domain;
    }

    private function copy(): array
    {
        $clinic = config('mail.from.name') ?: config('app.name');
        $app = rtrim((string) config('app.frontend_url'), '/');

        return match ($this->kind) {
            'registration_attempt' => [
                'subject' => "Someone tried to register with your email - $clinic", 'heading' => 'Someone tried to register with your email',
                'paragraphs' => [
                    "Someone just tried to create a new patient account at $clinic using this email address. This address already has an account, so no new account was created and nothing on your account changed.",
                    'If it was you, sign in with your existing account. If you forgot your password, choose “Forgot password?” on the sign-in page to reset it.',
                ],
                'action' => ['url' => "$app/#sign-in", 'label' => 'Go to sign in'],
                'warning' => 'If it was not you, you do not need to do anything. Your password has not been shared or changed.',
                'reason' => 'You received this because your email address was entered on the clinic’s registration form.',
            ],
            'registration_attempt_record' => [
                'subject' => "About your registration - $clinic", 'heading' => 'This email is already on file',
                'paragraphs' => [
                    "Someone just tried to create a new patient account at $clinic using this email address. The clinic already has this address on file, so a new online account could not be created with it.",
                    'If it was you, please contact the clinic so staff can help you with your account.',
                ],
                'action' => null,
                'warning' => 'If it was not you, you do not need to do anything. No account was created.',
                'reason' => 'You received this because your email address was entered on the clinic’s registration form.',
            ],
            'password_changed' => [
                'subject' => "Your password was changed - $clinic", 'heading' => 'Your password was changed',
                'paragraphs' => ['The password for your clinic account was just changed. For your safety, every device that was signed in has been signed out.'],
                'action' => null,
                'warning' => 'If you did not do this, reset your password right away from the sign-in page (“Forgot password?”) and tell the clinic.',
                'reason' => 'You received this because the password of the account that uses this email address changed.',
            ],
            'email_changed' => [
                'subject' => "Your sign-in email was changed - $clinic", 'heading' => 'Your sign-in email was changed',
                'paragraphs' => ['The sign-in email for your clinic account was changed to '.($this->maskedEmail ?: 'a new address').'. This address will no longer be used for your account, and every device that was signed in has been signed out.'],
                'action' => null,
                'warning' => 'If you did not do this, contact the clinic immediately so staff can secure your account.',
                'reason' => 'You received this because this was the sign-in email of your clinic account.',
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

        return new Content(view: 'emails.security-notice', text: 'emails.security-notice-text', with: [
            'subjectLine' => $copy['subject'], 'heading' => $copy['heading'], 'paragraphs' => $copy['paragraphs'], 'action' => $copy['action'],
            'warning' => $copy['warning'], 'reason' => $copy['reason'], 'name' => $this->firstName ?: 'there', 'when' => $this->when,
            'preheader' => $copy['paragraphs'][0],
        ]);
    }
}
