<?php

namespace App\Http\Controllers;

use App\Models\NoShowFlag;
use App\Models\UserBranchScope;
use App\Services\Automations\NoShowDetection;
use App\Support\ClinicClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * A2 front desk: today's possible no-shows in the user's branches, with confirm (the existing No-show command) and undo.
 * Owner sees every branch; Staff only their branch scopes.
 */
class NoShowFlagController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = NoShowFlag::where('status', 'open')->with(['appointment.patient.person', 'appointment.branch', 'appointment.service'])->orderBy('flagged_at');
        if ($user->role->value === 'staff') $query->whereIn('branch_id', UserBranchScope::select('branch_id')->where('user_id', $user->id));

        return response()->json(['data' => $query->get()->map(fn (NoShowFlag $f) => $this->view($f))->values()]);
    }

    public function confirm(Request $request, NoShowFlag $noShowFlag): JsonResponse
    {
        Gate::authorize('transition', [$noShowFlag->appointment, 'no-show']);

        return response()->json(['data' => $this->view(app(NoShowDetection::class)->confirm($noShowFlag, $request->user()))]);
    }

    public function dismiss(Request $request, NoShowFlag $noShowFlag): JsonResponse
    {
        Gate::authorize('transition', [$noShowFlag->appointment, 'no-show']);

        return response()->json(['data' => $this->view(app(NoShowDetection::class)->dismiss($noShowFlag, $request->user()))]);
    }

    private function view(NoShowFlag $f): array
    {
        $a = $f->appointment;
        $p = $a?->patient?->person;

        return ['id' => $f->public_id, 'status' => $f->status, 'flagged_at' => $f->flagged_at?->toIso8601String(),
            'appointment' => $a ? ['id' => $a->public_id, 'code' => $a->appointment_code, 'revision' => $a->revision, 'status' => $a->status,
                'starts_at' => $a->starts_at?->toIso8601String(), 'time' => ClinicClock::local($a->starts_at)->format('g:i A'),
                'patient' => $p ? trim($p->first_name.' '.$p->last_name) : null, 'branch' => $a->branch?->name, 'service' => $a->service?->name] : null];
    }
}
