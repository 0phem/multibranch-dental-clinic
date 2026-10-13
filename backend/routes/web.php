<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// DEV ONLY: email design previews with sample data (nothing is sent, nothing is read). Registered only when APP_ENV=local,
// so a production build — including a cached route file — never exposes it.
if (app()->environment('local')) {
    Route::get('/dev/mail', [\App\Http\Controllers\Dev\MailPreviewController::class, 'index']);
    Route::get('/dev/mail/{template}', [\App\Http\Controllers\Dev\MailPreviewController::class, 'show']);
    Route::get('/dev/mail/pdf/{document}', [\App\Http\Controllers\Dev\MailPreviewController::class, 'pdf']);
}
