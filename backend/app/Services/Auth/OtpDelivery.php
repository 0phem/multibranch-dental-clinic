<?php

namespace App\Services\Auth;

use App\Mail\PatientEmailVerificationOtp;
use App\Models\User;
use RuntimeException;

class OtpDelivery
{
    public function send(User $user, string $code): void
    {
        if (app()->environment('production') && ! $this->safeMailer(config('mail.default'))) {
            throw new RuntimeException('Verification requires a delivery transport.');
        }
        // M18: one dispatcher reports the real outcome; a failure still raises so registration returns its 503.
        $result = app(\App\Services\Mail\MailDispatcher::class)->send($user->email, new PatientEmailVerificationOtp($code), 'patient_email_verification', null, $user);
        if ($result['status'] === 'failed') throw new RuntimeException('Verification email could not be sent.');
    }

    private function safeMailer(?string $name, array $seen = []): bool
    {
        if (! $name || in_array($name, $seen, true)) return false;
        $config = config("mail.mailers.$name", []);
        if (in_array($config['transport'] ?? '', ['failover', 'roundrobin'], true)) {
            $children = $config['mailers'] ?? [];
            return count($children) > 0 && collect($children)->every(fn ($child) => $this->safeMailer($child, [...$seen, $name]));
        }
        return in_array($config['transport'] ?? '', ['smtp', 'sendmail', 'ses', 'ses-v2', 'postmark', 'resend'], true);
    }
}
