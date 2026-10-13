<?php

namespace App\Jobs;

use App\Services\Mail\MailOutbox;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * M18: processes one durable mail intent. Retries are NOT left to the queue: MailOutbox records each attempt and schedules
 * the next one itself (bounded by clinic.mail_max_attempts), so a duplicate or replayed job simply finds nothing to claim.
 * Run a worker with `php artisan queue:work --queue=mail,default` (see docs/M18_EMAIL_DISPATCH.md).
 */
class SendMailDispatch implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public function __construct(public int $dispatchId)
    {
        $this->onQueue('mail');
    }

    public function handle(MailOutbox $outbox): void
    {
        $outbox->process($this->dispatchId);
    }
}
