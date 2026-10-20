<?php

namespace App\Services\Followups;

use App\Models\Appointment;
use App\Models\FollowupTask;
use App\Models\Treatment;
use App\Services\Audit\AuditService;
use App\Support\ClinicClock;
use Illuminate\Database\QueryException;

/**
 * M20: the follow-up task lifecycle the rest of the system calls into.
 *  - fromTreatment(): a completed treatment that asks for a follow-up gets one task (once per treatment), due on the recommended
 *    date (today when none was given), for the branch front desk, with the treatment's first service preselected for booking.
 *  - booked(): an appointment booked for the patient marks their oldest open task Booked (the same branch first).
 *  - cancelled(): cancelling that appointment opens the task again.
 * Audit entries name the task, never its reason.
 */
final class Followups
{
    public static function fromTreatment(Treatment $t): ?FollowupTask
    {
        if (! $t->followup_required || $t->status !== 'Completed') return null;
        $t->loadMissing(['visit', 'procedures']);
        if (! $t->visit) return null;
        try {
            // A savepoint: a duplicate (already created) never aborts the completing treatment's transaction.
            $task = \Illuminate\Support\Facades\DB::transaction(fn () => FollowupTask::create(['patient_id' => $t->visit->patient_id, 'branch_id' => $t->visit->branch_id, 'treatment_id' => $t->id,
                'service_id' => $t->procedures->first()?->service_id ?? $t->visit->requested_service_id, 'dentist_profile_id' => $t->dentist_profile_id,
                'reason' => trim((string) ($t->followup_reason ?: 'Follow-up visit')), 'due_on' => $t->followup_recommended_date ? substr((string) $t->getRawOriginal('followup_recommended_date'), 0, 10) : ClinicClock::today(),
                'source' => 'treatment', 'status' => 'Open', 'created_by_user_id' => $t->updated_by_user_id]));
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') return FollowupTask::where('treatment_id', $t->id)->where('source', 'treatment')->first(); // already created

            throw $e;
        }
        app(AuditService::class)->record(['action' => 'followup.created', 'category' => 'clinical', 'severity' => 'info', 'actor' => null, 'target' => $task->patient,
            'payload' => ['task' => $task->public_id, 'source' => 'treatment', 'due_on' => $task->dueOn()]]);

        return $task;
    }

    public static function booked(Appointment $a): ?FollowupTask
    {
        if (! in_array($a->status, Appointment::ACTIVE_STATUSES, true)) return null;
        $task = FollowupTask::where('patient_id', $a->patient_id)->whereIn('status', FollowupTask::OPEN)
            ->orderByRaw('case when branch_id = ? then 0 else 1 end', [$a->branch_id])->orderBy('due_on')->orderBy('id')->lockForUpdate()->first();
        if (! $task) return null;
        $task->update(['status' => 'Booked', 'appointment_id' => $a->id, 'booked_at' => now(), 'revision' => $task->revision + 1]);
        app(AuditService::class)->record(['action' => 'followup.booked', 'category' => 'clinical', 'severity' => 'info', 'actor' => null, 'target' => $task->patient,
            'payload' => ['task' => $task->public_id, 'appointment' => $a->public_id]]);

        return $task;
    }

    public static function cancelled(Appointment $a): void
    {
        foreach (FollowupTask::where('appointment_id', $a->id)->where('status', 'Booked')->get() as $task) {
            $task->update(['status' => 'Open', 'appointment_id' => null, 'booked_at' => null, 'revision' => $task->revision + 1]);
            app(AuditService::class)->record(['action' => 'followup.reopened', 'category' => 'clinical', 'severity' => 'info', 'actor' => null, 'target' => $task->patient,
                'payload' => ['task' => $task->public_id, 'appointment' => $a->public_id]]);
        }
    }
}
