<?php

namespace App\Services\Auth;

use Illuminate\Support\Facades\RateLimiter;

/**
 * M1 send limits for one-time codes and account notices, applied BEFORE any account lookup so the answer never depends
 * on whether the address belongs to an account:
 *   - per email + IP: clinic.otp_hourly_per_email_ip per hour (shared by every purpose; it only ever limits the caller's own IP);
 *   - per email (any IP): clinic.otp_daily_per_email per 24 hours, counted in SEPARATE buckets:
 *       'account'  registration codes, resends, the "someone tried to register" notice and email-change codes (for the new address);
 *       'reset'    password-reset codes.
 *     Exhausting one bucket for someone else's address (from many IPs) cannot block the other: a flood of registration attempts
 *     never stops the owner from resetting their password, and the reverse. See docs/M1_ACCOUNT_SECURITY.md for what remains.
 * Keys hold a hash of the address, never the address itself.
 */
class OtpThrottle
{
    public const ACCOUNT = 'account';
    public const RESET = 'reset';

    /** Counts one send request. Returns null when allowed, or the seconds until the next request may be made. */
    public function hit(string $email, string $ip, string $bucket = self::ACCOUNT): ?int
    {
        if (! in_array($bucket, [self::ACCOUNT, self::RESET], true)) throw new \InvalidArgumentException("Unknown OTP bucket '$bucket'.");
        $email = strtolower(trim($email));
        $hourly = 'otp-send:hour:'.sha1($email.'|'.$ip);
        $daily = "otp-send:day:{$bucket}:".sha1($email);
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
