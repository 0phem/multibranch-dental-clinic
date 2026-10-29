<?php

namespace Tests\Feature\Messaging;

use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\ConversationParticipant;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

// Real PHP processes (separate PostgreSQL connections, real commits) race M17 commands. Rebuilds the dedicated test database before and
// after itself (never the dev database).
class ConcurrentMessagingTest extends TestCase
{
    use SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('dental_clinic_scratch', config('database.connections.pgsql.database'), 'refusing to run outside the test database');
        $this->artisan('migrate:fresh')->assertSuccessful();
        $this->setUpSchedulingWorld();
        $this->travelBack();
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    private function conversation(): Conversation
    {
        $c = Conversation::create(['patient_id' => $this->p['A']->id, 'branch_id' => $this->b['b1']->id, 'context' => 'Follow-up', 'status' => 'Open', 'revision' => 1]);
        foreach (['patientA', 'staffB1'] as $who) {
            ConversationParticipant::create(['conversation_id' => $c->id, 'user_id' => $this->u[$who]->id, 'created_at' => now()]);
        }

        return $c;
    }

    /** @param list<array{0:string,1:string,2:array,3:string}> $requests [account, path, body, key] */
    private function race(array $requests): array
    {
        $startAt = microtime(true) + 2.0;
        $children = [];
        foreach ($requests as [$who, $path, $body, $key]) {
            $token = $this->u[$who]->createToken('concurrency-test')->plainTextToken;
            $process = proc_open([PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, $path, json_encode($body), (string) $startAt, json_encode(['Idempotency-Key' => $key])],
                [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path(),
                array_merge(getenv(), ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'dental_clinic_scratch', 'DB_URL' => '', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'BCRYPT_ROUNDS' => '4']));
            $children[] = [$process, $pipes];
        }
        $results = [];
        foreach ($children as [$process, $pipes]) {
            $out = stream_get_contents($pipes[1]);
            $err = stream_get_contents($pipes[2]);
            proc_close($process);
            $results[] = json_decode($out, true) ?? $this->fail("child process failed: {$out} {$err}");
        }

        return $results;
    }

    public function test_simultaneous_messages_from_both_participants_are_all_kept_in_one_deterministic_order(): void
    {
        $c = $this->conversation();
        $path = "/api/conversations/{$c->public_id}/messages";
        $results = $this->race([['patientA', $path, ['body' => 'from patient 1'], 'p1'], ['staffB1', $path, ['body' => 'from staff 1'], 's1'], ['patientA', $path, ['body' => 'from patient 2'], 'p2'], ['staffB1', $path, ['body' => 'from staff 2'], 's2']]);
        $this->assertSame([201, 201, 201, 201], array_column($results, 'status'), json_encode($results));
        $rows = ConversationMessage::where('conversation_id', $c->id)->orderBy('id')->get();
        $this->assertCount(4, $rows);
        $this->assertSame($rows->pluck('id')->sort()->values()->all(), $rows->pluck('id')->all(), 'one deterministic order');
        $this->assertSame(4, $rows->pluck('public_id')->unique()->count());
        $this->assertSame(['from patient 1', 'from patient 2', 'from staff 1', 'from staff 2'], $rows->pluck('body')->sort()->values()->all());
        // Each participant's read marker points at their own last message; the other side still has unread messages.
        $staff = ConversationParticipant::where('conversation_id', $c->id)->where('user_id', $this->u['staffB1']->id)->first();
        $this->assertSame($rows->where('sender_user_id', $this->u['staffB1']->id)->max('id'), $staff->last_read_message_id);
    }

