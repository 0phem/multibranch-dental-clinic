<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Revalidate all authenticated API requests, including routes without role middleware. */
class EnsureAccountAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user()?->fresh();
        $staleSession = Auth::guard('web')->check() && $request->hasSession() &&
            $request->session()->get('auth_version') !== (int) $user?->auth_version;
        if ($staleSession || ! $user || $user->account_status !== 'Active' || ! $user->person ||
            ($user->role->value === 'patient' && ! $user->email_verified_at)) {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
            // Preserve established forbidden responses on role APIs. /me is the
            // authoritative session probe and reports that authentication has ended.
            return response()->json(['message' => 'Your session has ended. Sign in again.', 'code' => 'session_revoked'],
                $request->is('api/me') ? 401 : 403);
        }
        $request->setUserResolver(fn () => $user);
        return $next($request);
    }
}
