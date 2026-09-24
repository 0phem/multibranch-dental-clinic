<?php

namespace App\Http\Controllers\Rbac;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

// Proof-of-concept endpoints proving server-side RBAC only (Backend Foundation 1A). Not a business API — do not
// extend this controller with real clinic operations.
class RbacDemoController extends Controller
{
    public function patientOnly(): JsonResponse
    {
        return response()->json(['ok' => true, 'scope' => 'patient']);
    }

    public function staffOnly(): JsonResponse
    {
        return response()->json(['ok' => true, 'scope' => 'staff']);
    }

    public function dentistOnly(): JsonResponse
    {
        return response()->json(['ok' => true, 'scope' => 'dentist']);
    }

    public function ownerOnly(): JsonResponse
    {
        return response()->json(['ok' => true, 'scope' => 'owner']);
    }
}
