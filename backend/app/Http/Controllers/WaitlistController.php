<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\Service;
use App\Models\WaitlistEntry;
use App\Services\Automations\AutomationCatalog;
use App\Services\Automations\WaitlistOpenings;
use App\Services\Scheduling\SchedulingService;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * A5 Patient waitlist: "Notify me if a time opens" on a fully booked day. Only the Patient's own entries; one waiting entry per
 * branch, service and day. Refused when the day has open times (book instead), is closed, past or outside the booking window,
 * or when the Owner switched the waitlist off. Cancelling closes the entry (never deleted).
 */
class WaitlistController extends Controller
{
    public function mine(Request $request): JsonResponse
    {
        $patient = $request->user()->patient;
        $rows = WaitlistEntry::where('patient_id', $patient?->id ?? 0)->where('clinic_date', '>=', ClinicClock::today())
            ->with(['branch', 'service', 'dentist.person'])->orderBy('clinic_date')->get();

        return response()->json(['data' => $rows->map(fn ($e) => $this->view($e))->values(), 'meta' => ['enabled' => (bool) AutomationCatalog::setting('waitlist')?->enabled]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['branch_ref' => ['required', 'string', 'max:50'], 'service_ref' => ['required', 'string', 'max:50'],
            'dentist_ref' => ['nullable', 'string', 'max:50'], 'date' => ['required', 'date_format:Y-m-d']]);
        $patient = $request->user()->patient;
        abort_unless($patient, 403);
        if (! AutomationCatalog::setting('waitlist')?->enabled) throw ValidationException::withMessages(['date' => ['The waitlist is switched off by the clinic.']]);
        $branch = Branch::where('legacy_ref', $data['branch_ref'])->firstOrFail();
        $service = Service::where('legacy_ref', $data['service_ref'])->firstOrFail();
        $dentist = ! empty($data['dentist_ref']) ? DentistProfile::where('legacy_ref', $data['dentist_ref'])->firstOrFail() : null;
        [$first, $last] = app(SchedulingService::class)->patientWindow();
        if ($data['date'] < $first || $data['date'] > $last) throw ValidationException::withMessages(['date' => ['Choose a day inside the booking window.']]);
        if (! SchedulingService::openOn($branch, $data['date'])) throw ValidationException::withMessages(['date' => ['The branch is closed on that day.']]);
        $entry = new WaitlistEntry(['patient_id' => $patient->id, 'branch_id' => $branch->id, 'service_id' => $service->id, 'dentist_profile_id' => $dentist?->id, 'clinic_date' => $data['date'], 'status' => 'waiting']);
        $entry->setRelation('patient', $patient)->setRelation('branch', $branch)->setRelation('service', $service)->setRelation('dentist', $dentist);
        if (app(WaitlistOpenings::class)->hasOpening($entry, CarbonImmutable::now())) throw ValidationException::withMessages(['date' => ['Times are open on this day. Choose a time to book instead.']]);
        $existing = WaitlistEntry::where(['patient_id' => $patient->id, 'branch_id' => $branch->id, 'service_id' => $service->id, 'clinic_date' => $data['date'], 'status' => 'waiting'])->first();
        if ($existing) return response()->json(['data' => $this->view($existing->load(['branch', 'service', 'dentist.person']))]);
        $entry->save();

        return response()->json(['data' => $this->view($entry->fresh(['branch', 'service', 'dentist.person']))], 201);
    }

    public function cancel(Request $request, WaitlistEntry $waitlistEntry): JsonResponse
    {
        abort_unless($waitlistEntry->patient_id === $request->user()->patient?->id, 404);
        if ($waitlistEntry->status === 'waiting') $waitlistEntry->update(['status' => 'cancelled', 'closed_at' => ClinicClock::now()]);

        return response()->json(['data' => $this->view($waitlistEntry->fresh(['branch', 'service', 'dentist.person']))]);
    }

    private function view(WaitlistEntry $e): array
    {
        return ['id' => $e->public_id, 'date' => $e->dateString(), 'status' => $e->status, 'branch' => $e->branch?->name, 'service' => $e->service?->name,
            'dentist' => $e->dentist?->person ? 'Dr. '.$e->dentist->person->first_name.' '.$e->dentist->person->last_name : null,
            'notified_at' => $e->notified_at?->toIso8601String()];
    }
}
