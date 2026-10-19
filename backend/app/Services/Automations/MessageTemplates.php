<?php

namespace App\Services\Automations;

use App\Models\AutomationSetting;
use App\Models\MessageTemplate;
use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * F1 Owner-approved wording of every automated email (R2-09). The Owner edits a subject and a message with placeholders such as
 * {first_name}; the fixed parts of each email (date, time, branch, buttons, calendar file) are not editable, so a wording change
 * can never remove the facts or the links. Saving new wording clears the approvals and switches off every automation that sends
 * it; approving is a separate step. A health-related template also needs a Dentist's approval (R2-11). Every change is audited.
 */
final class MessageTemplates
{
    /** key => [default subject, default message, needs a Dentist's approval]. Our wording, not the clinic's, until approved. */
    public const DEFAULTS = [
        'appointment_reminder' => ['Reminder: your visit on {date} at {time}',
            "This is a friendly reminder of your dental appointment at {branch}.\n\nPlease tap \u{201C}I\u{2019}ll be there\u{201D} to confirm, or \u{201C}I can\u{2019}t make it\u{201D} so another patient can use the time.", false],
        'late_check' => ['Are you on your way? Your visit was at {time}',
            "Your appointment at {branch} started at {time} and you haven\u{2019}t checked in yet.\n\nIf you\u{2019}re on your way, tap \u{201C}On my way\u{201D} so the front desk knows. If you can\u{2019}t come today, you can choose a new time.", false],
        'no_show_rebook' => ['We missed you today',
            "We didn\u{2019}t see you at your {time} visit at {branch} on {date}, so the time was released for another patient.\n\nWhen you\u{2019}re ready, choose a new time that suits you.", false],
        'move_up_offer' => ['An earlier time is available on {date}',
            "A time opened at {branch} on {date} at {new_time}, earlier than your {time} appointment.\n\nIf you\u{2019}d like it, tap \u{201C}Take the earlier time\u{201D}. The first patient to accept gets it. If you do nothing, your appointment stays as it is.", false],
        'invoice_overdue' => ['Invoice {invoice_number} is still unpaid',
            "Invoice {invoice_number} from {branch} still has a balance of {balance}.\n\nYou can pay online in Billing or at the clinic front desk. Already paid? Thank you, you can ignore this email.", false],
        'recall_due' => ['Time for your check-up',
            "It has been a while since your last visit at {branch}.\n\nBook your next visit at a time that suits you.", true],
        'waitlist_opening' => ['A time opened on {date}',
            "You asked us to tell you when a time opens on this day at {branch}.\n\nTimes go to whoever books first and we can\u{2019}t hold one for you, so book soon if you still want it.", false],
        'owner_daily_summary' => ['Daily summary for {date}',
            "Here are the numbers for {date}, per branch.", false],
        'closure_notice' => ['Your visit on {date}: the branch will be closed',
            "{branch} will be closed on {date}. Your {time} appointment has not been cancelled.\n\nPlease choose a new time with the button below, or contact the branch.", false],
        'dentist_unavailable_notice' => ['Your visit on {date}: please choose a new time',
            "Your dentist is no longer available at {time} on {date} at {branch}. Your appointment has not been cancelled.\n\nPlease choose a new time with the button below, or contact the branch.", false],
        'leave_requested' => ['Leave request from {name}',
            "{name} asked for leave from {from} to {to}.\n\nOpen Leave requests in the clinic system to approve or decline it.", false],
        'leave_decided' => ['Your leave request: {status}',
            "Your leave request from {from} to {to} was {status}.\n\nOpen My leave in the clinic system for the details.", false],
    ];

