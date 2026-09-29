<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Requests\Patient\RegisterWalkInPatientRequest;
use App\Models\CommandKey;
use App\Models\Patient;
use App\Models\Person;
use App\Services\Visits\VisitCommandException;
use App\Support\IdempotentCommand;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

// Minimal M4 front-desk Patient registration (decision D4): Staff (with at least one branch scope) or Owner creates a
// Person + Patient for a walk-in — no User, password or login session. It returns the Patient public_id in the same
// shape as the Patient directory. There is no fuzzy matching and no merging: an exact existing email is refused and
// Staff are directed to search the directory; otherwise a new record is created.
class PatientRegistrationController extends Controller
{
    use ReadsIdempotencyKey;

    public function store(RegisterWalkInPatientRequest $request): JsonResponse
    {
        $actor = $request->user();
        abort_if($actor->role === Role::Staff && ! $actor->branchScopes()->exists(), 403, 'Forbidden.');
        $data = $request->validated();

        return IdempotentCommand::run(
            CommandKey::class, $actor, $this->idempotencyKey($request, true), 'patient.register', $data,
            function () use ($data) {
                if ($data['email'] !== null && Person::where('email', $data['email'])->exists()) {
                    throw VisitCommandException::rule('patient_email_exists', 'A record with this email already exists. Search the patient directory and select the existing patient.', 'email');
                }
                // Serialize patient_code allocation (count-based, as in the existing registration paths).
                DB::statement('LOCK TABLE patients IN SHARE ROW EXCLUSIVE MODE');
                $person = Person::create([
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? null,
                    'date_of_birth' => $data['date_of_birth'] ?? null,
                ]);
                $patient = Patient::create([
                    'person_id' => $person->id,
                    'patient_code' => 'PAT-'.str_pad((string) (Patient::count() + 1), 4, '0', STR_PAD_LEFT),
                    'consent' => false,
                ]);

                return [['data' => [
                    'id' => $patient->public_id,
                    'code' => $patient->patient_code,
                    'name' => $person->fullName(),
                    'first_name' => $person->first_name,
                    'last_name' => $person->last_name,
                    'phone' => $person->phone,
                    'date_of_birth' => $person->date_of_birth?->toDateString(),
                ]], 201];
            },
            fn () => VisitCommandException::rule('idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'idempotency_key'),
            function (QueryException $e) {
                if (str_contains($e->getMessage(), 'persons_email_unique')) {
                    throw VisitCommandException::rule('patient_email_exists', 'A record with this email already exists. Search the patient directory and select the existing patient.', 'email');
                }
                if (str_contains($e->getMessage(), 'patient_code')) {
                    throw new VisitCommandException(409, 'conflict', 'Another patient was registered at the same moment. Try again.');
                }
            },
        );
    }
}