    public function test_a_double_submitted_message_with_one_key_is_stored_once(): void
    {
        $c = $this->conversation();
        $path = "/api/conversations/{$c->public_id}/messages";
        $results = $this->race([['patientA', $path, ['body' => 'once'], 'same'], ['patientA', $path, ['body' => 'once'], 'same']]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertContains($statuses, [[201, 201], [201, 409]], json_encode($results));
        $this->assertSame(1, ConversationMessage::count());
        if ($statuses === [201, 201]) {
            $this->assertSame($results[0]['body']['data']['id'], $results[1]['body']['data']['id']);
        }
    }

    public function test_a_send_racing_closure_never_lands_after_the_conversation_is_closed(): void
    {
        $c = $this->conversation();
        $results = $this->race([['patientA', "/api/conversations/{$c->public_id}/messages", ['body' => 'racing'], 'r1'], ['staffB1', "/api/conversations/{$c->public_id}/close", ['expected_revision' => 1], 'r2']]);
        $fresh = $c->fresh();
        $this->assertSame('Closed', $fresh->status);
        $sent = collect($results)->where('status', 201)->count();
        $this->assertSame($sent, ConversationMessage::count(), 'a message exists exactly when its send was accepted');
        $this->assertSame(0, ConversationMessage::where('created_at', '>', $fresh->closed_at)->count(), 'nothing is posted after closure');
        if ($sent === 0) {
            $this->assertSame(422, collect($results)->firstWhere('status', '!=', 200)['status']);
        }
    }

    /** Posts 20 messages as the patient (real commits) and returns [conversation, public ids oldest-first]. */
    private function twentyMessages(): array
    {
        $c = $this->conversation();
        $this->actingAsUser('patientA');
        foreach (range(1, 20) as $n) {
            $this->postJson("/api/conversations/{$c->public_id}/messages", ['body' => "m{$n}"], ['Idempotency-Key' => "seed-{$n}"])->assertCreated();
        }

        return [$c, ConversationMessage::where('conversation_id', $c->id)->orderBy('id')->pluck('public_id')->all()];
    }

    private function staffMarker(Conversation $c): ?int
    {
        return ConversationParticipant::where('conversation_id', $c->id)->where('user_id', $this->u['staffB1']->id)->value('last_read_message_id');
    }

    /** A new Staff participant with no marker (the database refuses to reset a marker, so each scenario gets a fresh participant). */
    private function freshStaff(Conversation $c, string $key): void
    {
        $this->u[$key] = $this->account(\App\Enums\Role::Staff, 'b1');
        ConversationParticipant::create(['conversation_id' => $c->id, 'user_id' => $this->u[$key]->id, 'created_at' => now()]);
    }

    private function markerOf(Conversation $c, string $key): ?int
    {
        return ConversationParticipant::where('conversation_id', $c->id)->where('user_id', $this->u[$key]->id)->value('last_read_message_id');
    }

    public function test_concurrent_read_markers_end_at_the_furthest_message_whatever_the_request_order(): void
    {
        [$c, $ids] = $this->twentyMessages();
        $path = "/api/conversations/{$c->public_id}/read";
        $internal = ConversationMessage::where('conversation_id', $c->id)->orderBy('id')->pluck('id')->all();
        // 20 and 15 at the same instant (both orders and a duplicate pair): the furthest legitimate message always wins.
        foreach ([[19, 14], [14, 19], [19, 19]] as $round => [$one, $two]) {
            $who = "reader{$round}";
            $this->freshStaff($c, $who);
            $results = $this->race([[$who, $path, ['up_to' => $ids[$one]], "rd-{$round}-a"], [$who, $path, ['up_to' => $ids[$two]], "rd-{$round}-b"]]);
            $this->assertSame([200, 200], array_column($results, 'status'), json_encode($results));
            $this->assertSame($internal[max($one, $two)], $this->markerOf($c, $who), "round {$round}");
        }
        // Sequential: 15 then 20 advances; a stale 15 after 20 changes nothing.
        $this->freshStaff($c, 'sequential');
        $this->race([['sequential', $path, ['up_to' => $ids[14]], 'seq-1']]);
        $this->assertSame($internal[14], $this->markerOf($c, 'sequential'));
        $this->race([['sequential', $path, ['up_to' => $ids[19]], 'seq-2']]);
        $this->assertSame($internal[19], $this->markerOf($c, 'sequential'));
        $results = $this->race([['sequential', $path, ['up_to' => $ids[14]], 'seq-3']]);
        $this->assertSame(200, $results[0]['status']);
        $this->assertSame($internal[19], $this->markerOf($c, 'sequential'), 'a stale request after a newer one changes nothing');
    }

    public function test_a_read_racing_a_new_message_and_a_foreign_message_never_corrupt_read_state(): void
    {
        [$c, $ids] = $this->twentyMessages();
        $internal = ConversationMessage::where('conversation_id', $c->id)->orderBy('id')->pluck('id')->all();
        $elsewhere = Conversation::create(['patient_id' => $this->p['B']->id, 'branch_id' => $this->b['b1']->id, 'context' => 'Other', 'status' => 'Open', 'revision' => 1]);
        foreach (['patientB', 'staffB1'] as $who) {
            ConversationParticipant::create(['conversation_id' => $elsewhere->id, 'user_id' => $this->u[$who]->id, 'created_at' => now()]);
        }
        $this->actingAsUser('patientB');
        $this->postJson("/api/conversations/{$elsewhere->public_id}/messages", ['body' => 'foreign'], ['Idempotency-Key' => 'f1'])->assertCreated();
        $foreign = ConversationMessage::where('conversation_id', $elsewhere->id)->value('public_id');
        $path = "/api/conversations/{$c->public_id}/read";
        // The staff member reads up to m10, a foreign message is submitted, and the patient sends a new message — all at once.
        $results = $this->race([['staffB1', $path, ['up_to' => $ids[9]], 'x1'], ['staffB1', $path, ['up_to' => $foreign], 'x2'], ['patientA', "/api/conversations/{$c->public_id}/messages", ['body' => 'late arrival'], 'x3']]);
        $byStatus = array_count_values(array_column($results, 'status'));
        $this->assertSame([200 => 1, 422 => 1, 201 => 1], $byStatus, json_encode($results));
        $this->assertSame($internal[9], $this->staffMarker($c));
        $this->assertSame(11, ConversationMessage::where('conversation_id', $c->id)->where('id', '>', $internal[9])->where('sender_user_id', '<>', $this->u['staffB1']->id)->count(), 'm11..m20 and the late arrival are still unread');
        $this->assertNull(ConversationParticipant::where('conversation_id', $elsewhere->id)->where('user_id', $this->u['staffB1']->id)->value('last_read_message_id'), 'the other conversation is untouched');
    }
}
