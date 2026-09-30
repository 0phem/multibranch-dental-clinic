<?php

namespace App\Services\Hmo;

use App\Models\HmoCase;
use App\Models\PatientHmoMembership;
use App\Models\Treatment;
use App\Models\Visit;

// The ONE server-side M12 answer future M11 needs before issuing an invoice or recording money (CONTRACTS.md §7/§8).
// It reads only server data — Treatment → Visit → HMO case and the Patient's active membership — and does no invoice
// arithmetic: M11 keeps gross, the coverage cap against gross, Patient responsibility, payments and balance.
//
//   no active membership + no case → self-pay path (nothing blocked)
//   active membership + no case    → a claim decision is required (open a case, or record self-pay → Withdrawn)
//   Missing / Ready                → preparation      (issue + payment blocked)
//   Pending / Escalated            → waiting          (issue + payment blocked)
//   Returned                       → action_required  (issue + payment blocked)
//   Approved                       → approved amount  (nothing blocked)
//   Rejected / Withdrawn           → "0.00" coverage  (nothing blocked)
// Draft invoice creation/review is never blocked by M12. Full coverage never implies a payment (P9 stays open).
final class HmoFinancialGate
{
    private const STAGES = [
        'Missing Requirements' => 'preparation', 'Ready for Submission' => 'preparation',
        'Pending' => 'waiting', 'Escalated' => 'waiting', 'Returned' => 'action_required',
        'Approved' => 'approved', 'Rejected' => 'rejected', 'Withdrawn' => 'withdrawn',
    ];

    public function forTreatment(Treatment $treatment): array
    {
        return $this->forVisit($treatment->visit()->firstOrFail());
    }

    public function forVisit(Visit $visit): array
    {
        $case = HmoCase::where('visit_id', $visit->id)->first();
        $hasMembership = PatientHmoMembership::where('patient_id', $visit->patient_id)->where('status', 'active')->exists();

        if (! $case) {
            return [
                'has_membership' => $hasMembership,
                'has_case' => false,
                'requires_claim_decision' => $hasMembership,
                'case_public_id' => null,
                'status' => null,
                'stage' => 'none',
                'blocks_invoice_issue' => $hasMembership,
                'blocks_payment' => $hasMembership,
                'coverage_status' => $hasMembership ? 'pending' : 'none',
                'approved_amount' => null,
            ];
        }

        $stage = self::STAGES[$case->status];
        $final = $case->isFinal();

        return [
            'has_membership' => $hasMembership,
            'has_case' => true,
            'requires_claim_decision' => false,
            'case_public_id' => $case->public_id,
            'status' => $case->status,
            'stage' => $stage,
            'blocks_invoice_issue' => ! $final,
            'blocks_payment' => ! $final,
            'coverage_status' => match ($case->status) {
                'Approved' => 'approved',
                'Rejected' => 'rejected',
                'Withdrawn' => 'none',
                default => 'pending',
            },
            'approved_amount' => match ($case->status) {
                'Approved' => (string) $case->approved_amount,
                'Rejected', 'Withdrawn' => '0.00',
                default => null,
            },
        ];
    }
}
