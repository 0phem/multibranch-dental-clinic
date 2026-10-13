<?php

return [
    // M1 employee invitations (PI-02: invitation by email). The validity period is an engineering default pending the
    // clinic's answer on invitation expiry; change it here or with EMPLOYEE_INVITATION_EXPIRE_HOURS.
    'invitation_expire_hours' => (int) env('EMPLOYEE_INVITATION_EXPIRE_HOURS', 72),

    // M18 durable email (engineering defaults; the clinic has not set retry policy). A failed send is retried at most
    // mail_max_attempts times in total, waiting mail_retry_backoff_seconds between tries; a claim older than
    // mail_processing_timeout_seconds is treated as a crashed worker and retaken (at-least-once delivery).
    'mail_max_attempts' => (int) env('MAIL_MAX_ATTEMPTS', 4),
    'mail_retry_backoff_seconds' => [60, 300, 900],
    'mail_processing_timeout_seconds' => (int) env('MAIL_PROCESSING_TIMEOUT_SECONDS', 600),

    // M1 one-time codes (registration, password reset, email change). Engineering security defaults, not clinic policy:
    // a code lives otp_ttl_minutes, allows otp_max_attempts wrong entries, and a new one can be requested after
    // otp_resend_cooldown_seconds. Sends are capped per email+IP per hour and per email per day (every purpose counts,
    // including the "someone tried to register with your email" notice, so no address can be flooded).
    'otp_ttl_minutes' => 10,
    'otp_max_attempts' => 5,
    'otp_resend_cooldown_seconds' => 60,
    'otp_hourly_per_email_ip' => (int) env('OTP_HOURLY_PER_EMAIL_IP', 5),
    'otp_daily_per_email' => (int) env('OTP_DAILY_PER_EMAIL', 10),

    // Optional contact address printed in email footers. Empty = no address is shown (none is invented).
    'support_email' => env('CLINIC_SUPPORT_EMAIL'),
];