    /** Placeholders each template may use (a typo is refused instead of being sent as "{fist_name}"). */
    public const PLACEHOLDERS = [
        'appointment_reminder' => ['first_name', 'clinic', 'branch', 'date', 'time'],
        'late_check' => ['first_name', 'clinic', 'branch', 'date', 'time'],
        'no_show_rebook' => ['first_name', 'clinic', 'branch', 'date', 'time'],
        'move_up_offer' => ['first_name', 'clinic', 'branch', 'date', 'time', 'new_time'],
        'invoice_overdue' => ['first_name', 'clinic', 'branch', 'invoice_number', 'balance'],
        'recall_due' => ['first_name', 'clinic', 'branch'],
        'waitlist_opening' => ['first_name', 'clinic', 'branch', 'date'],
        'owner_daily_summary' => ['first_name', 'clinic', 'date'],
        'closure_notice' => ['first_name', 'clinic', 'branch', 'date', 'time'],
        'dentist_unavailable_notice' => ['first_name', 'clinic', 'branch', 'date', 'time'],
        'leave_requested' => ['first_name', 'clinic', 'name', 'from', 'to'],
        'leave_decided' => ['first_name', 'clinic', 'from', 'to', 'status'],
    ];

    public const NAMES = [
        'appointment_reminder' => 'Appointment reminder', 'late_check' => '"Are you on your way?"', 'no_show_rebook' => 'Released: rebook invitation',
        'move_up_offer' => '"An earlier time is available"', 'invoice_overdue' => 'Overdue invoice reminder', 'recall_due' => 'Recall reminder',
        'waitlist_opening' => 'Waitlist: a time opened', 'owner_daily_summary' => 'Owner daily summary', 'closure_notice' => 'Closed date: please reschedule',
        'dentist_unavailable_notice' => 'Dentist unavailable: please reschedule', 'leave_requested' => 'Leave request (to the approver)', 'leave_decided' => 'Leave decision (to the requester)',
    ];

    public static function find(string $key): ?MessageTemplate
    {
        return MessageTemplate::find($key);
    }

    public static function approved(string $key): bool
    {
        return (bool) self::find($key)?->isApproved();
    }

    /** Templates of this automation that still need an approval (empty = it may be switched on). */
    public static function unapprovedFor(string $automation): array
    {
        $keys = AutomationCatalog::TEMPLATES[$automation] ?? [];

        return array_values(array_filter($keys, fn ($k) => ! self::approved($k)));
    }

    /**
     * The wording to send: subject and paragraphs with the placeholders filled in (plain text; the email views escape it).
     * `$draft` (subject, body) renders an unsaved edit for the preview.
     *
     * @return array{subject:string, paragraphs:list<string>}
     */
    public static function render(string $key, array $vars, ?array $draft = null): array
    {
        $t = self::find($key);
        $subject = $draft['subject'] ?? $t?->subject ?? self::DEFAULTS[$key][0];
        $body = $draft['body'] ?? $t?->body ?? self::DEFAULTS[$key][1];
        $vars += ['clinic' => \App\Support\Brand::name()];
        $fill = fn (string $text) => preg_replace_callback('/\{([a-z_]+)\}/', fn ($m) => (string) ($vars[$m[1]] ?? ''), $text);
        $paragraphs = array_values(array_filter(array_map('trim', preg_split('/\n\s*\n/', str_replace("\r", '', $fill($body)))), fn ($p) => $p !== ''));

        return ['subject' => trim(preg_replace('/\s+/', ' ', $fill($subject))), 'paragraphs' => $paragraphs];
    }

    /** @throws ValidationException */
    public static function validate(string $key, array $data): array
    {
        $fail = fn (string $field, string $message) => throw ValidationException::withMessages([$field => [$message]]);
        $subject = trim((string) ($data['subject'] ?? ''));
        $body = trim(str_replace("\r", '', (string) ($data['body'] ?? '')));
        if ($subject === '' || mb_strlen($subject) > 140) $fail('subject', 'Write a subject of up to 140 characters.');
        if ($body === '' || mb_strlen($body) > 1200) $fail('body', 'Write a message of up to 1,200 characters.');
        if (preg_match('/<[^>]+>|https?:\/\//i', $subject.' '.$body)) $fail('body', 'Plain text only: no HTML or links (the email adds its own buttons).');
        foreach (['subject' => $subject, 'body' => $body] as $field => $text) {
            preg_match_all('/\{([^}]*)\}/', $text, $m);
            foreach ($m[1] as $name) {
                if (! in_array($name, self::PLACEHOLDERS[$key], true)) $fail($field, "{{$name}} is not available here. Use: {".implode('}, {', self::PLACEHOLDERS[$key]).'}.');
            }
        }

        return ['subject' => $subject, 'body' => $body];
    }

