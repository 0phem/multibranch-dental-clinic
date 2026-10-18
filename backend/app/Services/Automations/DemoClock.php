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

    public function run(?string $appointmentCode, ?string $invoiceNumber, bool $summary, ?string $lateCode = null): array
    {
        if (! DemoMode::active()) throw new \RuntimeException('The demo clock runs only on the demo database.');
        $done = [];
        if ($appointmentCode) {
            $a = Appointment::where('appointment_code', $appointmentCode)->firstOrFail();
            $minutes = (int) (AutomationCatalog::setting('appointment_reminders')?->settings['lead_minutes'] ?? 60);
            $at = CarbonImmutable::instance($a->starts_at)->subMinutes($minutes)->addMinute();
            $done['appointment_reminders'] = ['simulated_now' => ClinicClock::local($at)->toIso8601String()]
                + ($this->runner->run($at, ['appointment_reminders'], ['appointment_id' => $a->id, 'ignore_lead_rule' => true, 'kind' => 'lead'])['appointment_reminders'] ?? []);
        }
        if ($lateCode) {
            // F2: as if the patient were still not checked in just after the release time (a same-day appointment), then offer
            // the freed time to patients booked later that day (F3) at once.
            $a = Appointment::where('appointment_code', $lateCode)->firstOrFail();
            $release = (int) (AutomationCatalog::setting('no_show')?->settings['release_minutes'] ?? 15);
            $at = CarbonImmutable::instance($a->starts_at)->addMinutes($release)->addMinute();
            $done['no_show'] = ['simulated_now' => ClinicClock::local($at)->toIso8601String()] + ($this->runner->run($at, ['no_show'], ['appointment_id' => $a->id])['no_show'] ?? []);
            $done['fill_slots'] = ['simulated_now' => ClinicClock::now()->toIso8601String()] + ($this->runner->run(null, ['fill_slots'])['fill_slots'] ?? []);
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
