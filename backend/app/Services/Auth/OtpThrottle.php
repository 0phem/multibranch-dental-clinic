<?php

namespace App\Services\Auth;

use Illuminate\Support\Facades\RateLimiter;

/**
 * M1 send limits for one-time codes and account notices, applied BEFORE any account lookup so the answer never depends
 * on whether the address belongs to an account:
 *   - per email + IP: clinic.otp_hourly_per_email_ip per hour;
 *   - per email (any IP): clinic.otp_daily_per_email per 24 hours.
 * Keys hold a hash of the address, never the address itself.
 */
class OtpThrottle
{
    /** Counts one send request. Returns null when allowed, or the seconds until the next request may be made. */
    public function hit(string $email, string $ip): ?int
    {
        $email = strtolower(trim($email));
        $hourly = 'otp-send:hour:'.sha1($email.'|'.$ip);
        $daily = 'otp-send:day:'.sha1($email);
        foreach ([[$daily, (int) config('clinic.otp_daily_per_email', 10)], [$hourly, (int) config('clinic.otp_hourly_per_email_ip', 5)]] as [$key, $max]) {
            if (RateLimiter::tooManyAttempts($key, max(1, $max))) return max(1, RateLimiter::availableIn($key));
        }
        RateLimiter::hit($daily, 86400);
        RateLimiter::hit($hourly, 3600);

        return null;
    }

    public static function limited(int $retryAfter)
    {
        return response()->json([
            'message' => 'Too many code requests for this email. Please try again later.',
            'code' => 'otp_rate_limited',
            'retry_after' => $retryAfter,
        ], 429);
    }
}
