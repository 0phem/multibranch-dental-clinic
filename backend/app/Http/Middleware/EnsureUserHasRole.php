<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
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
            abort(403, 'Forbidden.');
        }

        return $next($request);
    }
}
