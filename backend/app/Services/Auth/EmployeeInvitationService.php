<?php

namespace App\Services\Auth;

use App\Enums\Role;
use App\Mail\EmployeeInvitationMail;
use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\Person;
use App\Models\StaffProfile;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Services\Mail\MailDispatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * M1 employee provisioning by email invitation.
 *
 * Confirmed clinic facts: the Owner alone approves employee accounts (PI-01, form Q6) and a new employee receives the first
 * sign-in by an invitation sent to their email (PI-02, form Q7). Additional Owner accounts are NOT covered (PI-01 unanswered
 * part), so only Staff and Dentist can be invited.
 *
 * Engineering defaults, documented and configurable, pending the unanswered parts of PI-02 (expiry, resend, recovery,
 * identity confirmation): a single-use link valid for `clinic.invitation_expire_hours` (default 72 h); resending replaces the
 * previous link; setting a password through the emailed link is the identity confirmation (it proves control of the email).
 * There is no default or emailed password, no self-service invitation and no password recovery here.
 *
 * States: Invited --accept--> Active; Invited --cancel--> Revoked; Revoked --resend--> Invited. An account that has been
 * activated is never an invitation again. Records reuse users/persons/profiles and Laravel's hashed
 * password_reset_tokens table, so no schema change is needed.
 *
 * Operational assignment (profile branch, shift) is the Owner's input; authorization branch scope is NOT implied by it
 * (CONTRACTS §1) and stays a separate, explicit Owner step. New profiles start operationally unavailable and without
 * service eligibility, so nobody can be booked with a person who has not joined.
 */
class EmployeeInvitationService
{
    public const INVITED = 'Invited';
    public const REVOKED = 'Revoked';

    public function __construct(private readonly AuditService $audit, private readonly MailDispatcher $mail) {}

    public static function expireHours(): int
    {
        return max(1, (int) config('clinic.invitation_expire_hours', 72));
    }

    /** @return array{user: User, delivery: array} */
    public function invite(User $owner, array $data): array
    {
        [$user, $token] = DB::transaction(function () use ($owner, $data) {
            DB::statement('LOCK TABLE persons IN SHARE ROW EXCLUSIVE MODE');
            if (User::withTrashed()->where('email', $data['email'])->exists() || Person::where('email', $data['email'])->exists()) {
                throw ValidationException::withMessages(['email' => 'This email address is already registered.']);
            }
            $branch = Branch::fromPublicReference((string) $data['branch_ref']);
            if (! $branch) throw ValidationException::withMessages(['branch_ref' => 'Choose an existing branch.']);
            $role = Role::from($data['role']);

            $person = Person::create(['first_name' => $data['first_name'], 'last_name' => $data['last_name'], 'email' => $data['email'], 'phone' => $data['phone'] ?? null]);
            $user = User::create([
                'person_id' => $person->id, 'email' => $data['email'], 'role' => $role,
                'account_status' => self::INVITED, 'title' => $role === Role::Staff ? $data['title'] : null,
                // Unusable until the invitation is accepted: nobody knows this value and Invited accounts cannot sign in.
                'password' => Hash::make(Str::random(64)),
            ]);
            $ref = strtolower((string) Str::ulid());
            if ($role === Role::Staff) {
                StaffProfile::create([
                    'legacy_ref' => "s-$ref", 'legacy_user_ref' => $user->public_id, 'title' => $data['title'], 'person_id' => $person->id,
                    'branch_id' => $branch->id, 'shift_start' => $data['shift_start'], 'shift_end' => $data['shift_end'], 'available' => false,
                ]);
            } else {
                $profile = DentistProfile::create([
                    'legacy_ref' => "d-$ref", 'legacy_user_ref' => $user->public_id, 'person_id' => $person->id,
                    'license_no' => $data['license_no'] ?? null, 'specialty' => $data['specialty'] ?? null,
                    'shift_start' => $data['shift_start'], 'shift_end' => $data['shift_end'], 'available' => false,
                ]);
                $profile->branches()->attach($branch->id);
            }
            $token = $this->issueToken($user);
            $this->audit->recordAdministrative('employee.invited', $owner, $user, ['role' => $role->value, 'expires_in_hours' => self::expireHours()]);

            return [$user->load('person'), $token];
        });

        return ['user' => $user, 'delivery' => $this->deliver($user, $token, $owner)];
    }

