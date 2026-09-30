<?php

namespace Tests\Feature\Billing;

use App\Enums\Role;
use App\Models\{Invoice,PatientHmoMembership,Payment,Receipt,ServicePrice,Treatment,TreatmentProcedure,Visit};
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

/** Real PHP processes race M11 commands over separate PostgreSQL connections. */
class ConcurrentBillingTest extends TestCase
{
    use SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('dental_clinic_test', config('database.connections.pgsql.database'));
        $this->artisan('migrate:fresh')->assertSuccessful();
        $this->setUpSchedulingWorld();
        DB::table('m11_billing_cutovers')->where('id', 1)->update(['established_at' => '2026-09-01 00:00:00+08']);
        $this->travelTo(CarbonImmutable::parse('2026-09-28 10:00:00', 'Asia/Manila'));
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    private function completed(string $patient = 'A', string $when = '2026-09-28 09:00:00'): Treatment
    {
        $visit = Visit::create(['patient_id' => $this->p[$patient]->id, 'branch_id' => $this->b['b1']->id, 'source' => 'walk_in', 'status' => 'Checked In', 'responsible_dentist_profile_id' => $this->d['d1']->id, 'requested_service_id' => $this->svc['svc1']->id, 'arrived_at' => $when, 'clinic_date' => substr($when, 0, 10), 'revision' => 1, 'created_by_user_id' => $this->u['staffB1']->id, 'updated_by_user_id' => $this->u['staffB1']->id]);
        $treatment = DB::transaction(function () use ($visit, $when) {
            $visit->update(['status' => 'In Treatment', 'revision' => 2]);
            $treatment = Treatment::create(['visit_id' => $visit->id, 'dentist_profile_id' => $visit->responsible_dentist_profile_id, 'status' => 'In Treatment', 'procedure_summary' => 'Completed procedure', 'started_at' => $when, 'revision' => 1, 'created_by_user_id' => $this->u['dentist1']->id, 'updated_by_user_id' => $this->u['dentist1']->id]);
            TreatmentProcedure::create(['treatment_id' => $treatment->id, 'service_id' => $this->svc['svc1']->id, 'line_no' => 1, 'quantity' => 1, 'service_code' => $this->svc['svc1']->code, 'service_name' => $this->svc['svc1']->name]);
            return $treatment;
        });
        DB::transaction(function () use ($visit, $treatment, $when) {
            $treatment->update(['status' => 'Completed', 'completed_at' => $when, 'revision' => 2]);
            $visit->update(['status' => 'Completed', 'closed_at' => $when, 'revision' => 3]);
        });
        return $treatment->fresh(['visit']);
    }

