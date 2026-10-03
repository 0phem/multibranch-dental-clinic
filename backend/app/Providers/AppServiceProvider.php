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
        //
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
        \Illuminate\Support\Facades\RateLimiter::for('m1-register', fn ($request) =>
            \Illuminate\Cache\RateLimiting\Limit::perMinute(30)->by($request->ip()));
        \Illuminate\Support\Facades\RateLimiter::for('m1-otp', fn ($request) =>
            \Illuminate\Cache\RateLimiting\Limit::perMinute(30)->by($request->ip()));
    }
}
