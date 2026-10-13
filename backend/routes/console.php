<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// M5 cutover pre-flight (decision Q-T8): exits non-zero while any Visit is In Treatment without a server Treatment.
Artisan::command('treatments:cutover-check', function () {
    $blockers = \App\Services\Treatments\TreatmentCutover::blockers();
    if ($blockers) {
        $this->error(\App\Services\Treatments\TreatmentCutover::describe($blockers));

        return 1;
    }
    $this->info('M5 Treatment cutover check passed: no Visit is In Treatment without a server Treatment.');

    return 0;
})->purpose('Verify no Visit is In Treatment without a server Treatment before the M5 cutover');

// M18: send queued emails whose first try or retry time has come, and retake claims left by a crashed worker. Safe to run
// alongside queue workers (every send is claimed atomically). Scheduled every minute; run `php artisan schedule:work` (or a
// cron entry for `schedule:run`) next to `php artisan queue:work --queue=mail,default`.
Artisan::command('mail:process-due {--limit=50}', function () {
    $results = app(\App\Services\Mail\MailOutbox::class)->processDue((int) $this->option('limit'));
    $this->info('Processed '.count(array_filter($results)).' of '.count($results).' due email(s).');

    return 0;
})->purpose('Send due M18 emails and retry failed ones within their limit');

\Illuminate\Support\Facades\Schedule::command('mail:process-due')->everyMinute()->withoutOverlapping();

// M18: send one diagnostic email through the real configured transport and print the recorded outcome. Used by the
// pre-defense checklist. "accepted by the mail service" means the SMTP server accepted it; only the inbox proves delivery.
Artisan::command('mail:send-test {email}', function (string $email) {
    $result = app(\App\Services\Mail\MailDispatcher::class)->send($email, new \App\Mail\ClinicTestMail(), 'mail_diagnostic');
    $dispatch = \App\Models\MailDispatch::where('purpose', 'mail_diagnostic')->latest('id')->first();
    $this->line("mailer={$result['mailer']} transport={$result['transport_kind']} status={$result['status']} dispatch={$dispatch?->public_id}");
    $this->line($result['message']);

    return $result['status'] === 'failed' ? 1 : 0;
})->purpose('Send one diagnostic email and print the recorded M18 outcome');
