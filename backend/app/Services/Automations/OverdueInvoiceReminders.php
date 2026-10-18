<?php

namespace App\Services\Automations;

use App\Models\Invoice;
use App\Services\Notifications\NotificationCenter;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;

/**
 * A3 (M11/M23). An issued invoice with a balance gets a reminder `days` after it was issued (Asia/Manila calendar days), at
 * most once per step and at most three steps. It is sent only while the invoice's branch is open (so a reminder that falls
 * on a Sunday or after closing waits for the next opening). If the scheduler missed a step, only the latest due step is sent
 * and the earlier one is recorded as skipped. The outbox re-checks the invoice before sending, so a paid invoice is never
 * reminded. The email shows the invoice number, the balance and the Pay online link; never the treatment lines.
 */
final class OverdueInvoiceReminders implements AutomationJob
{
    public const PURPOSE = 'invoice_overdue';

    public static function key(Invoice $invoice, int $days): string
    {
        return self::PURPOSE.":{$invoice->public_id}:d$days";
    }

    public function run(CarbonImmutable $now, array $settings, array $options = []): array
    {
        $days = $settings['days'];
        $counts = ['sent' => 0, 'skipped' => 0];
        $today = ClinicClock::local($now)->toDateString();
        $query = Invoice::query()->where('status', 'Issued')->whereNotNull('issued_at')
            ->where('issued_at', '<=', $now->subDays(min($days) - 1)->toIso8601String())
            ->with(['patient.user', 'patient.person', 'branch']);
        if (! empty($options['invoice_id'])) $query->whereKey($options['invoice_id']);

        foreach ($query->get() as $invoice) {
            if ((float) $invoice->balance() <= 0 || ! $invoice->branch) continue;
            $hours = $invoice->branch->hoursOnDate($today);
            $open = $hours && $now->greaterThanOrEqualTo(ClinicClock::at($today, $hours['open'])) && $now->lessThan(ClinicClock::at($today, $hours['close']));
            if (! $open) continue; // wait for the branch's next opening
            $issued = ClinicClock::local($invoice->issued_at)->toDateString();
            $due = array_values(array_filter($days, fn (int $d) => ClinicClock::addDays($issued, $d) <= $today));
            if (! $due) continue;
            $latest = array_pop($due);
            foreach ($due as $missed) {
                if (! AutomationLog::done(self::key($invoice, $missed)) && AutomationLog::skip('overdue_invoices', self::key($invoice, $missed), 'superseded_by_later_reminder', $invoice, $invoice->branch_id)) $counts['skipped']++;
            }
            $key = self::key($invoice, $latest);
            if (AutomationLog::done($key)) continue;
            [$user, $reason] = Recipient::patient($invoice->patient);
            if ($user) app(NotificationCenter::class)->invoiceOverdue($invoice, $key);
            if ($reason) {
                if (AutomationLog::skip('overdue_invoices', $key, $reason, $invoice, $invoice->branch_id)) $counts['skipped']++;
                continue;
            }
            if (AutomationLog::queueEmail('overdue_invoices', $key, self::PURPOSE, $invoice, $latest, $user, $invoice->branch_id)) $counts['sent']++;
        }

        return $counts;
    }
}
