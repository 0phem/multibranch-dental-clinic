<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Person;
use App\Services\Audit\AuditService;
use App\Services\Intake\Guardianship;
use App\Services\Mail\MailDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Parents and guardians. A patient adds dependents (consent recorded per dependent), sees them in the person switcher
 * ("Booking for: Me / Ana"), and — once a dependent is 18 — invites them to claim their own account (email code); the guardian
 * then loses access. Staff link an existing record to a guardian (audited).
 */
class GuardianController extends Controller
{
    public function mine(Request $request): JsonResponse
    {
        $me = $request->user()->patient;
        abort_unless($me, 403);

        return response()->json(['data' => Guardianship::dependentsOf($me)->map(fn ($l) => $this->view($l->dependent, $l->relationship))->values(),
            'meta' => ['me' => ['id' => $me->public_id, 'name' => $me->person?->fullName(), 'first_name' => $me->person?->first_name]]]);
    }

    public function add(Request $request): JsonResponse
    {
        $me = $request->user()->patient;
        abort_unless($me, 403);
        $data = $request->validate(['first_name' => ['required', 'string', 'max:100'], 'last_name' => ['required', 'string', 'max:100'],
            'date_of_birth' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'], 'sex' => ['nullable', 'in:Female,Male,Prefer not to say'],
            'relationship' => ['required', 'string', 'max:40'], 'consent' => ['accepted']]);
        if (Guardianship::isMinor($me->person?->date_of_birth?->toDateString())) throw ValidationException::withMessages(['guardian' => ['Only an adult (18 or older) can add dependents.']]);
        if (Guardianship::dependentsOf($me)->count() >= 10) throw ValidationException::withMessages(['first_name' => ['Ask the front desk to add more dependents.']]);
        $patient = DB::transaction(function () use ($me, $data, $request) {
            DB::statement('LOCK TABLE patients IN SHARE ROW EXCLUSIVE MODE');

            return Guardianship::addDependent($me, $data, $request->user());
        });

        return response()->json(['data' => $this->view($patient->load('person'), $data['relationship'])], 201);
    }

    /** Guardian (or Staff): a dependent of 18 or more gets an email to claim their own account. */
    public function invite(Request $request, Patient $patient): JsonResponse
    {
        $user = $request->user();
        $staff = in_array($user->role->value, ['staff', 'owner'], true);
        abort_unless($staff ? Gate::allows('update', $patient) || $user->role->value === 'owner' : (Guardianship::canActFor($user, $patient) && $user->patient->id !== $patient->id), 404);
        $data = $request->validate(['email' => ['required', 'email:rfc', 'max:255']]);
        $email = strtolower(trim($data['email']));
        if ((Guardianship::age($patient->person?->date_of_birth?->toDateString()) ?? 0) < Guardianship::ADULT_AGE) throw ValidationException::withMessages(['email' => ['Only a dependent of 18 or older can have their own account.']]);
        if ($patient->user?->email_verified_at) throw ValidationException::withMessages(['email' => ['This patient already has an account.']]);
        // A one-time claim link to the dependent's own email (single use, expires); the guardian keeps access until the claim succeeds.
        $result = app(\App\Services\Intake\AccountClaims::class)->offer($patient, $email, $user, $staff ? 'staff' : 'guardian');

        return response()->json(['data' => ['status' => $result['status'], 'message' => $result['message']]]);
    }

    /** Staff: link an existing record (for example a child registered before) to a guardian. Audited. */
    public function link(Request $request, Patient $patient): JsonResponse
    {
        Gate::authorize('update', $patient);
        $data = $request->validate(['guardian_patient_id' => ['required', 'string', 'max:40'], 'relationship' => ['required', 'string', 'max:40']]);
        $guardian = Patient::where('public_id', $data['guardian_patient_id'])->firstOrFail();
        $link = Guardianship::link($patient, $guardian, $data['relationship'], $request->user(), null);

        return response()->json(['data' => ['id' => $link->public_id, 'guardian' => $guardian->person?->fullName(), 'relationship' => $link->relationship]], 201);
    }

    private function view(Patient $p, string $relationship): array
    {
        $dob = $p->person?->date_of_birth?->toDateString();

        return ['id' => $p->public_id, 'code' => $p->patient_code, 'name' => $p->person?->fullName(), 'first_name' => $p->person?->first_name,
            'date_of_birth' => $dob, 'relationship' => $relationship, 'minor' => Guardianship::isMinor($dob), 'age' => Guardianship::age($dob), 'has_account' => $p->user !== null];
    }
}
