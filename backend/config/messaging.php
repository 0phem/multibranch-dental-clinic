<?php

// M17 technical send bounds per account (spam/storage amplification). Not clinic policy; multi-instance deployments need a shared cache.
return [
    'per_minute' => (int) env('MESSAGING_RATE_PER_MINUTE', 20),
    'per_hour' => (int) env('MESSAGING_RATE_PER_HOUR', 200),
];
