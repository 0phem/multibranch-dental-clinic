<?php

namespace App\Http\Controllers\Reference;

use App\Http\Controllers\Controller;
use App\Http\Resources\Reference\ServiceResource;
use App\Models\Service;

// Read-only this phase — no current UI edits the services catalog directly (Phase 2A plan, section H).
class ServiceController extends Controller
{
    public function index()
    {
        return response()->json(['data' => ServiceResource::collection(Service::orderBy('name')->get())]);
    }
}
