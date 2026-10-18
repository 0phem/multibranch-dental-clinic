<?php

namespace App\Http\Controllers;

use App\Models\MessageTemplate;
use App\Services\Automations\AutomationCatalog;
use App\Services\Automations\MessageTemplates;
use App\Services\Automations\TestEmails;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * F1 message wording (Administration → Automations → Message wording). The Owner lists, edits (with a live preview), approves and
 * test-sends every automated email; a Dentist approves the health-related ones (recall). Nothing is sent with wording that is
 * not approved, and an automation cannot be switched on until its wording is approved.
 */
class MessageTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = MessageTemplate::with(['approver.person', 'dentistApprover.person'])->get()->keyBy('key');
        $onlyDentist = $request->user()->role->value === 'dentist';
        $data = [];
        foreach (array_keys(MessageTemplates::DEFAULTS) as $key) {
            $t = $rows[$key] ?? null;
            if (! $t || ($onlyDentist && ! $t->needs_dentist)) continue;
            $data[] = $this->view($t);
        }

        return response()->json(['data' => $data, 'meta' => ['recall_rules' => AutomationCatalog::setting('recall')?->settings['rules'] ?? []]]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $this->known($key);
        $data = $request->validate(['subject' => ['required', 'string', 'max:200'], 'body' => ['required', 'string', 'max:2000'], 'expected_revision' => ['required', 'integer']]);
        $t = app(MessageTemplates::class)->update($request->user(), $key, $data, (int) $data['expected_revision']);

        return $t ? response()->json(['data' => $this->view($t->fresh(['approver.person', 'dentistApprover.person']))]) : $this->stale();
    }

    public function approve(Request $request, string $key): JsonResponse
    {
        $this->known($key);
        $data = $request->validate(['expected_revision' => ['required', 'integer']]);
        $t = app(MessageTemplates::class)->approve($request->user(), $key, (int) $data['expected_revision']);

        return $t ? response()->json(['data' => $this->view($t->fresh(['approver.person', 'dentistApprover.person']))]) : $this->stale();
    }

    public function dentistApprove(Request $request, string $key): JsonResponse
    {
        $this->known($key);
        $data = $request->validate(['expected_revision' => ['required', 'integer']]);
        $t = app(MessageTemplates::class)->dentistApprove($request->user(), $key, (int) $data['expected_revision']);

        return $t ? response()->json(['data' => $this->view($t->fresh(['approver.person', 'dentistApprover.person']))]) : $this->stale();
    }

    /** The email as a patient would see it (example records), with the saved wording or an unsaved draft. */
    public function preview(Request $request, string $key): JsonResponse
    {
        $this->known($key);
        $data = $request->validate(['subject' => ['nullable', 'string', 'max:200'], 'body' => ['nullable', 'string', 'max:2000']]);
        $draft = isset($data['subject'], $data['body']) ? MessageTemplates::validate($key, $data) : null;
        $mail = app(TestEmails::class)->sample($key, $request->user())->withDraft($draft);

        return response()->json(['data' => ['subject' => $mail->envelope()->subject, 'html' => $mail->render()]]);
    }

    public function test(Request $request, string $key): JsonResponse
    {
        $this->known($key);
        $result = app(TestEmails::class)->sendTemplate($key, $request->user());
        if (($result['status'] ?? null) === 'failed') return response()->json(['message' => $result['message'] ?? 'The test email could not be sent.', 'code' => 'automation_test_failed'], 422);

        return response()->json(['data' => $result]);
    }

    private function view(MessageTemplate $t): array
    {
        $usedBy = array_keys(array_filter(AutomationCatalog::TEMPLATES, fn ($keys) => in_array($t->key, $keys, true)));

        return ['key' => $t->key, 'name' => MessageTemplates::NAMES[$t->key], 'subject' => $t->subject, 'body' => $t->body, 'revision' => $t->revision,
            'placeholders' => MessageTemplates::PLACEHOLDERS[$t->key], 'needs_dentist' => $t->needs_dentist, 'approved' => $t->isApproved(),
            'is_default' => $t->subject === MessageTemplates::DEFAULTS[$t->key][0] && $t->body === MessageTemplates::DEFAULTS[$t->key][1],
            'owner_approval' => $t->approved_at ? ['by' => $t->approver?->person?->fullName() ?? 'Owner', 'at' => $t->approved_at->toIso8601String()] : null,
            'dentist_approval' => $t->dentist_approved_at ? ['by' => $t->dentistApprover?->person?->fullName() ?? 'Dentist', 'at' => $t->dentist_approved_at->toIso8601String()] : null,
            'used_by' => $usedBy === [] && $t->key === 'closure_notice' ? ['closed_dates'] : $usedBy];
    }

    private function known(string $key): void
    {
        abort_unless(array_key_exists($key, MessageTemplates::DEFAULTS), 404);
    }

    private function stale(): JsonResponse
    {
        return response()->json(['message' => 'Someone else changed this wording. Reload to see the latest version.', 'code' => 'stale_revision'], 409);
    }
}
