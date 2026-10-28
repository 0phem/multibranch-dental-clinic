<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ReadsIdempotencyKey;
use App\Http\Requests\Inquiry\CreateInquiryRequest;
use App\Http\Requests\Inquiry\InquiryCommandRequest;
use App\Http\Resources\InquiryResource;
use App\Models\Branch;
use App\Models\Inquiry;
use App\Services\Inquiries\InquiryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// M16 Staff API (route middleware role:staff). Authorization is the Inquiry::visibleTo scope applied BEFORE any filter or cursor;
// responses are projected by InquiryResource. There is no Patient, Dentist, Owner or guest access and no public submission endpoint.
class InquiryController extends Controller
{
    use ReadsIdempotencyKey;

    private const MAX_PER_PAGE = 100;

    private const RELATIONS = ['branch', 'assignee.person', 'patient.person', 'appointment'];

    public function __construct(private readonly InquiryService $inquiries) {}

    /** Newest first by internal id, keyset-paged (cursor = last public id; unknown or foreign cursors give an empty page). */
    public function index(Request $request): JsonResponse
    {
        $v = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
            'cursor' => ['nullable', 'string', 'size:26'],
            'status' => ['nullable', 'string', 'in:Open,Responded,Closed,Converted'],
            'source' => ['nullable', 'string', 'in:Facebook,Instagram,Website'],
            'branch_ref' => ['nullable', 'string', 'max:64'],
        ]);
        $per = (int) ($v['per_page'] ?? 50);
        $visible = fn () => Inquiry::visibleTo($request->user());
        $query = $visible();
        foreach (['status', 'source'] as $filter) {
            if (! empty($v[$filter])) {
                $query->where($filter, $v[$filter]);
            }
        }
        if (! empty($v['branch_ref'])) {
            // A branch the account cannot see simply matches nothing: the filter never reveals whether it exists.
            $query->where('branch_id', Branch::where('legacy_ref', $v['branch_ref'])->value('id') ?? 0);
        } elseif ($request->user()->staffProfile?->branch_id !== null) {
            $query->where('branch_id', $request->user()->staffProfile->branch_id);
        }
        if (! empty($v['cursor'])) {
            $query->where('id', '<', $visible()->select('id')->where('public_id', strtolower($v['cursor']))->limit(1));
        }
        $rows = $query->with(self::RELATIONS)->orderByDesc('id')->limit($per + 1)->get();
        $page = $rows->take($per)->values();

        return response()->json(['data' => InquiryResource::collection($page)->resolve($request), 'meta' => ['per_page' => $per, 'next_cursor' => $rows->count() > $per ? $page->last()->public_id : null]]);
    }

    /**
     * Authoritative counts for the signed-in Staff member's own scope (the same visibility as the list). A genuine zero is a
     * zero; the client must treat a failed request as "unavailable", never as zero.
     */
    public function summary(Request $request): JsonResponse
    {
        $counts = Inquiry::visibleTo($request->user())->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $by = fn (string $status) => (int) ($counts[$status] ?? 0);

        return response()->json(['data' => ['open' => $by('Open'), 'responded' => $by('Responded'), 'closed' => $by('Closed'), 'converted' => $by('Converted'), 'total' => (int) $counts->sum()]]);
    }

    public function show(Request $request, Inquiry $inquiry): InquiryResource
    {
        abort_unless($inquiry->visibleToUser($request->user()), 403);

        return new InquiryResource($inquiry->load([...self::RELATIONS, 'history']));
    }

    public function store(CreateInquiryRequest $request): JsonResponse
    {
        $v = $request->validated();

        $user = $request->user();
        $profileBranchId = $user->staffProfile?->branch_id;
        $scopeBranchIds = \App\Models\UserBranchScope::where('user_id', $user->id)->pluck('branch_id')->all();
        if (! empty($v['branch_ref'])) {
            $branch = Branch::where('legacy_ref', $v['branch_ref'])->firstOrFail();
            abort_unless($profileBranchId === null || (int) $branch->id === (int) $profileBranchId, 403, 'This branch is outside your active branch assignment.');
        } elseif ($profileBranchId !== null) {
            $branch = Branch::find($profileBranchId);
        } elseif (count($scopeBranchIds) === 1) {
            $branch = Branch::find($scopeBranchIds[0]);
        } else {
            $branch = null;
        }
        abort_unless($branch !== null, 403, 'This branch is outside your access.');

        return $this->inquiries->create($user, $branch, $v['source'], $v['name'], $v['contact'] ?? null, $v['topic'], $this->idempotencyKey($request, true));
    }

    public function respond(InquiryCommandRequest $request, Inquiry $inquiry): JsonResponse
    {
        return $this->command($request, $inquiry, fn ($key) => $this->inquiries->transition($request->user(), $inquiry, 'Responded', (int) $request->validated('expected_revision'), $key));
    }

    public function close(InquiryCommandRequest $request, Inquiry $inquiry): JsonResponse
    {
        return $this->command($request, $inquiry, fn ($key) => $this->inquiries->transition($request->user(), $inquiry, 'Closed', (int) $request->validated('expected_revision'), $key));
    }

    public function convert(InquiryCommandRequest $request, Inquiry $inquiry): JsonResponse
    {
        $appointment = $request->validated('appointment_id');
        if (! $appointment) {
            throw ValidationException::withMessages(['appointment_id' => 'Choose the appointment to link.']);
        }

        return $this->command($request, $inquiry, fn ($key) => $this->inquiries->convert($request->user(), $inquiry, $appointment, (int) $request->validated('expected_revision'), $key));
    }

    private function command(Request $request, Inquiry $inquiry, \Closure $run): JsonResponse
    {
        abort_unless($inquiry->visibleToUser($request->user()), 403);

        return $run($this->idempotencyKey($request, true));
    }
}
