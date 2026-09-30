<?php

namespace App\Services\Hmo;

use App\Models\CommandKey;
use App\Models\HmoCase;
use App\Models\HmoCaseEvent;
use App\Models\HmoCaseRequirement;
use App\Models\Patient;
use App\Models\PatientHmoMembership;
use App\Models\Treatment;
use App\Models\User;
use App\Models\Visit;
use App\Services\Visits\VisitCommandException;
use App\Support\ClinicClock;
use App\Support\IdempotentCommand;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;

// Minimal M12 commands (CONTRACTS.md §8). Each runs in one transaction through the shared idempotency mechanism
// (Idempotency-Key required), checks `expected_revision` on an existing case, and appends an hmo_case_events row.
// Lock order: Patient (membership changes) / Visit → HMO case. Every outcome is a Staff-confirmed fact; nothing here is
// driven by extraction, a timer or a browser record. No command creates an invoice, payment or notification.
final class HmoCaseService
{
    private const ATTEMPTS = 3;

    // ---- MEMBERSHIP ---------------------------------------------------------------------------------------------------

    /** Starts a new active membership, ending the current one in the same transaction (history kept). */
    public function setMembership(User $actor, Patient $patient, string $provider, string $member, ?string $expectedActive, string $key, Closure $present): JsonResponse
    {
        $payload = ['patient' => $patient->id, 'provider' => $provider, 'member' => $member, 'expected' => $expectedActive];

        return $this->idempotent($actor, $key, 'hmo.membership.set', $payload, $present, function () use ($actor, $patient, $provider, $member, $expectedActive) {
            Patient::whereKey($patient->id)->lockForUpdate()->firstOrFail();
            $active = $this->assertExpectedActive($patient, $expectedActive);
            if ($active && $active->provider_name === $provider && $active->member_number === $member) {
                return [$patient, 200];
            }
            $now = ClinicClock::now();
            $active?->update(['status' => 'ended', 'ended_at' => $now, 'ended_by_user_id' => $actor->id]);
            PatientHmoMembership::create([
                'patient_id' => $patient->id, 'provider_name' => $provider, 'member_number' => $member, 'status' => 'active',
                'created_by_user_id' => $actor->id, 'created_at' => $now,
            ]);

            return [$patient, 201];
        });
    }

    public function endMembership(User $actor, Patient $patient, string $expectedActive, string $key, Closure $present): JsonResponse
    {
        return $this->idempotent($actor, $key, 'hmo.membership.end', ['patient' => $patient->id, 'expected' => $expectedActive], $present, function () use ($actor, $patient, $expectedActive) {
            Patient::whereKey($patient->id)->lockForUpdate()->firstOrFail();
            $active = $this->assertExpectedActive($patient, $expectedActive);
            $active->update(['status' => 'ended', 'ended_at' => ClinicClock::now(), 'ended_by_user_id' => $actor->id]);

            return [$patient, 200];
        });
    }

    private function assertExpectedActive(Patient $patient, ?string $expected): ?PatientHmoMembership
    {
        $active = PatientHmoMembership::where('patient_id', $patient->id)->where('status', 'active')->lockForUpdate()->first();
        if (($active?->public_id) !== $expected) {
            throw new VisitCommandException(409, 'stale_membership', 'This Patient’s HMO membership changed after it was opened. Reload it before trying again.');
        }

        return $active;
    }

    // ---- CASE OPENING -------------------------------------------------------------------------------------------------

    /** Opens the Visit's HMO case (Missing Requirements) from the Patient's active membership. */
    public function open(User $actor, Visit $visit, string $key, Closure $present): JsonResponse
    {
        return $this->idempotent($actor, $key, 'hmo.case.open', ['visit' => $visit->id], $present, function () use ($actor, $visit) {
            [$current, $membership] = $this->lockVisitForNewCase($visit);
            $case = $this->createCase($actor, $current, $membership, 'Missing Requirements');
            if ($this->treatmentCompleted($current)) {
                $case->requirements()->where('rule_key', 'treatment-request')->update([
                    'state' => 'Validated', 'document_label' => 'Completed treatment record', 'validated_by_user_id' => $actor->id, 'validated_at' => ClinicClock::now(),
                ]);
            }
            $this->event($case, $actor, 'created', null);

            return [$case, 201];
        });
    }

