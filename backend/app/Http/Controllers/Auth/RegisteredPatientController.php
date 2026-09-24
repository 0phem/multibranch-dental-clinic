<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterPatientRequest;
use App\Http\Resources\UserResource;
use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

// Public registration is Patient-only (see AGENTS.md canonical identity model). Every write here comes from
// $request->validated() — never raw request input — so a reserved field slipping past the FormRequest's
// `prohibited` rules still could not reach the database.
class RegisteredPatientController extends Controller
{
    public function store(RegisterPatientRequest $request)
    {
        $data = $request->validated();

        $this->guardAgainstDuplicatePerson($data);

        $user = DB::transaction(function () use ($data) {
            $person = Person::create([
                'first_name' => $data['first_name'],
                'middle_name' => $data['middle_name'] ?? null,
                'last_name' => $data['last_name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'date_of_birth' => $data['date_of_birth'] ?? null,
            ]);

            Patient::create([
                'person_id' => $person->id,
                'patient_code' => $this->nextPatientCode(),
                'consent' => false,
            ]);

            return User::create([
                'person_id' => $person->id,
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'role' => Role::Patient,
                'account_status' => 'Active',
            ]);
        });

        auth()->login($user);
        $request->session()->regenerate();

        return response()->json([
            'data' => new UserResource($user->load(['person', 'patient'])),
        ], 201);
    }

    // Mirrors the frontend's possibleDuplicatePerson signal: a matching phone, or a matching first/last name
    // plus date of birth, flags a likely-existing record. Deliberately does not disclose which existing record
    // matched, or whether it was the phone or the name+DOB branch.
    private function guardAgainstDuplicatePerson(array $data): void
    {
        $duplicate = Person::query()
            ->where(function ($query) use ($data) {
                $query->where('phone', $data['phone']);
            })
            ->orWhere(function ($query) use ($data) {
                $query->whereRaw('lower(first_name) = ?', [Str::lower($data['first_name'])])
                    ->whereRaw('lower(last_name) = ?', [Str::lower($data['last_name'])])
                    ->where('date_of_birth', $data['date_of_birth'] ?? null);
            })
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'phone' => 'An existing patient record may already match these details. Please contact the clinic for account assistance.',
            ]);
        }
    }

    private function nextPatientCode(): string
    {
        return 'PAT-'.str_pad((string) (Patient::count() + 1), 4, '0', STR_PAD_LEFT);
    }
}
