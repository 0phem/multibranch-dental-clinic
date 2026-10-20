<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\DentistProfile;
use App\Models\Patient;
use App\Models\ToothChartEntry;
use App\Models\Treatment;
use App\Models\User;
use App\Models\Visit;
use App\Services\Audit\AuditService;
use App\Services\Automations\AutomationCatalog;
use App\Services\Intake\Guardianship;
use App\Support\ClinicClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * M10 Dental Charts. A Dentist records a finding per tooth (and optional surfaces) from the Owner's status list, with a date, an
 * optional note and an optional treatment link; nothing is ever changed, the current chart is the latest entry per tooth and each
 * tooth's history stays visible. The front desk sees a read-only chart (without notes); the patient (or guardian) a simplified
 * current chart; the Owner no chart content. Teeth are stored in FDI codes; the Owner chooses FDI or Universal labels. The system
 * makes no diagnosis and no suggestion. Writes and front-desk views are audited without notes.
 */
class DentalChartController extends Controller
{
    public const SURFACES = ['M', 'O', 'D', 'B', 'L'];

    public function show(Request $request, Patient $patient): JsonResponse
    {
        $user = $request->user();
        $role = $user->role->value;
        abort_unless(match ($role) {
            'dentist' => $this->dentistMayChart($user, $patient),
            'staff' => $user->can('viewProfile', $patient),
            default => false,
        }, $role === 'owner' ? 403 : 404);
        if ($role === 'staff') app(AuditService::class)->recordAdministrative('chart.viewed', $user, $patient, ['patient' => $patient->public_id]);

        return response()->json(['data' => $this->chart($patient, $role === 'dentist', true)]);
    }

    /** Patient (or guardian for a dependent): the simplified current chart, read-only. */
    public function mine(Request $request): JsonResponse
    {
        $data = $request->validate(['patient_id' => ['nullable', 'string', 'max:40']]);
        $user = $request->user();
        $patient = ! empty($data['patient_id']) ? Patient::where('public_id', $data['patient_id'])->firstOrFail() : $user->patient;
        abort_unless($patient && in_array($patient->id, Guardianship::patientIdsFor($user), true), 404);

        return response()->json(['data' => $this->chart($patient, false, false)]);
    }

    public function store(Request $request, Patient $patient): JsonResponse
    {
        $user = $request->user();
        $me = DentistProfile::where('person_id', $user->person_id)->first();
        abort_unless($user->role->value === 'dentist' && $me && $this->dentistMayChart($user, $patient), 403, 'Only a dentist caring for this patient records the chart.');
        $data = $request->validate(['tooth' => ['required', 'string', 'regex:/^([1-4][1-8]|[5-8][1-5])$/'], 'surfaces' => ['nullable', 'array', 'max:5'], 'surfaces.*' => ['in:'.implode(',', self::SURFACES)],
            'status' => ['required', 'string', 'max:40'], 'note' => ['nullable', 'string', 'max:1000'], 'recorded_on' => ['nullable', 'date_format:Y-m-d'], 'treatment_id' => ['nullable', 'string', 'max:40']]);
        $status = collect($this->settings()['statuses'])->first(fn ($s) => mb_strtolower($s) === mb_strtolower(trim($data['status'])));
        if (! $status) throw ValidationException::withMessages(['status' => ['Choose a status from the clinic’s list.']]);
        $on = $data['recorded_on'] ?? ClinicClock::today();
        if ($on > ClinicClock::today()) throw ValidationException::withMessages(['recorded_on' => ['The date cannot be in the future.']]);
        $treatment = null;
        if (! empty($data['treatment_id'])) {
            $treatment = Treatment::where('public_id', $data['treatment_id'])->whereHas('visit', fn ($v) => $v->where('patient_id', $patient->id))->first();
            if (! $treatment) throw ValidationException::withMessages(['treatment_id' => ['That treatment is not this patient’s.']]);
        }
        $entry = ToothChartEntry::create(['patient_id' => $patient->id, 'tooth' => $data['tooth'], 'surfaces' => array_values(array_unique($data['surfaces'] ?? [])),
            'status' => $status, 'recorded_on' => $on, 'note' => $data['note'] ?? null, 'treatment_id' => $treatment?->id,
            'branch_id' => $treatment?->visit?->branch_id, 'dentist_profile_id' => $me->id, 'created_by_user_id' => $user->id]);
        app(AuditService::class)->recordAdministrative('chart.recorded', $user, $patient, ['entry' => $entry->public_id, 'tooth' => $entry->tooth]); // no status text, no note

        return response()->json(['data' => $this->chart($patient, true, true)], 201);
    }

    // ---- helpers ------------------------------------------------------------------------------------------------------

    /** A Dentist charts a patient who has an appointment or visit at one of their branches. */
    private function dentistMayChart(User $user, Patient $patient): bool
    {
        $branches = DentistProfile::where('person_id', $user->person_id)->first()?->branches()->pluck('branches.id')->all() ?? [];

        return $branches !== [] && (Appointment::where('patient_id', $patient->id)->whereIn('branch_id', $branches)->exists()
            || Visit::where('patient_id', $patient->id)->whereIn('branch_id', $branches)->exists());
    }

    private function settings(): array
    {
        return (array) (AutomationCatalog::setting('dental_chart')?->settings ?? ['numbering' => 'fdi', 'statuses' => []]);
    }

    private function chart(Patient $patient, bool $notes, bool $history): array
    {
        $entries = ToothChartEntry::where('patient_id', $patient->id)->with('dentist.person')->orderBy('id')->get();
        $view = fn (ToothChartEntry $e) => ['id' => $e->public_id, 'tooth' => $e->tooth, 'surfaces' => $e->surfaces ?? [], 'status' => $e->status,
            'recorded_on' => substr((string) $e->getRawOriginal('recorded_on'), 0, 10), 'dentist' => $e->dentist ? 'Dr. '.$e->dentist->person?->fullName() : null]
            + ($notes ? ['note' => $e->note] : []);
        $current = $entries->groupBy('tooth')->map(fn ($list) => $view($list->last()));

        return ['patient' => ['id' => $patient->public_id, 'name' => $patient->person?->fullName()], 'settings' => $this->settings(), 'surfaces' => self::SURFACES,
            'current' => $current->values(), 'history' => $history ? $entries->reverse()->map($view)->values() : null];
    }
}
