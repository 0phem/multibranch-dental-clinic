<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(\App\Services\Assistant\AssistantProvider::class, \App\Services\Assistant\AnthropicProvider::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\RateLimiter::for('m1-login', function ($request) {
            $email = $request->input('email');
            $email = is_string($email) ? strtolower(trim($email)) : '';
            return [
                \Illuminate\Cache\RateLimiting\Limit::perMinute(30)->by('ip:'.$request->ip()),
                \Illuminate\Cache\RateLimiting\Limit::perMinute(5)->by('account:'.hash('sha256', $email.'|'.$request->ip())),
            ];
        });
        // M7: per ACCOUNT (never per IP, so one Patient cannot spend another's quota). A technical cost/abuse bound, not clinic policy.
        \Illuminate\Support\Facades\RateLimiter::for('m7-assistant', function ($request) {
            $who = 'user:'.($request->user()?->getAuthIdentifier() ?? 'anon:'.$request->ip());
            $respond = fn ($request, array $headers) => response()->json([
                'message' => 'You have asked the assistant a lot of questions. Please wait a moment and try again.',
                'code' => 'assistant_rate_limited', 'retry_after' => (int) ($headers['Retry-After'] ?? 60),
            ], 429, $headers);

            return [
                \Illuminate\Cache\RateLimiting\Limit::perMinute(max(1, (int) config('assistant.rate_per_minute')))->by($who.':m')->response($respond),
                \Illuminate\Cache\RateLimiting\Limit::perHour(max(1, (int) config('assistant.rate_per_hour')))->by($who.':h')->response($respond),
            ];
        });
        \Illuminate\Support\Facades\RateLimiter::for('m1-register', fn ($request) =>
            \Illuminate\Cache\RateLimiting\Limit::perMinute(30)->by($request->ip()));
        \Illuminate\Support\Facades\RateLimiter::for('m1-otp', fn ($request) =>
            \Illuminate\Cache\RateLimiting\Limit::perMinute(30)->by($request->ip()));
    }
}
