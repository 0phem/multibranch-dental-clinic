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
];
