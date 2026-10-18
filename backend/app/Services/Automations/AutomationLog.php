<?php

namespace App\Services\Automations;

use App\Models\AutomationDelivery;
use App\Models\User;
use App\Services\Mail\MailOutbox;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * The append-only memory of the scheduled automations. Every action has ONE dedupe key (for example
 * "appointment_reminder:<appointment>:r<revision>:lead"); the first writer wins, so a retry, a second scheduler process or a
 * re-run after a crash never sends twice. Emails use the same key in the M18 outbox, which retries failed sends and re-checks
 * the record just before sending (a cancelled, rescheduled or paid record is not emailed).
 */
final class AutomationLog
{
    public static function done(string $key): bool
    {
        return AutomationDelivery::where('dedupe_key', $key)->exists();
    }

    /** Queues one email (and records it) unless this key was already handled. Returns true only for the first writer. */
    public static function queueEmail(string $automation, string $key, string $purpose, Model $subject, ?int $revision, User $recipient, ?int $branchId): bool
    {
        if (self::done($key)) return false;
        try {
            return DB::transaction(function () use ($automation, $key, $purpose, $subject, $revision, $recipient, $branchId) {
                $dispatch = app(MailOutbox::class)->queue($purpose, $key, $subject, $revision, $recipient, null);
                AutomationDelivery::create(['automation' => $automation, 'dedupe_key' => $key, 'outcome' => 'queued',
                    'subject_type' => strtolower(class_basename($subject)), 'subject_public_id' => $subject->public_id ?? null,
                    'branch_id' => $branchId, 'mail_dispatch_id' => $dispatch->id, 'created_at' => now()]);

                return true;
            });
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') return false; // a concurrent run handled the same key first

            throw $e;
        }
    }

    /** Records an outcome without email ('notified', 'flagged' or 'skipped' with a reason). Returns true for the first writer. */
    public static function record(string $automation, string $key, string $outcome, ?string $reason = null, ?Model $subject = null, ?int $branchId = null): bool
    {
        return DB::table('automation_deliveries')->insertOrIgnore([
            'automation' => $automation, 'dedupe_key' => mb_substr($key, 0, 191), 'outcome' => $outcome, 'reason' => $reason,
            'subject_type' => $subject ? strtolower(class_basename($subject)) : null, 'subject_public_id' => $subject?->public_id ?? null,
            'branch_id' => $branchId, 'created_at' => now()->toIso8601String(),
        ]) === 1;
    }

    /** A skip is remembered once per thing and reason, so the same skip is not counted every minute. */
    public static function skip(string $automation, string $key, string $reason, ?Model $subject = null, ?int $branchId = null): bool
    {
        return self::record($automation, "skip:$reason:$key", 'skipped', $reason, $subject, $branchId);
    }

    /**
     * Last 7 days for the Owner page. Emails count as sent when the mail transport accepted them (or the local log recorded
     * them), failed when every attempt failed, and skipped when skipped here or superseded before sending.
     *
     * @return array<string, array{sent:int, skipped:int, failed:int, pending:int, flagged:int, notified:int}>
     */
    public static function lastSevenDays(): array
    {
        $rows = DB::table('automation_deliveries as d')->leftJoin('mail_dispatches as m', 'm.id', '=', 'd.mail_dispatch_id')
            ->where('d.created_at', '>=', now()->subDays(7)->toIso8601String())
            ->selectRaw("d.automation,
                count(*) filter (where d.outcome = 'queued' and m.status in ('transport_accepted','logged_only')) as sent,
                count(*) filter (where d.outcome = 'skipped' or m.status = 'superseded') as skipped,
                count(*) filter (where m.status = 'failed') as failed,
                count(*) filter (where m.status in ('pending','processing','retry_scheduled')) as pending,
                count(*) filter (where d.outcome = 'flagged') as flagged,
                count(*) filter (where d.outcome = 'notified') as notified")
            ->groupBy('d.automation')->get()->keyBy('automation');
        $out = [];
        foreach (AutomationCatalog::KEYS as $key) {
            $r = $rows[$key] ?? null;
            $out[$key] = ['sent' => (int) ($r->sent ?? 0), 'skipped' => (int) ($r->skipped ?? 0), 'failed' => (int) ($r->failed ?? 0),
                'pending' => (int) ($r->pending ?? 0), 'flagged' => (int) ($r->flagged ?? 0), 'notified' => (int) ($r->notified ?? 0)];
        }

        return $out;
    }
}
