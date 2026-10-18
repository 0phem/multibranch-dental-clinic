<?php

namespace App\Services\Automations;

use App\Models\AutomationSetting;
use App\Models\Service;
use App\Support\ClinicClock;
use Illuminate\Validation\ValidationException;

/**
 * The six scheduled automations (Administration → Automations). Fixed jobs, not a rule engine: each has a name, the module it
 * serves, the defaults it ships with and the settings the Owner may change. No default is a clinic policy — the Owner page shows
 * every value as "default, not confirmed by the clinic" until the Owner saves one.
 */
final class AutomationCatalog
{
    public const KEYS = ['appointment_reminders', 'no_show', 'overdue_invoices', 'recall', 'waitlist', 'owner_summary'];

    public const JOBS = [
        'appointment_reminders' => AppointmentReminders::class,
        'no_show' => NoShowDetection::class,
        'overdue_invoices' => OverdueInvoiceReminders::class,
        'recall' => RecallReminders::class,
        'waitlist' => WaitlistOpenings::class,
        'owner_summary' => OwnerDailySummary::class,
    ];

    /** key => [name, module, what it does, default on/off, default settings] — the same defaults the migration inserts. */
    public static function definitions(): array
    {
        return [
            'appointment_reminders' => ['Appointment reminders', 'M6 / M18', 'Emails the patient before the visit with the date, time, branch, address, phone, a link to reschedule or cancel, and a calendar file. Not sent for appointments booked within the lead time (the confirmation email covers them).',
                true, ['hours_before' => 24, 'morning_of' => false, 'morning_time' => '08:00']],
            'no_show' => ['No-show detection', 'M6 / M8', 'Flags a booked appointment with no check-in after the grace period as a possible no-show for the front desk, who confirm or undo it. The system never marks a no-show by itself.',
                true, ['grace_minutes' => 30, 'rebook_email' => false]],
            'overdue_invoices' => ['Overdue invoice reminders', 'M11 / M23', 'Reminds the patient of an issued, unpaid invoice with its number, balance and the Pay online link, while the branch is open. Stops as soon as the invoice is paid. No itemized treatments.',
                true, ['days' => [3, 7, 14]]],
            'recall' => ['Recall reminders', 'M20 / M18', 'Sends one "time for your check-up" email per completed visit when the interval for that service category has passed and the patient has no upcoming appointment. Ships off with no rules: the clinic has not given any.',
                false, ['rules' => []]],
            'waitlist' => ['Waitlist for full days', 'M6', 'Patients can ask to be told when a time opens on a fully booked day. When a time opens (for example after a cancellation), the earliest waiting patients get an email and an in-app notice. No time is held.',
                true, ['notify_count' => 3]],
            'owner_summary' => ['Owner daily summary', 'M21 / M18', 'Emails each Owner the day\'s numbers per branch: bookings, completed visits, cancellations, possible no-shows, payments, invoices and new patient accounts. Numbers only: no patient names, messages or clinical data.',
                true, ['send_time' => '20:30']],
        ];
    }

    public static function setting(string $key): ?AutomationSetting
    {
        return AutomationSetting::find($key);
    }

    /** @return string[] service categories that recall rules may name (the live list, not a fixed one). */
    public static function categories(): array
    {
        return Service::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category')->all();
    }

    /**
     * Validates and normalizes one automation's settings. Unknown keys are refused, so a typo can never be stored silently.
     *
     * @throws ValidationException
     */
    public static function validate(string $key, mixed $settings): array
    {
        $fail = fn (string $field, string $message) => throw ValidationException::withMessages(["settings.$field" => [$message]]);
        if (! is_array($settings) || array_is_list($settings) && $settings !== []) $fail('settings', 'Settings must be an object.');
        $allowed = array_keys(self::definitions()[$key][4]);
        foreach (array_keys($settings) as $field) if (! in_array($field, $allowed, true)) $fail((string) $field, 'This setting does not exist.');
        $current = self::setting($key)?->settings ?? self::definitions()[$key][4];
        $s = array_merge($current, $settings);
        $int = function (string $field, int $min, int $max) use ($s, $fail): int {
            $v = $s[$field];
            if (! is_int($v) && ! (is_string($v) && ctype_digit($v))) $fail($field, 'Enter a whole number.');
            $v = (int) $v;
            if ($v < $min || $v > $max) $fail($field, "Enter a number from $min to $max.");

            return $v;
        };
        $bool = function (string $field) use ($s, $fail): bool {
            if (! is_bool($s[$field])) $fail($field, 'Choose on or off.');

            return $s[$field];
        };
        $time = function (string $field) use ($s, $fail): string {
            if (! ClinicClock::validTime($s[$field])) $fail($field, 'Enter a time as HH:MM (24-hour).');

            return $s[$field];
        };

        return match ($key) {
            'appointment_reminders' => ['hours_before' => $int('hours_before', 1, 72), 'morning_of' => $bool('morning_of'), 'morning_time' => $time('morning_time')],
            'no_show' => ['grace_minutes' => $int('grace_minutes', 5, 240), 'rebook_email' => $bool('rebook_email')],
            'overdue_invoices' => (function () use ($s, $fail) {
                $days = $s['days'];
                if (! is_array($days) || ! array_is_list($days) || count($days) < 1 || count($days) > 3) $fail('days', 'Choose one to three reminder days.');
                foreach ($days as $d) if (! is_int($d) || $d < 1 || $d > 60) $fail('days', 'Each reminder day must be a whole number from 1 to 60.');
                $sorted = array_values(array_unique($days));
                sort($sorted);
                if (count($sorted) !== count($days)) $fail('days', 'Each reminder day must be different.');

                return ['days' => $sorted];
            })(),
            'recall' => (function () use ($s, $fail) {
                $rules = $s['rules'];
                if (! is_array($rules) || ! array_is_list($rules) || count($rules) > 20) $fail('rules', 'Add at most 20 recall rules.');
                $categories = self::categories();
                $out = [];
                foreach ($rules as $i => $rule) {
                    if (! is_array($rule) || ! isset($rule['category'], $rule['months'])) $fail("rules.$i", 'Each rule needs a service category and a number of months.');
                    if (! in_array($rule['category'], $categories, true)) $fail("rules.$i.category", 'Choose a service category that exists.');
                    if (! is_int($rule['months']) || $rule['months'] < 1 || $rule['months'] > 36) $fail("rules.$i.months", 'Enter a number of months from 1 to 36.');
                    if (isset($out[$rule['category']])) $fail("rules.$i.category", 'Each service category can have only one rule.');
                    $out[$rule['category']] = ['category' => $rule['category'], 'months' => $rule['months']];
                }

                return ['rules' => array_values($out)];
            })(),
            'waitlist' => ['notify_count' => $int('notify_count', 1, 10)],
            'owner_summary' => ['send_time' => $time('send_time')],
        };
    }
}
