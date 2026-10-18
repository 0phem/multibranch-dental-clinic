<?php

namespace App\Http\Controllers\Reference;

use App\Http\Controllers\Controller;
use App\Http\Resources\Reference\ServiceResource;
use App\Models\Service;

// Read-only catalog, except the Owner's online booking mode per service (F7, R2-17).
class ServiceController extends Controller
{
    /** Owner: bookable online, consultation first (pointing to an active bookable service) or not shown online. Audited. */
    public function onlineBooking(\Illuminate\Http\Request $request, Service $service)
    {
        $data = $request->validate(['online_booking' => ['required', 'in:bookable,consultation_first,hidden'], 'consultation_ref' => ['nullable', 'string', 'max:50', 'required_if:online_booking,consultation_first']]);
        $consultation = null;
        if ($data['online_booking'] === 'consultation_first') {
            $consultation = Service::where('legacy_ref', $data['consultation_ref'])->first();
            if (! $consultation || $consultation->id === $service->id || $consultation->status !== 'Active' || $consultation->online_booking !== 'bookable') {
                throw \Illuminate\Validation\ValidationException::withMessages(['consultation_ref' => ['Choose another active service that patients can book online.']]);
            }
        }
        $old = ['online_booking' => $service->online_booking, 'consultation_service_id' => $service->consultation_service_id];
        $service->forceFill(['online_booking' => $data['online_booking'], 'consultation_service_id' => $consultation?->id])->save();
        app(\App\Services\Audit\AuditService::class)->recordAdministrative('service.online_booking_updated', $request->user(), $service,
            ['old' => $old, 'new' => ['online_booking' => $service->online_booking, 'consultation' => $consultation?->legacy_ref]]);

        return response()->json(['data' => new ServiceResource($service->fresh())]);
    }

    public function index()
    {
        return response()->json(['data' => ServiceResource::collection(Service::orderBy('name')->get())]);
    }
}