    /**
     * P3: the Patient has an active membership but the clinic will not pursue HMO for this Visit. Recorded as the Visit's
     * one case, created directly as the terminal Withdrawn disposition with the Staff reason — never a payment, invoice,
     * rejection or coverage.
     */
    public function selfPay(User $actor, Visit $visit, string $reason, string $key, Closure $present): JsonResponse
    {
        return $this->idempotent($actor, $key, 'hmo.case.self_pay', ['visit' => $visit->id, 'reason' => $reason], $present, function () use ($actor, $visit, $reason) {
            [$current, $membership] = $this->lockVisitForNewCase($visit);
            $case = $this->createCase($actor, $current, $membership, 'Withdrawn');
            $this->event($case, $actor, 'created', null);
            $this->event($case, $actor, 'withdrawal', null, ['note' => $reason]);

            return [$case, 201];
        });
    }

    /** @return array{0: Visit, 1: PatientHmoMembership} */
    private function lockVisitForNewCase(Visit $visit): array
    {
        $current = Visit::whereKey($visit->id)->lockForUpdate()->firstOrFail();
        if (HmoCase::where('visit_id', $current->id)->exists()) {
            throw self::caseExists();
        }
        $membership = PatientHmoMembership::where('patient_id', $current->patient_id)->where('status', 'active')->first();
        if (! $membership) {
            throw VisitCommandException::rule('membership_required', 'Record this Patient’s HMO membership before opening an HMO case or a self-pay decision.', 'membership');
        }

        return [$current, $membership];
    }

    private function createCase(User $actor, Visit $visit, PatientHmoMembership $membership, string $status): HmoCase
    {
        $now = ClinicClock::now();
        $case = HmoCase::create([
            'visit_id' => $visit->id, 'patient_id' => $visit->patient_id, 'branch_id' => $visit->branch_id, 'membership_id' => $membership->id,
            'provider_name' => $membership->provider_name, 'member_number' => $membership->member_number, 'status' => $status,
            'submission_cycle' => 0, 'final_at' => $status === 'Withdrawn' ? $now : null, 'revision' => 1,
            'created_by_user_id' => $actor->id, 'updated_by_user_id' => $actor->id,
        ]);
        foreach (array_keys(HmoCaseRequirement::RULES) as $rule) {
            HmoCaseRequirement::create(['hmo_case_id' => $case->id, 'rule_key' => $rule, 'state' => 'Missing']);
        }

        return $case;
    }

    // ---- LIFECYCLE ----------------------------------------------------------------------------------------------------

    /** Staff validates one requirement locally (metadata label only). All validated → Ready for Submission. */
    public function validateRequirement(User $actor, HmoCase $case, string $rule, int $expectedRevision, ?string $label, string $key, Closure $present): JsonResponse
    {
        $payload = ['case' => $case->id, 'rule' => $rule, 'expected_revision' => $expectedRevision, 'label' => $label];

        return $this->idempotent($actor, $key, 'hmo.case.requirement', $payload, $present, function () use ($actor, $case, $rule, $expectedRevision, $label) {
            $current = $this->lock($case, $expectedRevision);
            if (! in_array($current->status, ['Missing Requirements', 'Ready for Submission', 'Returned'], true)) {
                throw VisitCommandException::rule('invalid_transition', "Requirements cannot change while the case is {$current->status}.", 'status');
            }
            $requirement = $current->requirements()->where('rule_key', $rule)->lockForUpdate()->firstOrFail();
            if ($rule === 'treatment-request' && ! $this->treatmentCompleted($current->visit)) {
                throw VisitCommandException::rule('treatment_not_completed', 'The Dentist treatment request is satisfied by the completed treatment record for this visit.', 'requirement');
            }
            if ($requirement->state === 'Validated') {
                return [$current, 200];
            }
            $requirement->update(['state' => 'Validated', 'document_label' => $label, 'validated_by_user_id' => $actor->id, 'validated_at' => ClinicClock::now()]);
            $from = $current->status;
            $ready = $current->requirements()->where('state', '<>', 'Validated')->doesntExist();
            $this->touch($current, $actor, $ready ? ['status' => 'Ready for Submission'] : []);
            $this->event($current, $actor, 'requirement', $from, ['rule_keys' => [$rule], 'note' => $label]);

            return [$current, 200];
        });
    }

