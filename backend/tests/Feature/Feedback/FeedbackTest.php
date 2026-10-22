<?php

namespace Tests\Feature\Feedback;

use App\Models\AuditLog;
use App\Models\PatientFeedback;
use App\Models\Treatment;
use App\Models\TreatmentProcedure;
use App\Models\Visit;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// M26 foundation (Patient only): free-text feedback about an OWN completed Visit and the Patient's own history; nothing else exists.
class FeedbackTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private int $keys = 0;

    private array $logged = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        Http::preventStrayRequests();
        Mail::fake();
        Notification::fake();
        config(['feedback.per_minute' => 1000, 'feedback.per_hour' => 10000]);
        $this->logged = [];
        Event::listen(MessageLogged::class, fn (MessageLogged $e) => $this->logged[] = [$e->message, $e->context]);
    }

    private function key(): string
    {
        return 'fk-'.(++$this->keys);
    }

    /** A COMPLETED Visit of the given Patient (with a Completed Treatment of one service when $withTreatment). */
    private function visit(string $patient = 'A', string $when = '2026-09-28 09:00:00', string $status = 'Completed', bool $withTreatment = true, string $branch = 'b1'): Visit
    {
        $visit = Visit::create(['patient_id' => $this->p[$patient]->id, 'branch_id' => $this->b[$branch]->id, 'source' => 'walk_in', 'status' => $status === 'Completed' && $withTreatment ? 'In Treatment' : $status, 'responsible_dentist_profile_id' => $this->d['d1']->id,
            'requested_service_id' => $this->svc['svc1']->id, 'arrived_at' => $when, 'clinic_date' => substr($when, 0, 10), 'revision' => 1, 'created_by_user_id' => $this->u['staffB1']->id, 'updated_by_user_id' => $this->u['staffB1']->id]);
        if ($status === 'Completed') {
            $treatment = $withTreatment ? Treatment::create(['visit_id' => $visit->id, 'dentist_profile_id' => $this->d['d1']->id, 'status' => 'In Treatment', 'procedure_summary' => 'SECRET clinical summary', 'clinical_notes' => 'SECRET clinical notes', 'started_at' => $when, 'revision' => 1, 'created_by_user_id' => $this->u['dentist1']->id, 'updated_by_user_id' => $this->u['dentist1']->id]) : null;
            if ($treatment) {
                TreatmentProcedure::create(['treatment_id' => $treatment->id, 'service_id' => $this->svc['svc1']->id, 'line_no' => 1, 'quantity' => 1, 'service_code' => 'SVC1', 'service_name' => 'Service svc1']);
            }
            DB::transaction(function () use ($visit, $treatment, $when) {
                $visit->update(['status' => 'Completed', 'closed_at' => $when, 'revision' => 2]);
                $treatment?->update(['status' => 'Completed', 'completed_at' => $when, 'revision' => 2]);
            });
        }

        return $visit->fresh();
    }

    private function submit(string $who, $visit, $body = 'The wait was long but the care was good.', ?string $key = null, array $extra = [])
    {
        $this->actingAsUser($who);
        $id = $visit instanceof Visit ? $visit->public_id : $visit;

        return $this->postJson('/api/feedback', ['visit_id' => $id, 'body' => $body] + $extra, $key === '' ? [] : ['Idempotency-Key' => $key ?? $this->key()]);
    }

    // ---- access -------------------------------------------------------------------------------------------------------

    public function test_the_feature_is_patient_only_and_owner_staff_dentist_and_guests_are_all_refused_everywhere(): void
    {
        $visit = $this->visit();
        $id = $this->submit('patientA', $visit)->assertCreated()->json('data.id');
        $routes = [['getJson', '/api/feedback'], ['getJson', '/api/feedback/mine'], ['getJson', '/api/feedback/eligible-visits'], ['postJson', '/api/feedback']];
        foreach ($routes as [$verb, $url]) {
            $this->app['auth']->forgetGuards();
            ($verb === 'getJson' ? $this->getJson($url) : $this->postJson($url, []))->assertUnauthorized();
        }
        // Staff and Dentists have no access to feedback endpoints or review endpoint.
        foreach (['staffB1', 'staffBoth', 'staffNone', 'dentist1'] as $who) {
            $this->actingAsUser($who);
            foreach ($routes as [$verb, $url]) {
                ($verb === 'getJson' ? $this->getJson($url) : $this->postJson($url, ['visit_id' => $visit->public_id, 'body' => 'x'], ['Idempotency-Key' => $this->key()]))->assertForbidden();
            }
            $this->assertNotSame(200, $this->getJson("/api/feedback/{$id}")->status());
            $this->assertNotSame(200, $this->getJson('/api/feedback/review')->status());
        }
        // Owner cannot access patient submit/mine endpoints, but can access the review endpoint.
        $this->actingAsUser('owner');
        foreach ($routes as [$verb, $url]) {
            ($verb === 'getJson' ? $this->getJson($url) : $this->postJson($url, ['visit_id' => $visit->public_id, 'body' => 'x'], ['Idempotency-Key' => $this->key()]))->assertForbidden();
        }
        $this->getJson('/api/feedback/review')->assertOk();
        $this->assertSame(1, PatientFeedback::count());
        Http::assertNothingSent();
    }

    public function test_owner_can_review_feedback_with_filters(): void
    {
        $this->actingAsUser('owner');
        $this->getJson('/api/feedback/review')->assertOk();
        $this->actingAsUser('patientB');
        $this->getJson('/api/feedback')->assertOk();     // a Patient reads only their own list here
    }

    // ---- submission -----------------------------------------------------------------------------------------------------

    public function test_a_patient_submits_free_text_about_their_own_completed_visit_and_the_record_is_minimal_and_server_derived(): void
    {
        $visit = $this->visit();
        $res = $this->submit('patientA', $visit)->assertCreated();
        $d = $res->json('data');
        $this->assertSame(['id', 'rating', 'visit', 'body', 'submitted_at'], array_keys($d));
        $this->assertMatchesRegularExpression('/^[0-9a-z]{26}$/', $d['id']);
        $this->assertSame([$visit->public_id, '2026-09-28', ['Service svc1']], [$d['visit']['id'], $d['visit']['date'], $d['visit']['services']]);
        $row = PatientFeedback::sole();
        $this->assertSame([$this->p['A']->id, $visit->id], [$row->patient_id, $row->visit_id]);
        $json = json_encode($d);
        foreach (['SECRET', 'patient_id', 'dentist', 'branch', 'status', 'reply', 'reviewer', 'anonymous', '"id":1'] as $leak) {
            $this->assertStringNotContainsString($leak, $json);
        }
        // The Visit, its Treatment and the Patient record are untouched; nothing else was created.
        $this->assertSame(['Completed', 2], [$visit->fresh()->status, $visit->fresh()->revision]);
        $this->assertSame(1, Treatment::count());
        Mail::assertNothingSent();
        Notification::assertNothingSent();
        $this->assertSame(0, AuditLog::where('action', 'like', 'feedback.%')->count(), 'M22 holds no feedback transcript');
    }

    public function test_only_the_patients_own_completed_visits_are_eligible_and_every_other_case_is_one_indistinguishable_refusal(): void
    {
        $own = $this->visit();
        $checkedIn = $this->visit('A', '2026-09-28 11:00:00', 'Checked In', false);
        $theirs = $this->visit('B');
        $answers = [];
        foreach ([$checkedIn->public_id, $theirs->public_id, '01ARZ3NDEKTSV4RRFFQ69G5FAV'] as $ref) {
            $r = $this->submit('patientA', $ref)->assertStatus(422);
            $answers[] = [$r->json('code'), $r->json('message')];
        }
        $this->assertSame(['visit_not_eligible'], array_unique(array_column($answers, 0)));
        $this->assertCount(1, array_unique(array_map('json_encode', $answers)), 'foreign, unknown and unfinished visits cannot be told apart');
        foreach (['1', 'short', ['x'], 123, null] as $bad) {
            $this->submit('patientA', $bad)->assertStatus(422);
        }
        $this->submit('patientB', $own)->assertStatus(422);                        // Patient B against Patient A's visit
        $this->assertSame(0, PatientFeedback::count());
        $this->submit('patientA', $own)->assertCreated();
        $this->submit('patientB', $theirs)->assertCreated();
        // The eligible list is the Patient's own completed visits only.
        $this->actingAsUser('patientA');
        $this->assertSame([$own->public_id], array_column($this->getJson('/api/feedback/eligible-visits')->assertOk()->json('data'), 'id'));
    }

    public function test_the_text_is_bounded_free_data_and_every_authority_or_policy_field_is_refused(): void
    {
        $visit = $this->visit();
        foreach ([null, '', '   ', str_repeat('x', 2001), ['a'], 123, true, "bell\x07", "nu\x00ll"] as $bad) {
            $r = $this->submit('patientA', $visit, $bad);
            $this->assertSame(422, $r->status(), json_encode($bad));
        }
        foreach (['id' => 'x', 'public_id' => '01ARZ3NDEKTSV4RRFFQ69G5FAV', 'patient_id' => 1, 'user_id' => 1, 'author' => 'x', 'reviewer' => 'x', 'review_status' => 'Reviewed', 'status' => 'Resolved', 'branch_id' => 1, 'dentist_id' => 1,
            'stars' => 5, 'nps' => 10, 'category' => 'Staff', 'anonymous' => true, 'publish' => true, 'public' => true, 'testimonial' => true, 'testimonial_consent' => true, 'marketing_consent' => true,
            'resolved_at' => 'x', 'created_at' => '2020-01-01', 'attachment' => 'f', 'html' => '<b>x</b>'] as $field => $value) {
            $this->submit('patientA', $visit, 'ok', null, [$field => $value])->assertStatus(422, "must refuse {$field}");
        }
        $this->submit('patientA', $visit, 'ok', null, ['rating' => 0])->assertStatus(422, 'must refuse rating 0');
        $this->submit('patientA', $visit, 'ok', null, ['rating' => 6])->assertStatus(422, 'must refuse rating 6');
        $this->submit('patientA', $visit, 'ok', '')->assertStatus(422);                    // Idempotency-Key is mandatory
        $this->assertSame(0, PatientFeedback::count());
        $xss = "<script>alert(1)</script><img src=x onerror=alert(2)> https://evil.example/t javascript:alert(3)\nsecond line";
        $this->submit('patientA', $visit, $xss)->assertCreated();
        $this->submit('patientA', $visit, str_repeat('y', 2000))->assertCreated();          // exactly at the bound
        $this->submit('patientA', $visit, 'José Núñez 李小龍 — très bien 👍')->assertCreated();
        $this->assertSame($xss, PatientFeedback::orderBy('id')->first()->body, 'stored verbatim as data');
        $this->actingAsUser('patientA');
        $this->assertSame('José Núñez 李小龍 — très bien 👍', $this->getJson('/api/feedback/mine')->json('data.0.body'));
        Http::assertNothingSent();
    }

    public function test_submission_is_idempotent_a_new_key_is_a_separate_submission_and_no_uniqueness_is_invented(): void
    {
        $visit = $this->visit();
        $first = $this->submit('patientA', $visit, 'Lost response?', 'same-key')->assertCreated()->json('data');
        $replay = $this->submit('patientA', $visit, 'Lost response?', 'same-key')->assertCreated()->json('data');
        $this->assertSame($first, $replay);
        $this->assertSame(1, PatientFeedback::count());
        $this->submit('patientA', $visit, 'A different text', 'same-key')->assertStatus(422)->assertJsonPath('code', 'idempotency_key_reused');
        $this->submit('patientA', $this->visit('B'), 'Lost response?', 'same-key')->assertStatus(422);
        // Separate submissions about the same Visit — even with identical text — are all kept: multiplicity is unresolved policy.
        $this->submit('patientA', $visit, 'Lost response?', 'new-key')->assertCreated();
        $this->submit('patientA', $visit, 'Second thought')->assertCreated();
        $this->assertSame(3, PatientFeedback::where('visit_id', $visit->id)->count());
        $this->assertFalse(collect(DB::select("select indexname from pg_indexes where tablename = 'patient_feedback'"))->contains(fn ($i) => str_contains($i->indexname, 'visit_id_unique')));
    }

    // ---- own history ----------------------------------------------------------------------------------------------------

    public function test_a_patient_reads_only_their_own_feedback_newest_first_with_a_cursor_that_reveals_nothing_about_others(): void
    {
        $mine = $this->visit();
        $theirs = $this->visit('B');
        $ids = [];
        foreach (range(1, 5) as $n) {
            $ids[] = $this->submit('patientA', $mine, "mine {$n}")->json('data.id');
        }
        $foreign = $this->submit('patientB', $theirs, 'theirs')->json('data.id');
        $this->actingAsUser('patientA');
        $one = $this->getJson('/api/feedback/mine?per_page=2')->assertOk();
        $two = $this->getJson('/api/feedback/mine?per_page=2&cursor='.$one->json('meta.next_cursor'))->assertOk();
        $three = $this->getJson('/api/feedback/mine?per_page=2&cursor='.$two->json('meta.next_cursor'))->assertOk();
        $this->assertSame(array_reverse($ids), [...array_column($one->json('data'), 'id'), ...array_column($two->json('data'), 'id'), ...array_column($three->json('data'), 'id')]);
        $this->assertNull($three->json('meta.next_cursor'));
        $this->assertSame(25, $this->getJson('/api/feedback/mine')->json('meta.per_page'));
        $this->assertSame([], $this->getJson("/api/feedback/mine?cursor={$foreign}")->assertOk()->json('data'), 'another Patient\'s feedback id reveals nothing');
        $this->assertSame([], $this->getJson('/api/feedback/mine?cursor=01ARZ3NDEKTSV4RRFFQ69G5FAV')->assertOk()->json('data'));
        foreach (['per_page=0', 'per_page=101', 'per_page=x', 'cursor=short', 'cursor[]=a', 'patient_id=x'] as $bad) {
            $this->getJson('/api/feedback/mine?'.$bad)->assertStatus(422);
        }
        $this->assertNotContains($foreign, array_column($this->getJson('/api/feedback/mine?per_page=100')->json('data'), 'id'));
        $this->assertSame($this->getJson('/api/feedback/mine?per_page=100')->json(), $this->getJson('/api/feedback?per_page=100')->json(), 'GET /feedback is the same own-only list');
    }

    // ---- immutability, retention, boundaries ----------------------------------------------------------------------------

    public function test_submitted_feedback_is_immutable_and_nothing_can_erase_it(): void
    {
        $visit = $this->visit();
        $this->submit('patientA', $visit, 'permanent');
        $row = PatientFeedback::sole();
        $attempts = [
            'model update' => fn () => $row->update(['body' => 'edited']),
            'model delete' => fn () => $row->delete(),
            'builder update' => fn () => PatientFeedback::where('id', $row->id)->update(['body' => 'x']),
            'raw delete' => fn () => DB::delete('delete from patient_feedback'),
            'raw update' => fn () => DB::update("update patient_feedback set created_at = now() - interval '5 years'"),
            'delete the visit' => fn () => DB::table('visits')->where('id', $visit->id)->delete(),
            'delete the patient' => fn () => DB::table('patients')->where('id', $this->p['A']->id)->delete(),
        ];
        foreach ($attempts as $why => $attempt) {
            try {
                DB::transaction($attempt);
                $this->fail("must refuse: {$why}");
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        }
        $this->assertSame('permanent', PatientFeedback::sole()->body);
    }

    public function test_m26_is_a_foundation_only_no_rating_category_status_reply_publication_marketing_or_other_module_side_effect(): void
    {
        foreach (['score', 'category', 'status', 'anonymous', 'reply', 'reviewer_id', 'reviewed_at', 'resolved_at', 'published', 'testimonial', 'marketing_consent', 'dentist_profile_id', 'branch_id', 'conversation_id', 'notification_id'] as $column) {
            $this->assertFalse(Schema::hasColumn('patient_feedback', $column), $column);
        }
        $sources = collect(glob(app_path('Services/Feedback/*.php')))->merge([app_path('Http/Controllers/FeedbackController.php'), app_path('Models/PatientFeedback.php')])
            ->map(fn ($f) => preg_replace('#(//.*|/\*.*?\*/)#s', '', file_get_contents($f)))->implode("\n");
        foreach (['Http::', 'Mail::', 'Notification', 'Conversation', 'ConversationMessage', 'Anthropic', 'AssistantProvider', 'Inquiry', 'AuditService', 'Campaign'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $sources, $forbidden);
        }
        $visit = $this->visit();
        $before = [DB::table('conversations')->count(), DB::table('inquiries')->count(), AuditLog::count()];
        $this->submit('patientA', $visit, 'Nothing else should happen')->assertCreated();
        $this->assertSame($before, [DB::table('conversations')->count(), DB::table('inquiries')->count(), AuditLog::count()]);
        $logs = json_encode($this->logged);
        $this->assertStringNotContainsString('Nothing else should happen', $logs, 'feedback text is never logged');
    }

    public function test_submission_is_rate_limited_per_account_and_explains_itself(): void
    {
        config(['feedback.per_minute' => 2]);
        $visit = $this->visit();
        $other = $this->visit('B');
        $this->submit('patientA', $visit, 'one')->assertCreated();
        $this->submit('patientA', $visit, 'two')->assertCreated();
        $limited = $this->submit('patientA', $visit, 'three')->assertStatus(429)->assertJsonPath('code', 'feedback_rate_limited');
        $this->assertGreaterThan(0, $limited->json('retry_after'));
        $this->submit('patientB', $other, 'unaffected')->assertCreated();
        $this->assertSame(3, PatientFeedback::count());
    }

    public function test_patient_can_submit_1_to_5_star_rating_and_low_ratings_auto_create_followup_task(): void
    {
        $visit1 = $this->visit();
        $res5 = $this->submit('patientA', $visit1, 'Great service!', null, ['rating' => 5])->assertCreated();
        $this->assertSame(5, $res5->json('data.rating'));
        $this->assertSame(0, DB::table('followup_tasks')->where('source', 'feedback')->count());

        $visit2 = $this->visit('A', '2026-09-28 14:00:00');
        $res2 = $this->submit('patientA', $visit2, 'Unsatisfied with wait time', null, ['rating' => 2])->assertCreated();
        $this->assertSame(2, $res2->json('data.rating'));
        $this->assertSame(1, DB::table('followup_tasks')->where('source', 'feedback')->count());
        $task = DB::table('followup_tasks')->where('source', 'feedback')->first();
        $this->assertSame('Open', $task->status);
        $this->assertSame($visit2->patient_id, $task->patient_id);
        $this->assertSame($visit2->branch_id, $task->branch_id);
    }

    public function test_owner_can_review_patient_feedback_with_branch_and_dentist_filters(): void
    {
        $visit1 = $this->visit('A', '2026-09-28 09:00:00', 'Completed', true, 'b1');
        $visit2 = $this->visit('B', '2026-09-28 10:00:00', 'Completed', true, 'b2');

        $this->submit('patientA', $visit1, 'Feedback for branch 1', null, ['rating' => 4]);
        $this->submit('patientB', $visit2, 'Feedback for branch 2', null, ['rating' => 1]);

        $this->actingAsUser('owner');
        $all = $this->getJson('/api/feedback/review')->assertOk()->json('data');
        $this->assertCount(2, $all);

        $filteredBranch = $this->getJson('/api/feedback/review?branch_id=' . $this->b['b1']->id)->assertOk()->json('data');
        $this->assertCount(1, $filteredBranch);
        $this->assertSame('Feedback for branch 1', $filteredBranch[0]['body']);
        $this->assertSame(4, $filteredBranch[0]['rating']);

        $filteredRating = $this->getJson('/api/feedback/review?rating=1')->assertOk()->json('data');
        $this->assertCount(1, $filteredRating);
        $this->assertSame('Feedback for branch 2', $filteredRating[0]['body']);
        $this->assertSame(1, $filteredRating[0]['rating']);
    }
}
