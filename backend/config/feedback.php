<?php

// M26 technical submission bounds per account (storage amplification). Not a clinic feedback-frequency policy; multi-instance deployments need a shared cache.
return [
    'per_minute' => (int) env('FEEDBACK_RATE_PER_MINUTE', 5),
    'per_hour' => (int) env('FEEDBACK_RATE_PER_HOUR', 30),
];
