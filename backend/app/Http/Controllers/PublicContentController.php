<?php

namespace App\Http\Controllers;

use App\Models\AssistantAnswer;
use App\Models\Service;
use Illuminate\Http\JsonResponse;

/**
 * Public website content (no sign-in), read from the clinic's own records so nothing is hard-coded in the frontend:
 *   GET /api/public/services — active services: name, category, short description and typical duration. No prices (M13).
 *   GET /api/public/faq      — the assistant answers the clinic has CONFIRMED (active, not draft). Drafts never appear here.
 */
class PublicContentController extends Controller
{
    public function services(): JsonResponse
    {
        return response()->json(['data' => Service::where('status', 'Active')->orderBy('category')->orderBy('name')->get()->map(fn (Service $s) => [
            'id' => $s->legacy_ref, 'name' => $s->name, 'category' => $s->category, 'description' => $s->description, 'duration_minutes' => $s->duration_minutes,
        ])->values()]);
    }

    public function faq(): JsonResponse
    {
        return response()->json(['data' => AssistantAnswer::where('active', true)->where('draft', false)->whereNull('branch_id')->orderBy('category')->orderBy('question')->get()
            ->map(fn (AssistantAnswer $a) => ['id' => $a->public_id, 'question' => $a->question, 'answer' => $a->answer, 'category' => $a->category])->values()]);
    }
}
