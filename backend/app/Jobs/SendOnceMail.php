<?php

namespace App\Jobs;

use App\Models\EmailVerificationOtp;
use App\Models\MailDispatch;
use App\Models\MailDispatchAttempt;
use App\Services\Mail\MailDispatcher;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Mail\Mailable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;

/**
 * M1/M18: sends one message that must go out exactly once and never be retried — a one-time code, or an account security
 * notice. It is queued only after the transaction that created it commits (MailDispatcher::queueOnce).
 *
 * The queued payload is encrypted with the application key (it carries the address and, for codes, the code) and is
 * deleted once handled. There is ONE try: handle() never throws, so the payload is never copied to failed_jobs and no
 * retry can resend a secret. The outcome (transport_accepted / logged_only / failed) is recorded on the mail dispatch row.
 * A code that a newer code replaced, or that was already used, is not sent (superseded); an expired one is not sent (failed).
 */
class SendOnceMail implements ShouldBeEncrypted, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public function __construct(public int $dispatchId, public string $to, public Mailable $mail, public ?int $otpId = null)
    {
        $this->onQueue('mail');
        $this->afterCommit();
    }

    public function handle(MailDispatcher $dispatcher): void
    {
        try {
            $now = now()->toIso8601String();
            $claimed = DB::table('mail_dispatches')->where('id', $this->dispatchId)->where('retryable', false)->where('status', 'pending')
                ->update(['status' => 'processing', 'locked_at' => $now, 'updated_at' => $now]);
            if ($claimed !== 1) return; // a duplicate job: the message was already handled
            $dispatch = MailDispatch::findOrFail($this->dispatchId);
            $started = now();

            $otp = $this->otpId ? EmailVerificationOtp::find($this->otpId) : null;
            if ($this->otpId && (! $otp || $otp->consumed_at || $otp->expires_at->isPast())) {
                $superseded = $otp && $otp->consumed_at;
                MailDispatchAttempt::create(['mail_dispatch_id' => $dispatch->id, 'attempt_no' => 1, 'outcome' => 'skipped', 'started_at' => $started, 'finished_at' => now()]);
                $dispatch->forceFill(['attempts' => 1, 'status' => $superseded ? 'superseded' : 'failed', 'failure_reason' => $superseded ? null : 'code_expired',
                    'locked_at' => null, 'completed_at' => now()])->save();

                return;
            }
            $result = $dispatcher->attempt($this->to, $this->mail, $dispatch->purpose);
            $dispatcher->record($dispatch, $result, $started, null, $dispatch->recipient, final: true, reason: 'not_retryable');
        } catch (\Throwable $e) {
            // Never rethrow: a failed job would copy this (encrypted) payload into failed_jobs and could be retried by hand.
            \Illuminate\Support\Facades\Log::warning('One-time mail job failed.', ['exception' => $e::class]);
        }
    }
}
