<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Patient;
use App\Models\User;
use App\Models\UserBranchScope;
use App\Models\Visit;

// M4 Patient record authorization. Two tiers, each tied to an authorization that already existed before M4:
//
//   IDENTITY tier  (`view`): code, name, phone, date of birth — exactly what the existing Patient directory
//     (PatientDirectoryController, M6 cutover) already returns. Patient: only their own. Staff: any Patient, but only with at
//     least one authorization branch scope (the directory rule: Patients are clinic-wide records for front-desk work). Owner:
//     the directory is already open to Owner. Dentist: none — see below.
//   FULL PROFILE tier (`viewProfile`, `update`): adds sex, email, address, emergency contact, preferred branch, revision.
//     This is data the directory never exposed, so it is NOT clinic-wide. Patient: their own. Staff: only a Patient who has an
//     appointment or Visit in one of the Staff account's authorization branch scopes (the same read scopes M6/M8 already
//     enforce; mirrors the long-standing client rule that Staff reach a Patient through in-scope records). Edits additionally
//     require Staff and the full tier. Owner: identity tier only — whether Owner may read or edit the full profile is a
//     POLICY DECISION REQUIRED, so it is refused rather than assumed.
//
//   Dentist: NO generic Patient-record access. Existing Dentist entitlements are workflow-specific records (their Appointments,
//     Visits, Queue and Treatments, each already carrying the Patient context that workflow needs). A generic, longitudinal
//     Patient-record read for Dentists was not an existing server contract, so it fails closed until the clinic decides it —
//     POLICY DECISION REQUIRED.
class PatientPolicy
{
    public function view(User $user, Patient $patient): bool
    {
        return match ($user->role) {
            Role::Owner => true,
            Role::Patient => $this->own($user, $patient),
            Role::Staff => $this->hasScope($user),
            Role::Dentist => false,
        };
    }

    public function viewProfile(User $user, Patient $patient): bool
    {
        return match ($user->role) {
            Role::Patient => $this->own($user, $patient),
            Role::Staff => $this->hasScope($user) && $this->hasScopedRecord($user, $patient),
            default => false,
        };
    }

    public function update(User $user, Patient $patient): bool
    {
        return $user->role === Role::Staff && $this->viewProfile($user, $patient);
    }

    private function own(User $user, Patient $patient): bool
    {
        return $user->patient !== null && $user->patient->id === $patient->id;
    }

    private function hasScope(User $user): bool
    {
        return UserBranchScope::where('user_id', $user->id)->exists();
    }

    /** An appointment or Visit of this Patient in a branch the Staff account is authorized for (the M6/M8 read scopes), or an open M25 handover to it. */
    private function hasScopedRecord(User $user, Patient $patient): bool
    {
        return Appointment::visibleTo($user)->where('patient_id', $patient->id)->exists()
            || Visit::visibleTo($user)->where('patient_id', $patient->id)->exists()
            // M25: an open handover to one of the account's branches (awaiting acknowledgement, or acknowledged within the Owner's days).
            || \App\Models\PatientHandover::grantsProfileAccess($user, $patient);
    }
}
