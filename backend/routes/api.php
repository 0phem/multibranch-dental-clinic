<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredPatientController;
use App\Http\Controllers\CurrentUserController;
use App\Http\Controllers\UserManagementController;
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
});