    private function race(array $requests): array
    {
        $token = $this->u['staffB1']->createToken('m11-concurrency')->plainTextToken;
        $startAt = microtime(true) + 1.0;
        $children = [];
        foreach ($requests as [$path, $payload, $headers]) {
            $process = proc_open([PHP_BINARY, base_path('tests/Support/concurrent_request.php'), $token, $path, json_encode($payload), (string) $startAt, json_encode($headers)], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path(), array_merge(getenv(), ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'dental_clinic_test', 'DB_URL' => '', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync']));
            $children[] = [$process, $pipes];
        }
        $results = [];
        foreach ($children as [$process, $pipes]) {
            $out = stream_get_contents($pipes[1]);
            $err = stream_get_contents($pipes[2]);
            proc_close($process);
            $results[] = json_decode($out, true) ?: $this->fail("child process failed: {$out} {$err}");
        }
        return $results;
    }

    public function test_concurrent_draft_creation_leaves_one_invoice_and_one_line(): void
    {
        ServicePrice::create(['service_id' => $this->svc['svc1']->id, 'branch_id' => $this->b['b1']->id, 'kind' => 'priced', 'amount' => '125.50', 'effective_from' => '2026-09-01', 'source' => 'owner_confirmed', 'created_by_user_id' => $this->u['owner']->id, 'created_at' => now()]);
        $treatment = $this->completed();
        $results = $this->race([
            ["/api/invoices/from-treatment/{$treatment->public_id}", [], ['Idempotency-Key' => 'draft-a']],
            ["/api/invoices/from-treatment/{$treatment->public_id}", [], ['Idempotency-Key' => 'draft-b']],
        ]);
        $this->assertContains(201, array_column($results, 'status'));
        $this->assertCount(1, Invoice::where('treatment_id', $treatment->id)->get());
        $this->assertSame(1, DB::table('invoice_lines')->where('invoice_id', Invoice::sole()->id)->count());
        $this->assertSame(1, Invoice::where('invoice_number', Invoice::sole()->invoice_number)->count());
    }

    public function test_concurrent_payment_creates_one_payment_and_one_receipt(): void
    {
        ServicePrice::create(['service_id' => $this->svc['svc1']->id, 'branch_id' => $this->b['b1']->id, 'kind' => 'priced', 'amount' => '125.50', 'effective_from' => '2026-09-01', 'source' => 'owner_confirmed', 'created_by_user_id' => $this->u['owner']->id, 'created_at' => now()]);
        $treatment = $this->completed();
        $this->actingAsUser('staffB1');
        $invoice = Invoice::where('public_id', $this->postJson("/api/invoices/from-treatment/{$treatment->public_id}", [], ['Idempotency-Key' => 'setup-draft'])->assertCreated()->json('data.id'))->firstOrFail();
        $this->postJson("/api/invoices/{$invoice->public_id}/review", ['expected_revision' => 1], ['Idempotency-Key' => 'setup-review'])->assertOk();
        $this->postJson("/api/invoices/{$invoice->public_id}/issue", ['expected_revision' => 2], ['Idempotency-Key' => 'setup-issue'])->assertOk();
        $results = $this->race([
            ["/api/invoices/{$invoice->public_id}/payment", ['expected_revision' => 3, 'method' => 'Cash', 'amount' => '125.50'], ['Idempotency-Key' => 'pay-a']],
            ["/api/invoices/{$invoice->public_id}/payment", ['expected_revision' => 3, 'method' => 'Cash', 'amount' => '125.50'], ['Idempotency-Key' => 'pay-b']],
        ]);
        $this->assertContains(200, array_column($results, 'status'));
        $this->assertSame(1, Payment::where('invoice_id', $invoice->id)->count());
        $this->assertSame(1, Receipt::where('payment_id', Payment::sole()->id)->count());
        $this->assertSame('Paid', $invoice->fresh()->status);
    }

    public function test_same_idempotency_key_replays_and_different_payload_conflicts_under_retry(): void
    {
        ServicePrice::create(['service_id' => $this->svc['svc1']->id, 'branch_id' => $this->b['b1']->id, 'kind' => 'priced', 'amount' => '125.50', 'effective_from' => '2026-09-01', 'source' => 'owner_confirmed', 'created_by_user_id' => $this->u['owner']->id, 'created_at' => now()]);
        $first = $this->completed('A');
        $second = $this->completed('B', '2026-09-28 09:30:00');
        $results = $this->race([
            ["/api/invoices/from-treatment/{$first->public_id}", [], ['Idempotency-Key' => 'same-key']],
            ["/api/invoices/from-treatment/{$first->public_id}", [], ['Idempotency-Key' => 'same-key']],
        ]);
        $this->assertSame(2, count(array_filter(array_column($results, 'status'), fn ($status) => $status === 201)));
        $this->assertSame(1, Invoice::count());
        $different = $this->race([["/api/invoices/from-treatment/{$second->public_id}", [], ['Idempotency-Key' => 'same-key']]]);
        $this->assertSame(409, $different[0]['status']);
        $this->assertSame('idempotency_key_reused', $different[0]['body']['code']);
        $this->assertSame(1, Invoice::count());
    }
}
