<?php

// M7 Patient AI Support. Provider credentials come ONLY from server environment configuration and have NO defaults: an unset key,
// model or base URL makes the assistant answer "not configured" (503); nothing is ever faked. Never commit real values.
// The adapter is replaceable (App\Services\Assistant\AssistantProvider); the vendor is not a clinic decision recorded elsewhere.
return [
    'provider' => env('ASSISTANT_PROVIDER'),                 // 'anthropic' (only adapter today); unset = disabled
    'api_key' => env('ASSISTANT_API_KEY'),
    // There is deliberately NO base-URL setting: the Anthropic adapter is pinned to the official origin (see AnthropicProvider).
    'model' => env('ASSISTANT_MODEL'),                       // required, validated; no default model is assumed
    'anthropic_version' => env('ASSISTANT_API_VERSION', '2023-06-01'),
    // Technical cost/abuse bounds (not clinic policy): one attempt, no automatic retry, short answers.
    'timeout_seconds' => (int) env('ASSISTANT_TIMEOUT_SECONDS', 20),
    'max_output_tokens' => (int) env('ASSISTANT_MAX_OUTPUT_TOKENS', 400),
    'max_message_chars' => 500,
    'rate_per_minute' => (int) env('ASSISTANT_RATE_PER_MINUTE', 6),
    'rate_per_hour' => (int) env('ASSISTANT_RATE_PER_HOUR', 60),
];
