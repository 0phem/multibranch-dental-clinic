<?php

namespace App\Services\Feedback;

use App\Http\Resources\PatientFeedbackResource;
use App\Models\CommandKey;
use App\Models\PatientFeedback;
use App\Models\User;
use App\Models\Visit;
use App\Services\Visits\VisitCommandException;
use App\Support\ClinicClock;
use App\Support\IdempotentCommand;
use Illuminate\Http\JsonResponse;

// M26 submit command (Patient only; Idempotency-Key required). The Patient is the authenticated account; the Visit must be one of that
// Patient's own COMPLETED Visits (a technical eligibility taken from the canonical M26 ownership text, not an approved clinic policy).
// The command only READS the Visit (no M8/M5/M6 state is touched), stores free text as data, and creates nothing else: no reply, review,
// notification, conversation, audit transcript or marketing record.
final class FeedbackService
{
    public function submit(User $actor, string $visitPublicId, string $body, string $key, ?int $rating = null): JsonResponse
    {
        $payload = ['visit' => strtolower($visitPublicId), 'body' => $body, 'rating' => $rating];

        return IdempotentCommand::run(
            CommandKey::class, $actor, $key, 'feedback.submit', $payload,
            function () use ($actor, $visitPublicId, $body, $rating) {
                $patient = $actor->patient;
                // Foreign, unknown, malformed and not-yet-completed Visits are one and the same refusal: nothing about another Patient's care leaks.
                $visit = $patient ? Visit::where('public_id', strtolower($visitPublicId))->where('patient_id', $patient->id)->where('status', 'Completed')->with(['treatment.procedures'])->lockForUpdate()->first() : null;
                if (! $visit) {
                    throw VisitCommandException::rule('visit_not_eligible', 'Choose one of your completed visits.', 'visit_id');
                }
                $feedback = PatientFeedback::create(['patient_id' => $patient->id, 'visit_id' => $visit->id, 'rating' => $rating, 'body' => $body, 'created_at' => ClinicClock::now()]);

                // Auto-create a follow-up task for 1-2 star ratings so clinic staff can follow up
                if ($rating !== null && $rating <= 2) {
                    try {
                        \App\Models\FollowupTask::create([
                            'patient_id' => $patient->id,
                            'branch_id' => $visit->branch_id,
                            'treatment_id' => $visit->treatment?->id,
                            'service_id' => $visit->requested_service_id ?? $visit->treatment?->procedures->first()?->service_id,
                            'dentist_profile_id' => $visit->dentist_profile_id ?? $visit->treatment?->dentist_profile_id,
                            'reason' => "Low satisfaction feedback ({$rating} stars): {$body}",
                            'due_on' => ClinicClock::today(),
                            'source' => 'feedback',
                            'status' => 'Open',
                            'created_by_user_id' => null,
                        ]);
                        app(\App\Services\Audit\AuditService::class)->record([
                            'action' => 'followup.created_from_feedback', 'category' => 'clinical', 'severity' => 'info', 'actor' => $actor, 'target' => $patient,
                            'payload' => ['rating' => $rating, 'visit' => $visit->public_id],
                        ]);
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }

                return [(new PatientFeedbackResource($feedback->load(['visit.treatment.procedures'])))->response()->getData(true), 201];
            },
            fn () => VisitCommandException::rule('idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'idempotency_key'),
            null,
            3,
        );
    }
}