    /** Ready for Submission → Pending: Staff records the external submission; the submission cycle increments. */
    public function submit(User $actor, HmoCase $case, int $expectedRevision, string $method, string $note, string $key, Closure $present): JsonResponse
    {
        $payload = ['case' => $case->id, 'expected_revision' => $expectedRevision, 'method' => $method, 'note' => $note];

        return $this->idempotent($actor, $key, 'hmo.case.submit', $payload, $present, function () use ($actor, $case, $expectedRevision, $method, $note) {
            $current = $this->lock($case, $expectedRevision);
            if ($current->status !== 'Ready for Submission' || $current->requirements()->where('state', '<>', 'Validated')->exists()) {
                throw VisitCommandException::rule('requirements_incomplete', 'Validate every requirement before recording the submission.', 'status');
            }
            $from = $current->status;
            $this->touch($current, $actor, ['status' => 'Pending', 'submission_cycle' => $current->submission_cycle + 1, 'submitted_at' => ClinicClock::now(), 'escalated_at' => null]);
            $this->event($current, $actor, 'submission', $from, ['method' => $method, 'note' => $note]);

            return [$current, 200];
        });
    }

    /** A Staff follow-up contact with the provider for the current pending submission. */
    public function contact(User $actor, HmoCase $case, int $expectedRevision, string $method, string $note, string $nextAction, string $key, Closure $present): JsonResponse
    {
        $payload = ['case' => $case->id, 'expected_revision' => $expectedRevision, 'method' => $method, 'note' => $note, 'next' => $nextAction];

        return $this->idempotent($actor, $key, 'hmo.case.contact', $payload, $present, function () use ($actor, $case, $expectedRevision, $method, $note, $nextAction) {
            $current = $this->lock($case, $expectedRevision);
            if (! in_array($current->status, HmoCase::WAITING, true)) {
                throw VisitCommandException::rule('invalid_transition', 'Contacts are recorded only while a submission is pending.', 'status');
            }
            $this->touch($current, $actor, []);
            $this->event($current, $actor, 'contact', $current->status, ['method' => $method, 'note' => $note, 'next_action' => $nextAction]);

            return [$current, 200];
        });
    }

    /** Pending → Escalated: only after the project follow-up threshold and a recorded contact for the current cycle. */
    public function escalate(User $actor, HmoCase $case, int $expectedRevision, string $key, Closure $present): JsonResponse
    {
        return $this->idempotent($actor, $key, 'hmo.case.escalate', ['case' => $case->id, 'expected_revision' => $expectedRevision], $present, function () use ($actor, $case, $expectedRevision) {
            $current = $this->lock($case, $expectedRevision);
            $contacted = $current->events()->where('kind', 'contact')->where('submission_cycle', $current->submission_cycle)->exists();
            if ($current->status !== 'Pending' || ClinicClock::now()->lt($current->followUpDueAt()) || ! $contacted) {
                throw VisitCommandException::rule('escalation_not_allowed', 'Escalate only an overdue pending case after recording a contact attempt.', 'status');
            }
            $this->touch($current, $actor, ['status' => 'Escalated', 'escalated_at' => ClinicClock::now()]);
            $this->event($current, $actor, 'escalation', 'Pending');

            return [$current, 200];
        });
    }

    /**
     * Staff confirms an externally received provider response for the CURRENT submission cycle:
     * Approved (with the approved amount), Rejected, or Returned (with the requirements to correct).
     *
     * @param  list<string>  $returned
     */
    public function respond(User $actor, HmoCase $case, int $expectedRevision, int $cycle, string $outcome, string $method, string $note, ?string $reference, ?string $amount, array $returned, string $key, Closure $present): JsonResponse
    {
        $payload = ['case' => $case->id, 'expected_revision' => $expectedRevision, 'cycle' => $cycle, 'outcome' => $outcome, 'method' => $method,
            'note' => $note, 'reference' => $reference, 'amount' => $amount, 'returned' => $returned];

        return $this->idempotent($actor, $key, 'hmo.case.response', $payload, $present, function () use ($actor, $case, $expectedRevision, $cycle, $outcome, $method, $note, $reference, $amount, $returned) {
            $current = $this->lock($case, $expectedRevision);
            if (! in_array($current->status, HmoCase::WAITING, true)) {
                throw VisitCommandException::rule('invalid_transition', "A provider response is recorded only for a pending submission; this case is {$current->status}.", 'status');
            }
            if ($cycle !== $current->submission_cycle) {
                throw VisitCommandException::rule('wrong_cycle', 'Record the response against the current submission.', 'submission_cycle');
            }
            $from = $current->status;
            $now = ClinicClock::now();
            if ($outcome === 'Returned') {
                $current->requirements()->whereIn('rule_key', $returned)->update(['state' => 'Missing', 'document_label' => null, 'validated_by_user_id' => null, 'validated_at' => null]);
            }
            $this->touch($current, $actor, [
                'status' => $outcome,
                'final_at' => $outcome === 'Returned' ? null : $now,
                'approved_amount' => $outcome === 'Approved' ? $amount : null,
            ]);
            $this->event($current, $actor, 'response', $from, [
                'outcome' => $outcome, 'method' => $method, 'note' => $note, 'provider_reference' => $reference,
                'approved_amount' => $outcome === 'Approved' ? $amount : null, 'rule_keys' => $outcome === 'Returned' ? array_values($returned) : null,
            ]);

            return [$current, 200];
        });
    }

