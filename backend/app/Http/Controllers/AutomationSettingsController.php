<?php

namespace App\Http\Controllers;

use App\Models\AutomationSetting;
use App\Services\Audit\AuditService;
use App\Services\Automations\AutomationCatalog;
use App\Services\Automations\AutomationLog;
use App\Services\Automations\DemoClock;
use App\Services\Automations\TestEmails;
use App\Support\DemoMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Administration → Automations (Owner only): one card per scheduled automation with its switch, settings, last run and the last
 * 7 days' counts; a test email to the signed-in Owner; and, on the demo database only, the demo clock. Every change is audited
 * with who, which automation and the old and new values (settings never contain patient data). Optimistic concurrency by
 * revision. Nothing is ever deleted.
 */
class AutomationSettingsController extends Controller
{
    public function index(): JsonResponse
    {
        $stats = AutomationLog::lastSevenDays();
        $rows = AutomationSetting::all()->keyBy('key');
        $data = [];
        foreach (AutomationCatalog::definitions() as $key => [$name, $module, $description, $defaultOn, $defaults]) {
            $row = $rows[$key] ?? null;
            $data[] = ['key' => $key, 'name' => $name, 'module' => $module, 'description' => $description,
                'enabled' => (bool) $row?->enabled, 'settings' => $row?->settings ?? $defaults, 'revision' => $row?->revision,
                'defaults' => ['enabled' => $defaultOn, 'settings' => $defaults],
                // A value is "confirmed" only once an Owner saved this automation; until then it is the shipped default.
                'owner_saved' => $row?->updated_by_user_id !== null,
                'last_run_at' => $row?->last_run_at?->toIso8601String(), 'missing' => $row === null, 'last_7_days' => $stats[$key]];
        }

        return response()->json(['data' => $data, 'meta' => ['categories' => AutomationCatalog::categories(), 'demo' => DemoMode::active(), 'timezone' => 'Asia/Manila']]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        abort_unless(in_array($key, AutomationCatalog::KEYS, true), 404);
        $data = $request->validate(['enabled' => ['sometimes', 'boolean'], 'settings' => ['sometimes', 'array'], 'expected_revision' => ['required', 'integer']]);
        $settings = array_key_exists('settings', $data) ? AutomationCatalog::validate($key, $data['settings']) : null;
        $row = DB::transaction(function () use ($key, $data, $settings, $request) {
            $row = AutomationSetting::whereKey($key)->lockForUpdate()->firstOrFail();
            if ($row->revision !== (int) $data['expected_revision']) return null;
            $old = ['enabled' => $row->enabled, 'settings' => $row->settings];
            if (array_key_exists('enabled', $data)) $row->enabled = (bool) $data['enabled'];
            if ($settings !== null) $row->settings = $settings;
            $changes = [];
            if ($row->enabled !== $old['enabled']) $changes['enabled'] = ['old' => $old['enabled'], 'new' => $row->enabled];
            foreach ($row->settings as $field => $value) {
                if (($old['settings'][$field] ?? null) !== $value) $changes["settings.$field"] = ['old' => $old['settings'][$field] ?? null, 'new' => $value];
            }
            if ($changes) {
                $row->revision++;
                $row->updated_by_user_id = $request->user()->id;
                $row->save();
                app(AuditService::class)->recordAdministrative('automation.settings_updated', $request->user(), null, ['automation' => $key, 'changes' => $changes]);
            }

            return $row;
        });
        if (! $row) return response()->json(['message' => 'Someone else changed this automation. Reload to see the latest settings.', 'code' => 'stale_revision'], 409);

        return $this->index();
    }

    public function test(Request $request, string $key): JsonResponse
    {
        abort_unless(in_array($key, AutomationCatalog::KEYS, true), 404);
        $result = app(TestEmails::class)->send($key, $request->user());

        if ($result['status'] === 'failed') return response()->json(['message' => $result['message'], 'code' => 'automation_test_failed'], 422);

        return response()->json(['data' => $result]);
    }

    public function demo(Request $request): JsonResponse
    {
        abort_unless(DemoMode::active(), 404);
        $data = $request->validate(['appointment_code' => ['nullable', 'string', 'max:40'], 'invoice_number' => ['nullable', 'string', 'max:40'], 'summary' => ['sometimes', 'boolean']]);
        $result = app(DemoClock::class)->run($data['appointment_code'] ?? null, $data['invoice_number'] ?? null, (bool) ($data['summary'] ?? false));
        app(AuditService::class)->recordAdministrative('automation.demo_clock', $request->user(), null, ['automations' => array_keys($result)]);

        return response()->json(['data' => $result]);
    }
}
