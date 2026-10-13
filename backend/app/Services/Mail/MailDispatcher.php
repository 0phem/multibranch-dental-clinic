<?php

namespace App\Services\Mail;

use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Contracts\Mail\Mailable;
use Illuminate\Support\Facades\Mail;

/**
 * M18 email dispatch foundation. Sends one message through the configured mailer and reports ONLY what this process can
 * know: whether a real outbound transport accepted it, whether it was merely written to a local log/array, or whether it
 * failed. It never claims recipient (inbox) delivery — no provider delivery receipt exists in this application yet.
 *
 * Outcomes:
 *   transport_accepted  a real transport (smtp/ses/postmark/resend/sendmail…) accepted the message without error;
 *                       inbox delivery is NOT confirmed.
 *   logged_only         the mailer is log/array: the message was recorded locally and NOT sent to anyone.
 *   failed              the transport raised an error; nothing is known to have been sent.
 *
 * Messages are sent synchronously (no queue worker runs yet — TD-24). Audit evidence records purpose, outcome and
 * transport name only: never the address, subject, link, token or body.
 */
class MailDispatcher
{
    public const REAL_TRANSPORTS = ['smtp', 'sendmail', 'ses', 'ses-v2', 'postmark', 'resend', 'mailgun'];
    public const LOCAL_TRANSPORTS = ['log', 'array'];

    public function __construct(private readonly AuditService $audit) {}

    /** The effective transport class of the default mailer: 'real', 'local' or 'unknown'. Failover/roundrobin are real only if every child is. */
    public function transportKind(?string $mailer = null, array $seen = []): string
    {
        $mailer ??= (string) config('mail.default');
        if ($mailer === '' || in_array($mailer, $seen, true)) return 'unknown';
        $transport = (string) (config("mail.mailers.$mailer.transport") ?? '');
        if (in_array($transport, ['failover', 'roundrobin'], true)) {
            $kinds = array_map(fn ($child) => $this->transportKind($child, [...$seen, $mailer]), config("mail.mailers.$mailer.mailers", []));
            if (! $kinds) return 'unknown';
            return count(array_unique($kinds)) === 1 ? $kinds[0] : 'unknown';
        }
        if (in_array($transport, self::REAL_TRANSPORTS, true)) return 'real';
        if (in_array($transport, self::LOCAL_TRANSPORTS, true)) return 'local';
        return 'unknown';
    }

    /**
     * @return array{status:string, mailer:string, transport_kind:string, message:string}
     */
    public function send(string $to, Mailable $mail, string $purpose, ?User $actor = null, mixed $target = null): array
    {
        $mailer = (string) config('mail.default');
        $kind = $this->transportKind();
        try {
            Mail::to($to)->send($mail);
            $status = $kind === 'real' ? 'transport_accepted' : ($kind === 'local' ? 'logged_only' : 'transport_accepted');
        } catch (\Throwable $e) {
            // Transport exceptions can contain message content (for example a one-time code) or SMTP credentials, so only
            // the exception class is logged.
            \Illuminate\Support\Facades\Log::warning('Mail dispatch failed.', ['purpose' => $purpose, 'exception' => $e::class]);
            $status = 'failed';
        }
        $result = ['status' => $status, 'mailer' => $mailer, 'transport_kind' => $kind, 'message' => self::describe($status, $kind)];
        try {
            $payload = ['purpose' => $purpose, 'status' => $status, 'mailer' => $mailer, 'transport_kind' => $kind];
            $actor
                ? $this->audit->recordAdministrative('mail.dispatched', $actor, $target, $payload)
                : $this->audit->record(['action' => 'mail.dispatched', 'category' => 'administrative', 'severity' => $status === 'failed' ? 'warning' : 'info', 'actor' => null, 'target' => $target, 'payload' => $payload]);
        } catch (\Throwable $e) {
            report($e); // evidence failure is reported, never hidden, and never changes the send result
        }

        return $result;
    }

    public static function describe(string $status, string $kind): string
    {
        return match ($status) {
            'logged_only' => 'Recorded in the local mail log only. No email was sent to the recipient (the mail transport is not configured for delivery).',
            'transport_accepted' => $kind === 'real'
                ? 'Accepted by the mail transport. Delivery to the recipient’s inbox is not confirmed.'
                : 'Handed to the configured mailer. Whether it reached the recipient is not known.',
            default => 'Sending failed. No email is known to have been sent.',
        };
    }
}
