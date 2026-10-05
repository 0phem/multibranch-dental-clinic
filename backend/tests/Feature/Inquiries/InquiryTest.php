<?php

namespace Tests\Feature\Inquiries;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Inquiry;
use App\Models\InquiryHistory;
use App\Models\Patient;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// M16 external-inquiry intake. Clinic clock frozen at 2026-09-28 10:00 Asia/Manila (SchedulingFixture); b1 (staffB1), b2 (staffB2),
// staffBoth (b1+b2). Manual Staff capture only: no platform integration exists, and the tests prove none is contacted.
class InquiryTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private int $keys = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        Http::preventStrayRequests();
    }

    private function key(): string
    {
        return 'iq-'.(++$this->keys);
    }

    private function capture(array $over = [], ?string $key = null, string $who = 'staffB1')
    {
        $this->actingAsUser($who);

        return $this->postJson('/api/inquiries', $over + ['branch_ref' => 'b1', 'source' => 'Facebook', 'name' => 'Maria Santos', 'contact' => '@maria.s', 'topic' => 'Braces schedule'],
            $key === '' ? [] : ['Idempotency-Key' => $key ?? $this->key()]);
    }

    private function cmd(string $id, string $name, array $body = [], ?int $revision = null, string $who = 'staffB1', ?string $key = null)
    {
        $this->actingAsUser($who);
        $revision ??= Inquiry::where('public_id', $id)->value('revision');

        return $this->postJson("/api/inquiries/{$id}/{$name}", $body + ['expected_revision' => $revision], ['Idempotency-Key' => $key ?? $this->key()]);
    }

    private function make(array $over = [], string $who = 'staffB1'): string
    {
        return $this->capture($over, null, $who)->assertCreated()->json('data.id');
    }

    // ---- access ---------------------------------------------------------------------------------------------------------

    public function test_only_staff_may_use_the_inquiry_api_and_no_other_role_or_guest_gets_any_route(): void
    {
        $id = $this->make();
        $routes = [['getJson', '/api/inquiries'], ['getJson', "/api/inquiries/{$id}"], ['postJson', '/api/inquiries'], ['postJson', "/api/inquiries/{$id}/respond"], ['postJson', "/api/inquiries/{$id}/close"], ['postJson', "/api/inquiries/{$id}/convert"]];
        foreach ($routes as [$verb, $url]) {
            auth()->forgetGuards();
            $this->app['auth']->forgetGuards();
            ($verb === 'getJson' ? $this->getJson($url) : $this->postJson($url, []))->assertUnauthorized();
        }
        foreach (['patientA', 'dentist1', 'owner'] as $who) {
            $this->actingAsUser($who);
            foreach ($routes as [$verb, $url]) {
                ($verb === 'getJson' ? $this->getJson($url) : $this->postJson($url, ['expected_revision' => 1], ['Idempotency-Key' => $this->key()]))->assertForbidden();
            }
        }
        $this->assertSame(1, Inquiry::count());
        Http::assertNothingSent();
    }

    // ---- capture --------------------------------------------------------------------------------------------------------

    public function test_staff_capture_an_inquiry_assigned_to_themselves_with_honest_manual_provenance_and_no_patient(): void
    {
        $res = $this->capture()->assertCreated();
        $d = $res->json('data');
        $this->assertMatchesRegularExpression('/^[0-9a-z]{26}$/', $d['id']);
        $this->assertSame(['Facebook', 'Recorded manually by Staff', 'Open', 1, null, null], [$d['source'], $d['capture'], $d['status'], $d['revision'], $d['patient'], $d['appointment']]);
        $this->assertSame(['name' => 'Maria Santos', 'detail' => '@maria.s'], $d['contact']);
        $this->assertSame(['b1', 'Branch B1'], [$d['branch']['id'], $d['branch']['name']]);
        $this->assertNotNull($d['received_at']);
        $json = json_encode($d);
        foreach (['assigned_user_id', 'created_by', 'branch_id', 'patient_id', 'external', 'delivered', 'synced', '"id":1'] as $leak) {
            $this->assertStringNotContainsString($leak, $json);
        }
        $row = Inquiry::sole();
        $this->assertSame([$this->u['staffB1']->id, $this->u['staffB1']->id, 'staff_manual', null, null], [$row->assigned_user_id, $row->created_by_user_id, $row->capture_method, $row->patient_id, $row->appointment_id]);
        $this->assertSame(['inquiry.captured'], InquiryHistory::pluck('event')->all());
        $this->getJson("/api/inquiries/{$d['id']}")->assertOk()->assertJsonPath('data.history.0.event', 'inquiry.captured');
        Http::assertNothingSent();
    }

    public function test_capture_is_validated_bounded_and_refuses_forged_fields_scope_and_missing_keys(): void
    {
        foreach ([['name' => ''], ['name' => 'x'], ['name' => str_repeat('n', 121)], ['name' => "Line\nbreak"], ['name' => "Ctrl\x07char"], ['contact' => str_repeat('c', 201)], ['contact' => "a\nb"],
            ['topic' => ''], ['topic' => 'x'], ['topic' => str_repeat('t', 501)], ['topic' => "bell\x07"], ['source' => 'Messenger'], ['source' => 'facebook'], ['source' => ''], ['branch_ref' => 'nope'], ['branch_ref' => '1'],
            ['name' => ['a']], ['topic' => 123]] as $bad) {
            $this->capture($bad)->assertStatus(422);
        }
        foreach (['id' => 'x', 'public_id' => '01ARZ3NDEKTSV4RRFFQ69G5FAV', 'status' => 'Closed', 'revision' => 9, 'assigned_user_id' => 1, 'assigned_to' => 'x', 'created_by_user_id' => 1, 'branch_id' => 1, 'patient_id' => 1, 'patient' => 'x',
            'appointment_id' => 'x', 'capture_method' => 'webhook', 'external_id' => 'fb-1', 'platform_id' => '1', 'delivery_status' => 'Delivered', 'received_at' => '2020-01-01T00:00:00Z', 'created_at' => '2020-01-01', 'history' => ['x']] as $field => $value) {
            $this->capture([$field => $value])->assertStatus(422, "must refuse {$field}");
        }
        $this->capture([], '')->assertStatus(422);                                // Idempotency-Key is mandatory
        $this->capture(['branch_ref' => 'b2'])->assertForbidden();               // another branch's scope
        $this->capture(['branch_ref' => 'b2'], null, 'staffNone')->assertForbidden();
        $this->assertSame(0, Inquiry::count());
        // Non-ASCII names and handles are accepted; the maximum lengths exactly are accepted.
        $this->capture(['name' => 'José Núñez 李小龍', 'contact' => '+63 917 123 4567'])->assertCreated();
        $this->capture(['name' => str_repeat('n', 120), 'contact' => str_repeat('c', 200), 'topic' => str_repeat('t', 500)])->assertCreated();
        $this->capture(['contact' => null])->assertCreated()->assertJsonPath('data.contact.detail', null);
    }

    public function test_untrusted_content_is_stored_and_returned_as_inert_data_and_links_are_never_fetched(): void
    {
        $xss = '<script>alert(1)</script><img src=x onerror=alert(2)> https://evil.example/track?x=1 javascript:alert(3) bit.ly/abc';
        $id = $this->capture(['topic' => $xss, 'name' => '<b>Bold</b> Name', 'contact' => '<a href="javascript:x">c</a>'])->assertCreated()->json('data.id');
        $this->assertSame($xss, $this->getJson("/api/inquiries/{$id}")->json('data.topic'), 'returned verbatim as data, never rewritten or interpreted');
        $this->assertSame('<b>Bold</b> Name', $this->getJson('/api/inquiries')->json('data.0.contact.name'));
        $this->assertSame('application/json', explode(';', $this->getJson('/api/inquiries')->headers->get('Content-Type'))[0]);
        Http::assertNothingSent();                                              // no preview, no fetch, no SSRF surface
    }

    public function test_capture_replays_with_the_same_key_but_two_legitimate_identical_inquiries_are_both_kept(): void
    {
        $first = $this->capture([], 'same-key')->assertCreated()->json('data.id');
        $this->assertSame($first, $this->capture([], 'same-key')->assertCreated()->json('data.id'));
        $this->assertSame(1, Inquiry::count());
        $this->capture(['topic' => 'Different request'], 'same-key')->assertStatus(422)->assertJsonPath('code', 'idempotency_key_reused');
        $second = $this->capture([], 'another-key')->assertCreated()->json('data.id');
        $this->assertNotSame($first, $second, 'identical text under a new key is a separate inquiry, never deduplicated');
        $this->assertSame(2, Inquiry::count());
    }

    // ---- scope and IDOR -------------------------------------------------------------------------------------------------

    public function test_staff_see_and_act_only_on_inquiries_assigned_to_them_in_a_branch_they_are_authorized_for(): void
    {
        $mine = $this->make();
        $other = $this->make(['branch_ref' => 'b2', 'topic' => 'Other branch'], 'staffB2');
        $both = $this->make(['branch_ref' => 'b2', 'topic' => 'Both account'], 'staffBoth');
        $sameBranchColleague = $this->account(Role::Staff, 'b1');
        $this->u['colleague'] = $sameBranchColleague;
        foreach (['staffB2', 'staffNone', 'colleague'] as $who) {
            $this->actingAsUser($who);
            $this->getJson("/api/inquiries/{$mine}")->assertForbidden();
            $this->assertNotContains($mine, array_column($this->getJson('/api/inquiries')->assertOk()->json('data'), 'id'));
            $this->cmd($mine, 'respond', [], null, $who)->assertForbidden();
            $this->cmd($mine, 'close', [], null, $who)->assertForbidden();
            $this->cmd($mine, 'convert', ['appointment_id' => '01ARZ3NDEKTSV4RRFFQ69G5FAV'], null, $who)->assertForbidden();
        }
        $this->actingAsUser('staffB1');
        $this->assertSame([$mine], array_column($this->getJson('/api/inquiries')->json('data'), 'id'));
        $this->actingAsUser('staffBoth');
        $this->assertSame([$both], array_column($this->getJson('/api/inquiries')->json('data'), 'id'));
        $this->assertSame('Open', Inquiry::where('public_id', $mine)->value('status'));
        // Numeric, malformed and unknown identifiers fail safely.
        $this->actingAsUser('staffB1');
        foreach (['1', 'not-a-ulid', '01ARZ3NDEKTSV4RRFFQ69G5FAV'] as $bad) {
            $this->getJson("/api/inquiries/{$bad}")->assertNotFound();
            $this->postJson("/api/inquiries/{$bad}/close", ['expected_revision' => 1], ['Idempotency-Key' => $this->key()])->assertNotFound();
        }
        // A Staff account whose branch authorization is later removed loses access at once.
        DB::table('user_branch_scopes')->where('user_id', $this->u['staffB1']->id)->delete();
        $this->getJson("/api/inquiries/{$mine}")->assertForbidden();
        $this->cmd($mine, 'respond')->assertForbidden();
    }

    // ---- lifecycle ------------------------------------------------------------------------------------------------------

    public function test_respond_and_close_are_named_commands_with_stale_protection_and_final_states(): void
    {
        $id = $this->make();
        $r = $this->cmd($id, 'respond')->assertOk();
        $this->assertSame(['Responded', 2], [$r->json('data.status'), $r->json('data.revision')]);
        $this->assertNotNull($r->json('data.responded_at'));
        $this->cmd($id, 'respond', [], 1)->assertOk()->assertJsonPath('data.revision', 2);          // already Responded: unchanged, no error
        $this->cmd($id, 'close', [], 1)->assertStatus(409)->assertJsonPath('code', 'stale_revision');
        $c = $this->cmd($id, 'close', [], 2)->assertOk();
        $this->assertSame(['Closed', 3], [$c->json('data.status'), $c->json('data.revision')]);
        $this->cmd($id, 'respond', [], 3)->assertStatus(422)->assertJsonPath('code', 'inquiry_final');
        $this->cmd($id, 'convert', ['appointment_id' => '01ARZ3NDEKTSV4RRFFQ69G5FAV'], 3)->assertStatus(422);
        $this->assertSame(['inquiry.captured', 'inquiry.responded', 'inquiry.closed'], InquiryHistory::orderBy('id')->pluck('event')->all());
        $detail = $this->getJson("/api/inquiries/{$id}")->json('data.history');
        $this->assertSame([null, 'Open', 'Responded'], array_column($detail, 'from_status'));
        $json = json_encode($detail);
        $this->assertStringNotContainsString('Braces', $json, 'history carries actions, never inquiry text');
        // No generic status update, no state in the body, no PATCH/PUT/DELETE.
        $this->cmd($id, 'respond', ['status' => 'Open'], 3)->assertStatus(422);
        foreach (['patch', 'put', 'delete'] as $verb) {
            $this->{$verb.'Json'}("/api/inquiries/{$id}", ['status' => 'Open'])->assertStatus(405);
        }
        // The database independently protects final and captured data.
        foreach ([fn () => DB::table('inquiries')->where('id', Inquiry::sole()->id)->update(['status' => 'Open', 'closed_at' => null]),
            fn () => DB::table('inquiries')->where('id', Inquiry::sole()->id)->delete(),
            fn () => DB::table('inquiry_history')->delete()] as $attempt) {
            try {
                DB::transaction($attempt);
                $this->fail('the database must refuse this change');
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        }
        $open = $this->make(['topic' => 'Fresh']);
        try {
            DB::transaction(fn () => DB::table('inquiries')->where('public_id', $open)->update(['topic' => 'rewritten']));
            $this->fail('captured details are immutable');
        } catch (QueryException) {
            $this->assertSame('Fresh', Inquiry::where('public_id', $open)->value('topic'));
        }
    }

    // ---- conversion: link an EXISTING appointment, nothing else ---------------------------------------------------------

    public function test_converting_links_an_existing_appointment_and_its_patient_and_creates_nothing_else(): void
    {
        $appointment = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '09:00');
        $id = $this->make(['name' => $this->p['B']->person->first_name.' '.$this->p['B']->person->last_name]);   // a name that "matches" Patient B
        $this->assertNull(Inquiry::sole()->patient_id, 'no automatic matching by name');
        $counts = [Patient::count(), Appointment::count(), DB::table('users')->count(), DB::table('persons')->count()];
        $res = $this->cmd($id, 'convert', ['appointment_id' => $appointment->public_id])->assertOk();
        $this->assertSame(['Converted', 2, $appointment->public_id, $this->p['A']->public_id], [$res->json('data.status'), $res->json('data.revision'), $res->json('data.appointment.id'), $res->json('data.patient.id')]);
        $this->assertSame($counts, [Patient::count(), Appointment::count(), DB::table('users')->count(), DB::table('persons')->count()]);
        $this->assertSame(['Confirmed', 1], [$appointment->fresh()->status, $appointment->fresh()->revision], 'M6 state is untouched');
        $this->assertTrue(! Schema::hasTable('conversations') || DB::table('conversations')->count() === 0, 'M16 creates no conversation (M17 owns them)');
        $this->cmd($id, 'convert', ['appointment_id' => $appointment->public_id], 1)->assertOk()->assertJsonPath('data.revision', 2);   // replay-safe, unchanged
        $other = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '10:00');
        $this->cmd($id, 'convert', ['appointment_id' => $other->public_id], 2)->assertStatus(422)->assertJsonPath('code', 'inquiry_already_linked');
        $event = AuditLog::where('action', 'inquiry.linked_to_patient')->sole();
        $this->assertSame(['general', $id], [$event->category, $event->auditable_public_id]);
        $this->assertSame(['appointment', 'from_status', 'revision', 'to_status'], collect(array_keys($event->payload))->sort()->values()->all());
        $this->assertStringNotContainsString('Braces', json_encode($event->payload));
        $this->assertSame(1, AuditLog::where('action', 'like', 'inquiry.%')->count(), 'only the Patient-link action is audited; module history covers the rest');
    }

    public function test_a_cancelled_other_branch_missing_or_malformed_appointment_cannot_be_linked(): void
    {
        $id = $this->make();
        $cancelled = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '09:00', 30, 'Cancelled');
        $otherBranch = $this->existing('A', 'd3', 'b2', 'svc1', '2026-09-29', '09:00');
        foreach ([[$cancelled->public_id, 'appointment_cancelled'], [$otherBranch->public_id, 'appointment_not_linkable'], ['01ARZ3NDEKTSV4RRFFQ69G5FAV', 'appointment_not_linkable']] as [$ref, $code]) {
            $this->cmd($id, 'convert', ['appointment_id' => $ref])->assertStatus(422)->assertJsonPath('code', $code);
        }
        foreach (['1', 'short', ['x'], 123] as $bad) {
            $this->cmd($id, 'convert', ['appointment_id' => $bad])->assertStatus(422);
        }
        $this->cmd($id, 'convert', [])->assertStatus(422);
        $this->assertSame(['Open', null, null], [Inquiry::sole()->status, Inquiry::sole()->patient_id, Inquiry::sole()->appointment_id]);
        $ok = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '11:00');
        $this->cmd($id, 'convert', ['appointment_id' => $ok->public_id], 2)->assertStatus(409);       // stale revision
        $this->cmd($id, 'convert', ['appointment_id' => $ok->public_id], 1)->assertOk();
    }

    // ---- lists ----------------------------------------------------------------------------------------------------------

    public function test_the_worklist_is_cursor_paged_newest_first_with_scoped_filters_and_no_cap(): void
    {
        $ids = [];
        foreach (range(1, 5) as $n) {
            $ids[] = $this->make(['source' => $n % 2 ? 'Facebook' : 'Instagram', 'topic' => "Topic {$n}"]);
        }
        $newest = array_reverse($ids);
        $this->make(['branch_ref' => 'b2', 'topic' => 'elsewhere'], 'staffB2');
        $this->actingAsUser('staffB1');
        $one = $this->getJson('/api/inquiries?per_page=2')->assertOk();
        $two = $this->getJson('/api/inquiries?per_page=2&cursor='.$one->json('meta.next_cursor'))->assertOk();
        $three = $this->getJson('/api/inquiries?per_page=2&cursor='.$two->json('meta.next_cursor'))->assertOk();
        $this->assertSame($newest, [...array_column($one->json('data'), 'id'), ...array_column($two->json('data'), 'id'), ...array_column($three->json('data'), 'id')]);
        $this->assertSame($newest[1], $one->json('meta.next_cursor'));
        $this->assertNull($three->json('meta.next_cursor'));
        $this->assertSame(50, $this->getJson('/api/inquiries')->json('meta.per_page'));
        $this->assertCount(3, $this->getJson('/api/inquiries?source=Facebook')->json('data'));
        $this->assertCount(5, $this->getJson('/api/inquiries?status=Open')->json('data'));
        $this->assertCount(0, $this->getJson('/api/inquiries?status=Closed')->json('data'));
        // An out-of-scope or unknown branch filter matches nothing and reveals nothing; a foreign cursor is an empty page.
        $this->assertSame([], $this->getJson('/api/inquiries?branch_ref=b2')->assertOk()->json('data'));
        $this->assertSame([], $this->getJson('/api/inquiries?branch_ref=zzz')->assertOk()->json('data'));
        $foreign = Inquiry::where('topic', 'elsewhere')->value('public_id');
        $this->assertSame([], $this->getJson("/api/inquiries?cursor={$foreign}")->assertOk()->json('data'));
        foreach (['per_page=0', 'per_page=101', 'per_page=x', 'per_page[]=1', 'cursor=short', 'cursor[]=a', 'status=Sent', 'source=Messenger', 'status[]=Open'] as $bad) {
            $this->getJson('/api/inquiries?'.$bad)->assertStatus(422);
        }
    }

    // ---- boundaries -----------------------------------------------------------------------------------------------------

    public function test_no_social_platform_integration_assistant_provider_or_messaging_exists_in_m16(): void
    {
        $sources = collect(glob(app_path('Services/Inquiries/*.php')))->merge([app_path('Http/Controllers/InquiryController.php'), app_path('Models/Inquiry.php')])
            ->map(fn ($f) => preg_replace('#(//.*|/\*.*?\*/)#s', '', file_get_contents($f)))->implode("\n");
        foreach (['Http::', 'graph.facebook', 'instagram.com/', 'webhook', 'Anthropic', 'AssistantProvider', 'AssistantService', 'Conversation', 'Notification', 'Mail::'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $sources, $forbidden);
        }
        $this->assertFalse(Schema::hasColumn('inquiries', 'external_id'));
        $this->assertFalse(Schema::hasColumn('inquiries', 'delivery_status'));
        $this->assertSame([], array_values(array_filter(array_keys(config('services')), fn ($k) => in_array($k, ['facebook', 'instagram', 'meta', 'messenger', 'whatsapp'], true))));
        $this->capture()->assertCreated();
        Http::assertNothingSent();
    }

    // ---- final gate -------------------------------------------------------------------------------------------------------

    public function test_the_summary_counts_only_the_staff_members_own_scope_and_other_roles_get_nothing(): void
    {
        $this->actingAsUser('staffB1');
        $this->getJson('/api/inquiries/summary')->assertOk()->assertExactJson(['data' => ['open' => 0, 'responded' => 0, 'closed' => 0, 'converted' => 0, 'total' => 0]]);   // a genuine zero
        $a = $this->make();
        $b = $this->make(['topic' => 'Second']);
        $c = $this->make(['topic' => 'Third']);
        $this->make(['branch_ref' => 'b2', 'topic' => 'Not mine'], 'staffB2');
        $this->cmd($b, 'respond');
        $this->cmd($c, 'close');
        $this->actingAsUser('staffB1');
        $this->getJson('/api/inquiries/summary')->assertOk()->assertExactJson(['data' => ['open' => 1, 'responded' => 1, 'closed' => 1, 'converted' => 0, 'total' => 3]]);
        $this->actingAsUser('staffB2');
        $this->assertSame(1, $this->getJson('/api/inquiries/summary')->json('data.open'));
        $this->actingAsUser('staffNone');
        $this->assertSame(0, $this->getJson('/api/inquiries/summary')->json('data.total'));
        auth()->forgetGuards();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/inquiries/summary')->assertUnauthorized();
        foreach (['patientA', 'dentist1', 'owner'] as $who) {
            $this->actingAsUser($who);
            $this->getJson('/api/inquiries/summary')->assertForbidden();
        }
        $this->assertNotNull($a);
    }

    public function test_convert_replays_by_key_refuses_a_reused_key_for_another_appointment_and_changes_nothing_else(): void
    {
        $one = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '09:00');
        $two = $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-29', '10:00');
        $id = $this->make();
        $first = $this->cmd($id, 'convert', ['appointment_id' => $one->public_id], 1, 'staffB1', 'convert-key')->assertOk();
        $replay = $this->cmd($id, 'convert', ['appointment_id' => $one->public_id], 1, 'staffB1', 'convert-key')->assertOk();
        $this->assertSame($first->json('data'), $replay->json('data'));
        $this->cmd($id, 'convert', ['appointment_id' => $two->public_id], 1, 'staffB1', 'convert-key')->assertStatus(422)->assertJsonPath('code', 'idempotency_key_reused');
        $this->assertSame(1, InquiryHistory::where('event', 'inquiry.linked_to_appointment')->count());
        $this->assertSame(1, AuditLog::where('action', 'inquiry.linked_to_patient')->count());
        $this->assertSame($this->p['A']->id, Inquiry::sole()->patient_id);
        $this->assertSame(['Confirmed', 'Confirmed'], [$one->fresh()->status, $two->fresh()->status]);
    }

    public function test_inquiry_history_is_append_only_in_the_database_for_every_write_path_and_cannot_be_authored_by_a_client(): void
    {
        $id = $this->make();
        $this->cmd($id, 'respond');
        $row = InquiryHistory::orderBy('id')->first();
        $attempts = [
            'model update' => fn () => $row->update(['event' => 'rewritten']),
            'model delete' => fn () => $row->delete(),
            'builder update' => fn () => InquiryHistory::where('id', $row->id)->update(['to_status' => 'Closed']),
            'builder delete' => fn () => InquiryHistory::query()->delete(),
            'raw update' => fn () => DB::update('update inquiry_history set occurred_at = now()'),
            'raw delete' => fn () => DB::delete('delete from inquiry_history'),
            'truncate-like' => fn () => DB::statement('delete from inquiry_history where true'),
            'actor change' => fn () => DB::table('inquiry_history')->where('id', $row->id)->update(['actor_user_id' => null]),
        ];
        foreach ($attempts as $why => $attempt) {
            try {
                DB::transaction($attempt);
                $this->fail("history must refuse: {$why}");
            } catch (QueryException $e) {
                $this->assertStringContainsString('append-only', $e->getMessage(), $why);
            }
        }
        $this->assertSame(2, InquiryHistory::count());
        // Deleting an account that authored history, or the inquiry itself, is refused rather than silently destroying or blanking history.
        foreach ([fn () => DB::table('users')->where('id', $this->u['staffB1']->id)->delete(), fn () => DB::table('inquiries')->delete()] as $attempt) {
            try {
                DB::transaction($attempt);
                $this->fail('the deletion must be refused');
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        }
        $this->assertSame(2, InquiryHistory::count());
        $this->assertSame($this->u['staffB1']->id, $row->fresh()->actor_user_id);
        // No client route can create, change or delete history, and a client cannot supply actor or timestamps.
        $this->actingAsUser('staffB1');
        foreach (['post', 'put', 'patch', 'delete'] as $verb) {
            $this->{$verb.'Json'}("/api/inquiries/{$id}/history", ['event' => 'x'])->assertNotFound();
        }
        $this->cmd($id, 'close', ['actor_user_id' => 1, 'occurred_at' => '2020-01-01', 'history' => ['x']], 2)->assertStatus(422);
        $this->assertSame(2, InquiryHistory::count());
        // History rows are written from the server command: server actor and role, server time.
        $this->assertSame([$this->u['staffB1']->id, 'staff'], [$row->fresh()->actor_user_id, $row->fresh()->actor_role]);
        $this->assertTrue($row->fresh()->occurred_at->diffInSeconds(now(), false) < 5);
    }
}
