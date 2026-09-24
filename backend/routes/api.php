<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredPatientController;
use App\Http\Controllers\CurrentUserController;
use App\Http\Controllers\Rbac\RbacDemoController;
use Illuminate\Support\Facades\Route;

// Public identity/auth boundary (Backend Foundation 1A). The one thing a stranger may do is create their own
// Patient identity — see RegisteredPatientController.
Route::post('/register', [RegisteredPatientController::class, 'store']);
Route::post('/login', [AuthenticatedSessionController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('/me', [CurrentUserController::class, 'show']);

    // RBAC proof-of-concept endpoints only (Backend Foundation 1A). Deliberately separate from any future
    // business API — do not add real clinic operations here.
    Route::prefix('rbac-demo')->group(function () {
        Route::get('/patient-only', [RbacDemoController::class, 'patientOnly'])->middleware('role:patient');
        Route::get('/staff-only', [RbacDemoController::class, 'staffOnly'])->middleware('role:staff');
        Route::get('/dentist-only', [RbacDemoController::class, 'dentistOnly'])->middleware('role:dentist');
        Route::get('/owner-only', [RbacDemoController::class, 'ownerOnly'])->middleware('role:owner');
    });
});
