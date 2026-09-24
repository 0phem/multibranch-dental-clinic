<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class CurrentUserController extends Controller
{
    public function show(Request $request)
    {
        // Explicit response()->json() rather than returning the Resource directly: JsonResource::toResponse()
        // auto-sets status 201 when the wrapped model's wasRecentlyCreated flag is true, which can still be set
        // on the guard's cached user instance right after registration's auto-login. This endpoint is always a
        // 200 read.
        return response()->json([
            'data' => new UserResource($request->user()->load(['person', 'patient'])),
        ]);
    }
}
