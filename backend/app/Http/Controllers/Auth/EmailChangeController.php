<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\SecurityNoticeMail;
use App\Models\EmailVerificationOtp;
use App\Models\Person;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Services\Auth\OneTimeCodes;
use App\Services\Auth\OtpThrottle;
use App\Services\Mail\MailDispatcher;
use App\Support\ClinicClock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * M1 self-service change of the sign-in email (any signed-in role). Two steps:
 *  request — the current password re-confirms the person; a one-time code goes to the NEW address (proving control of it).
 *            If the new address already belongs to someone, no code is sent but the answer is the same (no enumeration).
 *  confirm — a correct code moves users.email and persons.email to the new address (marked verified), signs every session
 *            out (auth_version), and queues a notice to the OLD address showing only a masked form of the new one.
 */
class EmailChangeController extends Controller
{
    public function __construct(private readonly OneTimeCodes $codes, private readonly AuditService $audit) {}

    public function request(Request $request)
    {
        $data = $request->validate([
            'new_email' => ['required', 'email:rfc', 'max:255'],
            'current_password' => ['required', 'string', 'max:72'],
        ]);
        $newEmail = strtolower(trim($data['new_email']));
        $actor = $request->user();
        if (! Hash::check($data['current_password'], $actor->password)) {
            $this->audit->recordAuth('account.email_change_password_failed', $actor, [], 'warning');

            return OneTimeCodes::failure('invalid_password', 'Your current password is not correct.', 'current_password');
        }
        if ($newEmail === $actor->email) return OneTimeCodes::failure('same_email', 'This is already your sign-in email.', 'new_email');
        if ($wait = app(OtpThrottle::class)->hit($newEmail, (string) $request->ip())) return OtpThrottle::limited($wait);

        $result = DB::transaction(function () use ($actor, $newEmail) {
            $user = User::whereKey($actor->id)->lockForUpdate()->firstOrFail();
            if ($wait = $this->codes->cooldown($user, EmailVerificationOtp::EMAIL_CHANGE)) return ['cooldown' => $wait];
            if ($this->taken($newEmail, $user)) {
                $this->audit->recordAuth('account.email_change_unavailable', $user, [], 'warning');

                return ['sent_at' => now()];
            }
            $otp = $this->codes->issue($user->load('person'), EmailVerificationOtp::EMAIL_CHANGE, $newEmail, $newEmail);
            $this->audit->recordAuth('account.email_change_requested', $user);

            return ['sent_at' => $otp->sent_at];
        });
        if (isset($result['cooldown'])) {
            return response()->json(['message' => 'Please wait before requesting another code.', 'code' => 'otp_resend_cooldown', 'retry_after' => $result['cooldown']], 429);
        }

        return response()->json([
            'message' => 'If this address can be used, we sent a code to it.',
            'data' => ['new_email' => $newEmail, 'resend_available_at' => $result['sent_at']->copy()->addSeconds((int) config('clinic.otp_resend_cooldown_seconds', 60))->toISOString()],
        ]);
    }

    public function confirm(Request $request)
    {
        $data = $request->validate(['otp' => ['required', 'digits:6']]);
        $actor = $request->user();

        $result = DB::transaction(function () use ($actor, $data) {
            $user = User::whereKey($actor->id)->lockForUpdate()->firstOrFail();
            $check = $this->codes->check($user, EmailVerificationOtp::EMAIL_CHANGE, $data['otp']);
            if (isset($check['failure'])) return $check;
            $newEmail = $check['otp']->new_email;
            if ($this->taken($newEmail, $user)) return ['failure' => ['email_unavailable', 'This email address cannot be used. Choose a different one.']];

            $oldEmail = $user->email;
            $user->person?->forceFill(['email' => $newEmail])->save();
            $user->forceFill(['email' => $newEmail, 'email_verified_at' => now()])->save(); // signs every session out
            $this->audit->recordAuth('account.email_changed', $user);
            app(MailDispatcher::class)->queueOnce($oldEmail, new SecurityNoticeMail('email_changed', $user->person?->first_name, ClinicClock::now()->format('F j, Y g:i A'), SecurityNoticeMail::mask($newEmail)), 'email_changed_notice', $user);

            return ['email' => $newEmail];
        });
        if (isset($result['failure'])) return OneTimeCodes::failure(...$result['failure']);

        return response()->json(['message' => 'Your sign-in email was changed. Sign in again with your new email.', 'data' => ['email' => $result['email']]]);
    }

    private function taken(string $email, User $user): bool
    {
        return User::withTrashed()->where('email', $email)->whereKeyNot($user->id)->exists()
            || Person::where('email', $email)->where('id', '!=', $user->person_id)->exists();
    }
}
