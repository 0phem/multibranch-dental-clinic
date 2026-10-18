<?php

namespace App\Services\Automations;

use App\Models\Appointment;
use App\Models\Invoice;
use App\Services\Mail\MailOutbox;
use App\Support\ClinicClock;
use App\Support\DemoMode;
use Carbon\CarbonImmutable;

/**
 * Demo database only: runs ONE automation for one record as if the clock were already at its due time, so a panel can watch a
 * reminder arrive within seconds. It uses the normal job, keys and outbox (a later real run will not send it again); only "now"
 * is simulated. The appointment reminder also ignores the "booked within the lead time" rule, because a demo appointment is
 * booked minutes before. Then the due emails are sent at once.
 */
final class DemoClock
{
    public function __construct(private readonly AutomationRunner $runner, private readonly MailOutbox $outbox) {}

    public function run(?string $appointmentCode, ?string $invoiceNumber, bool $summary): array
    {
        if (! DemoMode::active()) throw new \RuntimeException('The demo clock runs only on the demo database.');
        $done = [];
        if ($appointmentCode) {
            $a = Appointment::where('appointment_code', $appointmentCode)->firstOrFail();
            $hours = (int) (AutomationCatalog::setting('appointment_reminders')?->settings['hours_before'] ?? 24);
            $at = CarbonImmutable::instance($a->starts_at)->subHours($hours)->addMinute();
            $done['appointment_reminders'] = ['simulated_now' => ClinicClock::local($at)->toIso8601String()]
                + ($this->runner->run($at, ['appointment_reminders'], ['appointment_id' => $a->id, 'ignore_lead_rule' => true])['appointment_reminders'] ?? []);
        }
        if ($invoiceNumber) {
            $i = Invoice::where('invoice_number', $invoiceNumber)->with('branch')->firstOrFail();
            $days = AutomationCatalog::setting('overdue_invoices')?->settings['days'] ?? [3, 7, 14];
            $next = collect($days)->first(fn ($d) => ! AutomationLog::done(OverdueInvoiceReminders::key($i, $d))) ?? end($days);
            $date = ClinicClock::addDays(ClinicClock::local($i->issued_at ?? now())->toDateString(), $next);
            for ($n = 0; $n < 7 && ! $i->branch?->hoursOnDate($date); $n++) $date = ClinicClock::addDays($date, 1);
            $hours = $i->branch?->hoursOnDate($date) ?? ['open' => '08:00'];
            $at = ClinicClock::at($date, $hours['open'])->addMinute();
            $done['overdue_invoices'] = ['simulated_now' => $at->toIso8601String(), 'step_days' => $next]
                + ($this->runner->run($at, ['overdue_invoices'], ['invoice_id' => $i->id])['overdue_invoices'] ?? []);
        }
        if ($summary) {
            $time = AutomationCatalog::setting('owner_summary')?->settings['send_time'] ?? '20:30';
            $at = max(CarbonImmutable::now(), ClinicClock::at(ClinicClock::today(), $time)->addMinute());
            $done['owner_summary'] = ['simulated_now' => ClinicClock::local($at)->toIso8601String()] + ($this->runner->run($at, ['owner_summary'])['owner_summary'] ?? []);
        }
        $done['emails_processed'] = count(array_filter($this->outbox->processDue()));

        return $done;
    }
}
