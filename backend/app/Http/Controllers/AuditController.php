<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditController extends Controller
{
    private function authorizeOwner(Request $request): void
    {
        abort_unless($request->user() && $request->user()->role === Role::Owner, 403, 'Audit trail inspection is restricted to the clinic Owner.');
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $query = AuditLog::with(['actor.person', 'branch'])
            ->latest('id');

        if ($request->filled('search')) {
            $query->search($request->input('search'));
        }

        if ($request->filled('category')) {
            $query->byCategory($request->input('category'));
        }

        if ($request->filled('severity')) {
            $query->bySeverity($request->input('severity'));
        }

        if ($request->filled('branch_id')) {
            $query->forBranch($request->input('branch_id'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', CarbonImmutable::parse($request->input('date_from'))->startOfDay());
        }

        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', CarbonImmutable::parse($request->input('date_to'))->endOfDay());
        }

        $limit = min((int) ($request->input('limit', 50)), 200);
        $logs = $query->limit($limit)->get();

        return response()->json([
            'data' => AuditLogResource::collection($logs),
        ]);
    }

    public function show(Request $request, AuditLog $auditLog): JsonResponse
    {
        $this->authorizeOwner($request);

        return response()->json([
            'data' => new AuditLogResource($auditLog->load(['actor.person', 'branch'])),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorizeOwner($request);

        $query = AuditLog::with(['actor.person', 'branch'])
            ->latest('id');

        if ($request->filled('search')) {
            $query->search($request->input('search'));
        }
        if ($request->filled('category')) {
            $query->byCategory($request->input('category'));
        }
        if ($request->filled('severity')) {
            $query->bySeverity($request->input('severity'));
        }
        if ($request->filled('branch_id')) {
            $query->forBranch($request->input('branch_id'));
        }
        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', CarbonImmutable::parse($request->input('date_from'))->startOfDay());
        }
        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', CarbonImmutable::parse($request->input('date_to'))->endOfDay());
        }

        $logs = $query->limit(5000)->get();
        $filename = 'audit_trail_' . CarbonImmutable::now('Asia/Manila')->format('Ymd_His') . '.csv';

        return response()->stream(function () use ($logs) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'ID',
                'Timestamp',
                'Action',
                'Category',
                'Severity',
                'Actor Name',
                'Actor Role',
                'Branch',
                'Target Type',
                'Target ID',
                'IP Address',
                'Details',
            ]);

            foreach ($logs as $log) {
                $payloadText = json_encode($log->payload ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                fputcsv($handle, [
                    $this->sanitizeCsvCell($log->public_id),
                    $this->sanitizeCsvCell($log->created_at?->toIso8601String() ?? ''),
                    $this->sanitizeCsvCell($log->action),
                    $this->sanitizeCsvCell($log->category),
                    $this->sanitizeCsvCell($log->severity),
                    $this->sanitizeCsvCell($log->actor_name ?? ''),
                    $this->sanitizeCsvCell($log->actor_role ?? ''),
                    $this->sanitizeCsvCell($log->branch?->name ?? 'All Branches'),
                    $this->sanitizeCsvCell($log->auditable_type ?? ''),
                    $this->sanitizeCsvCell($log->auditable_public_id ?? ''),
                    $this->sanitizeCsvCell($log->ip_address ?? ''),
                    $this->sanitizeCsvCell($payloadText),
                ]);
            }

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Prevents CSV Formula Injection (=, +, -, @).
     */
    private function sanitizeCsvCell(string $value): string
    {
        if (preg_match('/^[=+\-@\t\r]/', $value)) {
            return "'" . $value;
        }

        return $value;
    }
}