    /** P1: pre-submission only (never after a first submission) — the claim will not be pursued; self-pay may continue. */
    public function withdraw(User $actor, HmoCase $case, int $expectedRevision, string $reason, string $key, Closure $present): JsonResponse
    {
        return $this->idempotent($actor, $key, 'hmo.case.withdraw', ['case' => $case->id, 'expected_revision' => $expectedRevision, 'reason' => $reason], $present, function () use ($actor, $case, $expectedRevision, $reason) {
            $current = $this->lock($case, $expectedRevision);
            if (! in_array($current->status, HmoCase::PREPARATION, true) || $current->submission_cycle > 0) {
                throw VisitCommandException::rule('withdraw_not_allowed', 'An HMO case can be withdrawn only before its first submission.', 'status');
            }
            $from = $current->status;
            $this->touch($current, $actor, ['status' => 'Withdrawn', 'final_at' => ClinicClock::now()]);
            $this->event($current, $actor, 'withdrawal', $from, ['note' => $reason]);

            return [$current, 200];
        });
    }

    // ---- SUPPORT ------------------------------------------------------------------------------------------------------

    private function lock(HmoCase $case, int $expectedRevision): HmoCase
    {
        Visit::whereKey($case->visit_id)->lockForUpdate()->firstOrFail();
        $current = HmoCase::whereKey($case->id)->lockForUpdate()->firstOrFail();
        if ($current->isFinal()) {
            throw VisitCommandException::rule('case_final', "This HMO case is {$current->status} and final.", 'status');
        }
        if ($current->revision !== $expectedRevision) {
            throw new VisitCommandException(409, 'stale_revision', 'This HMO case changed after it was opened. Reload it before trying again.');
        }

        return $current;
    }

    private function touch(HmoCase $case, User $actor, array $changes): void
    {
        $case->update($changes + ['revision' => $case->revision + 1, 'updated_by_user_id' => $actor->id]);
    }

    private function treatmentCompleted(Visit $visit): bool
    {
        return Treatment::where('visit_id', $visit->id)->where('status', 'Completed')->exists();
    }

    private function event(HmoCase $case, User $actor, string $kind, ?string $from, array $fields = []): void
    {
        HmoCaseEvent::create($fields + [
            'hmo_case_id' => $case->id, 'kind' => $kind, 'submission_cycle' => $case->submission_cycle,
            'from_status' => $from, 'to_status' => $case->status, 'revision' => $case->revision,
            'actor_user_id' => $actor->id, 'actor_role' => $actor->role->value, 'occurred_at' => ClinicClock::now(),
        ]);
    }

    public static function caseExists(): VisitCommandException
    {
        return new VisitCommandException(409, 'hmo_case_exists', 'This visit already has an HMO case or self-pay decision. Reload it to continue.');
    }

    private function idempotent(User $actor, string $key, string $command, array $payload, Closure $present, Closure $work): JsonResponse
    {
        return IdempotentCommand::run(
            CommandKey::class, $actor, $key, $command, $payload,
            function () use ($work, $present) {
                [$record, $status] = $work();

                return [$present($record->fresh()), $status];
            },
            fn () => VisitCommandException::rule('idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'idempotency_key'),
            function (QueryException $e) {
                $message = $e->getMessage();
                if (str_contains($message, 'hmo_cases_visit_id_unique')) {
                    throw self::caseExists();
                }
                if (str_contains($message, 'hmo_memberships_one_active_per_patient')) {
                    throw new VisitCommandException(409, 'stale_membership', 'This Patient’s HMO membership changed at the same time. Reload it before trying again.');
                }
                if (str_contains($message, 'hmo_events_one_response_per_cycle') || str_contains($message, 'hmo_events_one_submission_per_cycle')) {
                    throw new VisitCommandException(409, 'stale_revision', 'This HMO case changed at the same time. Reload it before trying again.');
                }
                if (in_array($e->getCode(), ['40P01', '40001'], true)) {
                    throw new VisitCommandException(409, 'conflict', 'Another request changed this HMO case at the same time. Reload and try again.');
                }
            },
            self::ATTEMPTS,
        );
    }
}
