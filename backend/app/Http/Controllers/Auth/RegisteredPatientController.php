<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterPatientRequest;
use App\Mail\SecurityNoticeMail;
use App\Models\EmailVerificationOtp;
use App\Services\Auth\OneTimeCodes;
use App\Services\Auth\OtpThrottle;
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
        // Counted before any lookup, so the limit behaves the same for new and already-registered addresses.
        if ($wait = app(OtpThrottle::class)->hit($data['email'], (string) $request->ip())) return OtpThrottle::limited($wait);

        DB::transaction(function () use ($data) {
            // Same allocation lock as the existing walk-in path; duplicate checks
            // run after it so concurrent public registrations cannot pass together.
            DB::statement('LOCK TABLE patients IN SHARE ROW EXCLUSIVE MODE');
            $existing = User::withTrashed()->where('email', $data['email'])->first();
            if ($existing || Person::where('email', $data['email'])->exists()) {
                $this->noticeExistingAddress($data, $existing);
                return;
            }
            $this->guardAgainstDuplicatePerson($data);
            $person = Person::create([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'date_of_birth' => $data['date_of_birth'] ?? null,
            ]);

            Patient::create([
                'person_id' => $person->id,
                'patient_code' => Patient::nextCode(),
                'consent' => false,
            ]);

            $user = User::create([
                'person_id' => $person->id,
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'role' => Role::Patient,
                'account_status' => 'Active',
            ]);
            app(\App\Services\Audit\AuditService::class)->recordAuth('account.registered', $user);
            app(OneTimeCodes::class)->issue($user->setRelation('person', $person), EmailVerificationOtp::REGISTRATION, $user->email);
        });

        // Decision 7 (anti-enumeration): a new address and an already-registered one get this identical answer. The code
        // email (or, for an existing address, a notice to its owner) is sent by the queue after commit; nothing here claims
        // it was delivered.
        return response()->json(['data' => [
            'email' => $data['email'],
            'verification_required' => true,
            'resend_available_at' => now()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString(),
        ]], 201);
    }

    /**
     * The address already belongs to an account or a clinic record. Nothing is created or changed, the submitted password is
     * discarded, and the address owner is told someone tried (sign in / reset, or contact the clinic). The same hashing work
     * as a new registration is done so response time does not reveal which branch ran.
     */
    private function noticeExistingAddress(array $data, ?User $existing): void
    {
        Hash::make($data['password']);
        Hash::make(Str::random(6));
        $usable = $existing && ! $existing->trashed() && $existing->account_status === 'Active';
        $kind = $usable ? 'registration_attempt' : 'registration_attempt_record';
        $name = $existing?->person?->first_name ?? Person::where('email', $data['email'])->value('first_name');
        app(\App\Services\Mail\MailDispatcher::class)->queueOnce($data['email'], new SecurityNoticeMail($kind, $name), 'registration_attempt_notice', $usable ? $existing : null);
        app(\App\Services\Audit\AuditService::class)->record(['action' => 'account.registration_attempt_existing', 'category' => 'security', 'severity' => 'warning',
            'actor' => null, 'target' => $usable ? $existing : null, 'payload' => ['has_usable_account' => $usable]]);
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
}
