<?php

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredPatientController;
use App\Http\Controllers\CurrentUserController;
use App\Http\Controllers\PatientDirectoryController;
use App\Http\Controllers\PatientRegistrationController;
use App\Http\Controllers\UserBranchScopeController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\Rbac\RbacDemoController;
use App\Http\Controllers\Reference\BranchController;
use App\Http\Controllers\Reference\BranchServiceController;
use App\Http\Controllers\Reference\DentistProfileController;
use App\Http\Controllers\Reference\ServiceController;
use App\Http\Controllers\Reference\StaffProfileController;
use Illuminate\Support\Facades\Route;

// Public identity/auth boundary (Backend Foundation 1A). The one thing a stranger may do is create their own
// Patient identity — see RegisteredPatientController.
Route::post('/register', [RegisteredPatientController::class, 'store']);
Route::post('/login', [AuthenticatedSessionController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('/me', [CurrentUserController::class, 'show']);

    // M1 User Management is a separate backend-authoritative account collection. It intentionally does not
    // replace the transitional frontend state.users collection or provision Staff/Dentist profiles.
    Route::prefix('users')->middleware('role:owner')->group(function () {
        Route::get('/', [UserManagementController::class, 'index']);
        Route::post('/', [UserManagementController::class, 'store']);
        Route::patch('/{user}', [UserManagementController::class, 'update']);
        Route::delete('/{user}', [UserManagementController::class, 'destroy']);
        // Staff authorization branch scopes (user_branch_scopes). {user} binds on the ULID public_id. PUT replaces
        // the whole set, so it is idempotent; an empty list removes all access.
        Route::get('/{user}/branch-scopes', [UserBranchScopeController::class, 'show']);
        Route::put('/{user}/branch-scopes', [UserBranchScopeController::class, 'update']);
    });

    // RBAC proof-of-concept endpoints only (Backend Foundation 1A). Deliberately separate from any future
    // business API — do not add real clinic operations here.
    Route::prefix('rbac-demo')->group(function () {
        Route::get('/patient-only', [RbacDemoController::class, 'patientOnly'])->middleware('role:patient');
        Route::get('/staff-only', [RbacDemoController::class, 'staffOnly'])->middleware('role:staff');
        Route::get('/dentist-only', [RbacDemoController::class, 'dentistOnly'])->middleware('role:dentist');
        Route::get('/owner-only', [RbacDemoController::class, 'ownerOnly'])->middleware('role:owner');
    });

    // Phase 2A reference data (see the Phase 2A plan). Read routes: any authenticated role except where
    // noted. Mutation routes: role:owner only, wiring exactly what the existing Admin UI already does — no
    // create/delete endpoints exist here because no current UI exercises one. All {branch}/{staffProfile}/
    // {dentistProfile} route parameters resolve via each model's legacy_ref (getRouteKeyName()), never the
    // internal bigint id.
    Route::get('/branches', [BranchController::class, 'index']);
    Route::patch('/branches/{branch}', [BranchController::class, 'update'])->middleware('role:owner');
    Route::get('/branches/{branch}/services', [BranchController::class, 'servicesForBranch']);

    Route::get('/services', [ServiceController::class, 'index']);

    Route::get('/branch-services', [BranchServiceController::class, 'index']);
    Route::post('/branch-services', [BranchServiceController::class, 'store'])->middleware('role:owner');

    // Least privilege: Patient has no current workflow needing the Staff directory (plan section H/I).
    Route::get('/staff', [StaffProfileController::class, 'index'])->middleware('role:staff,dentist,owner');
    Route::patch('/staff/{staffProfile}', [StaffProfileController::class, 'update'])->middleware('role:owner');

    Route::get('/dentists', [DentistProfileController::class, 'index']);
    Route::patch('/dentists/{dentistProfile}', [DentistProfileController::class, 'update'])->middleware('role:owner');

    // Minimal M4 Patient directory for Staff/Owner selection (public ids only; not the full M4 record).
    Route::get('/patients', [PatientDirectoryController::class, 'index'])->middleware('role:staff,owner');
    // Minimal M4 front-desk registration for walk-ins: Person + Patient, no login account (decision D4).
    Route::post('/patients', [PatientRegistrationController::class, 'store'])->middleware('role:staff,owner');

    // M6 Appointment Booking & Smart Scheduling. {appointment} binds on the ULID public_id. State changes are named
    // commands only (no generic status PATCH); per-record access is decided by AppointmentPolicy. Dentists may read
    // their own assigned appointments but cannot book, reschedule or cancel.
    Route::prefix('appointments')->group(function () {
        Route::get('/', [AppointmentController::class, 'index'])->middleware('role:patient,staff,dentist,owner');
        Route::get('/availability', [AppointmentController::class, 'availability'])->middleware('role:patient,staff,owner');
        Route::get('/recommendation', [AppointmentController::class, 'recommendation'])->middleware('role:patient');
        Route::post('/', [AppointmentController::class, 'store'])->middleware('role:patient,staff,owner');
        Route::get('/{appointment}', [AppointmentController::class, 'show'])->middleware('role:patient,staff,dentist,owner');
        Route::post('/{appointment}/reschedule', [AppointmentController::class, 'reschedule'])->middleware('role:patient,staff,owner');
        Route::post('/{appointment}/cancel', [AppointmentController::class, 'cancel'])->middleware('role:patient,staff,owner');
        // The pre-arrival No-show (the Patient did not arrive; no Visit). Check-In and treatment start/completion are
        // Visit commands below — there is no second appointment path for them.
        Route::post('/{appointment}/{command}', [AppointmentController::class, 'transition'])
            ->whereIn('command', ['no-show'])
            ->middleware('role:staff,owner');
    });

    // M8 Patient Check-In and the shared Visit / Clinical Encounter. {visit} binds on the ULID public_id. Patients have
    // no Visit API in this wave (D9). Per-record access is decided by VisitPolicy.
    Route::prefix('visits')->group(function () {
        Route::get('/', [VisitController::class, 'index'])->middleware('role:staff,dentist,owner');
        Route::post('/check-in', [VisitController::class, 'checkIn'])->middleware('role:staff,owner');
        Route::post('/walk-in', [VisitController::class, 'walkIn'])->middleware('role:staff,owner');
        Route::get('/{visit}', [VisitController::class, 'show'])->middleware('role:staff,dentist,owner');
        Route::post('/{visit}/start-treatment', [VisitController::class, 'startTreatment'])->middleware('role:dentist');
        Route::post('/{visit}/complete', [VisitController::class, 'complete'])->middleware('role:dentist');
    });
});
