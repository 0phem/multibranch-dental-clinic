<?php

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\RegisteredPatientController;
use App\Http\Controllers\CurrentUserController;
use App\Http\Controllers\HmoController;
use App\Http\Controllers\PatientDirectoryController;
use App\Http\Controllers\PatientRegistrationController;
use App\Http\Controllers\PricingController;
use App\Http\Controllers\QueueController;
use App\Http\Controllers\TreatmentController;
use App\Http\Controllers\UserBranchScopeController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\AutomationController;
use App\Http\Controllers\AnalyticsController;
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
Route::post('/register/verify', [EmailVerificationController::class, 'verify']);
Route::post('/register/resend', [EmailVerificationController::class, 'resend']);
Route::post('/login', [AuthenticatedSessionController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('/me', [CurrentUserController::class, 'show']);

    // M11 server-authoritative billing. Legacy browser invoices remain read-only presentation data.
    Route::prefix('invoices')->group(function () {
        Route::get('/mine', [BillingController::class, 'mine'])->middleware('role:patient');
        Route::get('/', [BillingController::class, 'index'])->middleware('role:staff,owner');
        Route::post('/from-treatment/{treatment}', [BillingController::class, 'create'])->middleware('role:staff');
        Route::get('/{invoice}', [BillingController::class, 'show'])->middleware('role:patient,staff,owner');
        Route::post('/{invoice}/review', [BillingController::class, 'review'])->middleware('role:staff');
        Route::post('/{invoice}/issue', [BillingController::class, 'issue'])->middleware('role:staff');
        Route::post('/{invoice}/payment', [BillingController::class, 'pay'])->middleware('role:staff');
    });
    Route::get('/receipts/mine', [BillingController::class, 'receiptsMine'])->middleware('role:patient');
    Route::get('/billing/treatments', [BillingController::class, 'treatments'])->middleware('role:staff,owner');

    // M14 Patient Forms, Documents & Consent Management
    Route::prefix('documents')->group(function () {
        Route::get('/mine', [DocumentController::class, 'mine'])->middleware('role:patient');
        Route::get('/', [DocumentController::class, 'index'])->middleware('role:staff,dentist,owner');
        Route::post('/', [DocumentController::class, 'store']);
        Route::get('/{document}', [DocumentController::class, 'show']);
        Route::get('/{document}/download', [DocumentController::class, 'download']);
        Route::post('/{document}/retract', [DocumentController::class, 'retract']);
    });
    Route::get('/consents/mine', [DocumentController::class, 'consentsMine'])->middleware('role:patient');
    Route::get('/patients/{patient}/consents', [DocumentController::class, 'consents']);
    Route::post('/patients/{patient}/consents', [DocumentController::class, 'grantConsent']);
    Route::post('/patients/{patient}/consents/{consent}/withdraw', [DocumentController::class, 'withdrawConsent']);

    // M22 Audit Trail & Activity Monitoring Management (Owner only)
    Route::prefix('audit-logs')->middleware('role:owner')->group(function () {
        Route::get('/', [AuditController::class, 'index']);
        Route::get('/export', [AuditController::class, 'export']);
        Route::get('/{auditLog}', [AuditController::class, 'show']);
    });

    // M23 Integrated Workflow & Automation Control (Owner only)
    Route::prefix('automation')->middleware('role:owner')->group(function () {
        Route::get('/snapshot', [AutomationController::class, 'snapshot']);
        Route::get('/rules', [AutomationController::class, 'rules']);
        Route::get('/actions', [AutomationController::class, 'actions']);
        Route::post('/dispatch', [AutomationController::class, 'dispatch']);
        Route::get('/export-csv', [AutomationController::class, 'exportCsv']);
    });

    // M21 Operational Analytics & Executive Intelligence (Owner only)
    Route::prefix('analytics')->middleware('role:owner')->group(function () {
        Route::get('/executive-summary', [AnalyticsController::class, 'executiveSummary']);
        Route::get('/branch-performance', [AnalyticsController::class, 'branchPerformance']);
        Route::get('/export', [AnalyticsController::class, 'export']);
    });

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

    // M13 pricing foundation: Owner-confirmed, effective-dated price versions (the only authoritative price source;
    // services.reference_fee_php stays reference/demo data). Owner manages and reads history; Staff may resolve only
    // today's price within their branch scope.
    Route::get('/service-prices', [PricingController::class, 'index'])->middleware('role:owner');
    Route::post('/service-prices/{servicePrice}/retract', [PricingController::class, 'retract'])->middleware('role:owner');
    Route::get('/services/{service:legacy_ref}/prices', [PricingController::class, 'history'])->middleware('role:owner');
    Route::post('/services/{service:legacy_ref}/prices', [PricingController::class, 'store'])->middleware('role:owner');
    Route::get('/prices/resolve', [PricingController::class, 'resolve'])->middleware('role:staff,owner');

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

    // Minimal M12 HMO foundation. {visit}/{hmoCase} bind on the ULID public_id; {patient} on the Patient public_id. Staff
    // operate cases within the Visit's branch scope and change a Patient's (global) membership only through an in-scope
    // Visit of that Patient (POST /visits/{visit}/hmo-membership); Owner and a responsible Dentist read;
    // Patients read only their own cases (/mine). Every mutation needs an Idempotency-Key (and expected_revision on a case).
    Route::prefix('patients/{patient:public_id}/hmo-membership')->group(function () {
        Route::get('/', [HmoController::class, 'membership'])->middleware('role:staff,owner');
    });
    Route::get('/hmo/claim-decisions', [HmoController::class, 'claimDecisions'])->middleware('role:staff,owner');
    Route::prefix('hmo-cases')->group(function () {
        Route::get('/mine', [HmoController::class, 'mine'])->middleware('role:patient');
        Route::get('/', [HmoController::class, 'index'])->middleware('role:staff,dentist,owner');
        Route::get('/{hmoCase}', [HmoController::class, 'show'])->middleware('role:staff,dentist,owner');
        Route::post('/{hmoCase}/requirements/{rule}', [HmoController::class, 'requirement'])->middleware('role:staff');
        Route::post('/{hmoCase}/submit', [HmoController::class, 'submit'])->middleware('role:staff');
        Route::post('/{hmoCase}/contact', [HmoController::class, 'contact'])->middleware('role:staff');
        Route::post('/{hmoCase}/escalate', [HmoController::class, 'escalate'])->middleware('role:staff');
        Route::post('/{hmoCase}/response', [HmoController::class, 'respond'])->middleware('role:staff');
        Route::post('/{hmoCase}/withdraw', [HmoController::class, 'withdraw'])->middleware('role:staff');
    });

    // M5 Treatment & Clinical Workflow. {treatment} binds on the ULID public_id. Reads are role-scoped and projected per
    // role (TreatmentPolicy); documentation and completion are named commands of the responsible Dentist only.
    Route::prefix('treatments')->group(function () {
        Route::get('/mine', [TreatmentController::class, 'mine'])->middleware('role:patient');
        Route::get('/', [TreatmentController::class, 'index'])->middleware('role:staff,dentist,owner');
        Route::get('/{treatment}', [TreatmentController::class, 'show'])->middleware('role:staff,dentist,owner');
        Route::post('/{treatment}/document', [TreatmentController::class, 'document'])->middleware('role:dentist');
        Route::post('/{treatment}/complete', [TreatmentController::class, 'complete'])->middleware('role:dentist');
    });

    // M8 Patient Check-In and the shared Visit / Clinical Encounter. {visit} binds on the ULID public_id. Patients have
    // no Visit API in this wave (D9). Per-record access is decided by VisitPolicy.
    Route::prefix('visits')->group(function () {
        Route::get('/', [VisitController::class, 'index'])->middleware('role:staff,dentist,owner');
        Route::post('/check-in', [VisitController::class, 'checkIn'])->middleware('role:staff,owner');
        Route::post('/walk-in', [VisitController::class, 'walkIn'])->middleware('role:staff,owner');
        Route::get('/{visit}', [VisitController::class, 'show'])->middleware('role:staff,dentist,owner');
        // M5: starting treatment is the atomic Treatment command (Queue Served + Visit/appointment In Treatment +
        // Treatment created). There is no standalone Visit start-treatment or complete endpoint.
        Route::post('/{visit}/treatment', [TreatmentController::class, 'start'])->middleware('role:dentist');
        // M12: open the Visit's HMO case, or record the explicit self-pay / no-claim decision (terminal Withdrawn).
        Route::post('/{visit}/hmo-membership', [HmoController::class, 'setMembership'])->middleware('role:staff');
        Route::post('/{visit}/hmo-membership/end', [HmoController::class, 'endMembership'])->middleware('role:staff');
        Route::post('/{visit}/hmo-case', [HmoController::class, 'open'])->middleware('role:staff');
        Route::post('/{visit}/hmo/self-pay', [HmoController::class, 'selfPay'])->middleware('role:staff');
        Route::get('/{visit}/hmo-gate', [HmoController::class, 'gate'])->middleware('role:staff,owner');
    });

    // M9 Patient Queue Management. {queueEntry} binds on the ULID public_id. Entries are created only by M8 arrival; state
    // changes are named commands (Idempotency-Key + expected_revision). Patients get only their own current queue state.
    Route::prefix('queue')->group(function () {
        Route::get('/mine', [QueueController::class, 'mine'])->middleware('role:patient');
        Route::get('/', [QueueController::class, 'index'])->middleware('role:staff,dentist,owner');
        Route::get('/{queueEntry}', [QueueController::class, 'show'])->middleware('role:staff,dentist,owner');
        Route::post('/{queueEntry}/priority', [QueueController::class, 'priority'])->middleware('role:staff,owner');
        Route::post('/{queueEntry}/{command}', [QueueController::class, 'transition'])
            ->whereIn('command', ['call', 'ready', 'away', 'return'])
            ->middleware('role:staff,dentist,owner');
    });
});