    /** Owner: save new wording. Clears the approvals and switches off the automations that send this template. */
    public function update(User $owner, string $key, array $data, int $expectedRevision): ?MessageTemplate
    {
        $clean = self::validate($key, $data);

        return DB::transaction(function () use ($owner, $key, $clean, $expectedRevision) {
            $t = MessageTemplate::whereKey($key)->lockForUpdate()->firstOrFail();
            if ($t->revision !== $expectedRevision) return null;
            if ($t->subject === $clean['subject'] && $t->body === $clean['body']) return $t;
            $old = ['subject' => $t->subject, 'body' => $t->body];
            $t->fill($clean + ['approved_at' => null, 'approved_by_user_id' => null, 'dentist_approved_at' => null, 'dentist_approved_by_user_id' => null,
                'updated_by_user_id' => $owner->id, 'revision' => $t->revision + 1])->save();
            $switchedOff = $this->switchOffUsers($key, $owner);
            app(AuditService::class)->recordAdministrative('message_template.updated', $owner, null, ['template' => $key, 'old' => $old, 'new' => $clean, 'switched_off' => $switchedOff]);

            return $t;
        });
    }

    /** Owner approves the current wording (by revision, so an approval never covers text the Owner did not see). */
    public function approve(User $owner, string $key, int $expectedRevision): ?MessageTemplate
    {
        return DB::transaction(function () use ($owner, $key, $expectedRevision) {
            $t = MessageTemplate::whereKey($key)->lockForUpdate()->firstOrFail();
            if ($t->revision !== $expectedRevision) return null;
            if ($t->approved_at) return $t;
            $t->forceFill(['approved_at' => now(), 'approved_by_user_id' => $owner->id])->save();
            app(AuditService::class)->recordAdministrative('message_template.approved', $owner, null, ['template' => $key, 'revision' => $t->revision]);

            return $t;
        });
    }

    /** Dentist approves a health-related template's current wording (and, for recall, the intervals shown with it). */
    public function dentistApprove(User $dentist, string $key, int $expectedRevision): ?MessageTemplate
    {
        return DB::transaction(function () use ($dentist, $key, $expectedRevision) {
            $t = MessageTemplate::whereKey($key)->lockForUpdate()->firstOrFail();
            if (! $t->needs_dentist) throw ValidationException::withMessages(['template' => ['This wording does not need a Dentist’s approval.']]);
            if ($t->revision !== $expectedRevision) return null;
            if ($t->dentist_approved_at) return $t;
            $t->forceFill(['dentist_approved_at' => now(), 'dentist_approved_by_user_id' => $dentist->id])->save();
            $context = ['template' => $key, 'revision' => $t->revision];
            if ($key === 'recall_due') $context['recall_rules'] = AutomationCatalog::setting('recall')?->settings['rules'] ?? [];
            app(AuditService::class)->recordAdministrative('message_template.dentist_approved', $dentist, null, $context);

            return $t;
        });
    }

    /** Recall intervals changed: the Dentist's approval covered the old ones, so it is cleared (and recall switched off). */
    public static function clearDentistApproval(string $key, User $actor): void
    {
        $t = MessageTemplate::whereKey($key)->lockForUpdate()->first();
        if (! $t?->dentist_approved_at) return;
        $t->forceFill(['dentist_approved_at' => null, 'dentist_approved_by_user_id' => null, 'revision' => $t->revision + 1])->save();
        (new self)->switchOffUsers($key, $actor);
    }

    /** @return string[] automations switched off because their wording is no longer approved */
    private function switchOffUsers(string $key, User $actor): array
    {
        $off = [];
        foreach (AutomationCatalog::TEMPLATES as $automation => $keys) {
            if (! in_array($key, $keys, true)) continue;
            $row = AutomationSetting::whereKey($automation)->lockForUpdate()->first();
            if ($row?->enabled) {
                $row->forceFill(['enabled' => false, 'revision' => $row->revision + 1, 'updated_by_user_id' => $actor->id])->save();
                $off[] = $automation;
            }
        }

        return $off;
    }
}
