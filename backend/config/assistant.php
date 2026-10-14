<?php

// M7 Clinic Assistant (patient portal). Two ways of answering:
//   knowledge — no AI: answers from the clinic's editable answers (Administration → Assistant answers) and live clinic records,
//               on the clinic server. Nothing a Patient types leaves the system. Also used whenever the AI is unavailable.
//   ai        — Claude answers on the SERVER, grounded in clinic data through server-side tools (needs ANTHROPIC_API_KEY).
// ASSISTANT_MODE: knowledge | ai | auto (default: AI when a key is set, otherwise knowledge).
// The key lives only in backend/.env and is sent only to the official Anthropic origin (App\Services\Assistant\AnthropicProvider).
// Never commit real values.
return [
    'mode' => in_array(env('ASSISTANT_MODE', 'auto'), ['knowledge', 'ai', 'auto'], true) ? env('ASSISTANT_MODE', 'auto') : 'auto',
    'api_key' => env('ANTHROPIC_API_KEY', env('ASSISTANT_API_KEY')),
    // A small, fast model; change it here without a code change. Must be a valid model id.
    'model' => env('ASSISTANT_MODEL', 'claude-haiku-5-5'),
    'anthropic_version' => env('ASSISTANT_API_VERSION', '2023-06-01'),
    // Technical cost/abuse bounds (engineering defaults, not clinic policy).
    'timeout_seconds' => (int) env('ASSISTANT_TIMEOUT_SECONDS', 25),
    'max_output_tokens' => (int) env('ASSISTANT_MAX_OUTPUT_TOKENS', 500),
    'max_tool_rounds' => 4,
    'max_message_chars' => 500,
    'max_history_turns' => 6,
    'rate_per_minute' => (int) env('ASSISTANT_RATE_PER_MINUTE', 6),
    'rate_per_hour' => (int) env('ASSISTANT_RATE_PER_HOUR', 60),
    // Questions per Patient per clinic day (Asia/Manila); counted from the assistant_usage log.
    'daily_cap' => (int) env('ASSISTANT_DAILY_CAP', 40),
];
