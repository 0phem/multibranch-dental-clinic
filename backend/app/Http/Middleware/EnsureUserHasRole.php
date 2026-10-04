<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Backend-authoritative RBAC: the API rejects an unauthorized request regardless of what a client sends or
// hides in its UI. A Staff account's displayed duty-focus title (users.title) is never consulted here — only
// the canonical role column decides access.
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || $user->account_status !== 'Active') {
            abort(403, 'Forbidden.');
        }

        $allowed = collect($roles)->map(fn (string $role) => Role::from($role));

        if (! $allowed->contains(fn (Role $role) => $role === $user->role)) {
            if ($request->is('api/users', 'api/users/*')) {
                $this->auditDenial($user);
            }
            abort(403, 'Forbidden.');
        }

        return $next($request);
    }

    // Denied access to the account-administration routes is a security signal worth auditing, but an authenticated low-privilege
    // account must not be able to write unlimited audit rows by repeating forbidden requests (no throttle covers these routes).
    // The audit WRITE is bounded per account with the framework RateLimiter: the first denials in each window are always
    // recorded; further ones are still refused with 403 (authorization is unchanged) but not written, and the next recorded
    // event says how many were suppressed. The client cannot influence whether an event is written.
    private const DENIAL_AUDIT_MAX = 5;

    private const DENIAL_AUDIT_WINDOW_SECONDS = 60;

    private function auditDenial(\App\Models\User $user): void
    {
        $key = 'm22:access-denied:'.$user->id;
        $suppressedKey = $key.':suppressed';
        if (RateLimiter::tooManyAttempts($key, self::DENIAL_AUDIT_MAX)) {
            Cache::add($suppressedKey, 0, 3600);
            Cache::increment($suppressedKey);

            return;
        }
        RateLimiter::hit($key, self::DENIAL_AUDIT_WINDOW_SECONDS);
        $suppressed = (int) Cache::pull($suppressedKey, 0);
        app(\App\Services\Audit\AuditService::class)->recordSecurity('account.access_denied', $user, $suppressed > 0 ? ['suppressed_since_last_event' => $suppressed] : []);
    }
}