    /** Replaces any earlier link. Allowed for Invited and Revoked accounts that were never activated. */
    public function resend(User $owner, User $target): array
    {
        [$user, $token] = DB::transaction(function () use ($owner, $target) {
            $user = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            $this->assertNeverActivated($user, [self::INVITED, self::REVOKED]);
            $reopened = $user->account_status === self::REVOKED;
            if ($reopened) $user->update(['account_status' => self::INVITED]);
            $token = $this->issueToken($user);
            $this->audit->recordAdministrative($reopened ? 'employee.invitation_reopened' : 'employee.invitation_resent', $owner, $user, ['expires_in_hours' => self::expireHours()]);

            return [$user->load('person'), $token];
        });

        return ['user' => $user, 'delivery' => $this->deliver($user, $token, $owner)];
    }

    public function cancel(User $owner, User $target): User
    {
        return DB::transaction(function () use ($owner, $target) {
            $user = User::whereKey($target->id)->lockForUpdate()->firstOrFail();
            $this->assertNeverActivated($user, [self::INVITED]);
            $user->update(['account_status' => self::REVOKED]);
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();
            $this->audit->recordAdministrative('employee.invitation_cancelled', $owner, $user);

            return $user->load('person');
        });
    }

    /**
     * Public acceptance. Every failure returns the same generic message so the endpoint reveals nothing about which
     * emails were invited. On success the account is Active with a verified email; the person then signs in normally.
     */
    public function accept(string $email, string $token, string $password): User
    {
        $generic = fn () => ValidationException::withMessages(['token' => 'This invitation link is not valid or has expired. Ask the clinic Owner to send a new one.']);

        return DB::transaction(function () use ($email, $token, $password, $generic) {
            $row = DB::table('password_reset_tokens')->where('email', $email)->lockForUpdate()->first();
            $user = User::where('email', $email)->lockForUpdate()->first();
            if (! $row || ! $user || $user->account_status !== self::INVITED || $user->email_verified_at
                || ! in_array($user->role, [Role::Staff, Role::Dentist], true)) throw $generic();
            if (! Hash::check($token, $row->token)) throw $generic();
            if (! $row->created_at || now()->diffInHours(\Illuminate\Support\Carbon::parse($row->created_at), true) >= self::expireHours()) {
                throw $generic();
            }
            DB::table('password_reset_tokens')->where('email', $email)->delete();
            $user->forceFill(['password' => Hash::make($password), 'account_status' => 'Active', 'email_verified_at' => now()])->save();
            $this->audit->recordAdministrative('employee.invitation_accepted', $user, $user);

            return $user;
        });
    }

    public function invitationState(User $user): array
    {
        $row = DB::table('password_reset_tokens')->where('email', $user->email)->first();
        $issued = $row?->created_at ? \Illuminate\Support\Carbon::parse($row->created_at) : null;
        $expires = $issued?->copy()->addHours(self::expireHours());

        return [
            'issued_at' => $issued?->toIso8601String(),
            'expires_at' => $expires?->toIso8601String(),
            'expired' => $user->account_status === self::INVITED && (! $expires || $expires->isPast()),
        ];
    }

    private function assertNeverActivated(User $user, array $allowed): void
    {
        if (! in_array($user->account_status, $allowed, true) || $user->email_verified_at || ! in_array($user->role, [Role::Staff, Role::Dentist], true)) {
            throw ValidationException::withMessages(['user' => 'This account is not an open employee invitation.']);
        }
    }

    private function issueToken(User $user): string
    {
        $token = Str::random(64);
        DB::table('password_reset_tokens')->updateOrInsert(['email' => $user->email], ['token' => Hash::make($token), 'created_at' => now()]);

        return $token;
    }

    private function deliver(User $user, string $token, User $owner): array
    {
        $link = rtrim((string) config('app.frontend_url'), '/').'/#accept-invitation?'.http_build_query(['email' => $user->email, 'token' => $token]);

        return $this->mail->send($user->email, new EmployeeInvitationMail($user, $link, self::expireHours()), 'employee_invitation', $owner, $user);
    }
}
