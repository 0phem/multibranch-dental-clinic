<?php

namespace Tests\Feature\Charts;

use App\Models\AuditLog;
use App\Models\ToothChartEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

/** M10 Dental Charts (SchedulingFixture: patient A has an appointment at b1; d1, d2 at b1; d3 at b2). */
class DentalChartTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-29', '10:00');
    }

    private function record(array $body)
    {
        return $this->postJson('/api/patients/'.$this->p['A']->public_id.'/chart', $body + ['tooth' => '36', 'status' => 'Caries', 'surfaces' => ['O', 'D'], 'note' => 'Deep lesion, monitor sensitivity']);
    }

    public function test_history_is_append_only_and_the_current_chart_is_the_latest_entry_per_tooth(): void
    {
        $this->actingAsUser('dentist1');
        $this->record([])->assertCreated();
        $chart = $this->record(['status' => 'Filled', 'surfaces' => ['O', 'D']])->assertCreated();
        $this->record(['tooth' => '55', 'status' => 'Healthy', 'surfaces' => []])->assertCreated(); // a primary tooth
        $chart = $this->getJson('/api/patients/'.$this->p['A']->public_id.'/chart')->assertOk();
        $current = collect($chart->json('data.current'))->keyBy('tooth');
        $this->assertSame('Filled', $current['36']['status']);
        $this->assertCount(3, $chart->json('data.history'));
        $this->assertSame('fdi', $chart->json('data.settings.numbering'));
        $this->record(['status' => 'Purple'])->assertStatus(422); // only the Owner's list
        $this->record(['tooth' => '19'])->assertStatus(422);     // not a tooth
        $this->record(['recorded_on' => '2026-10-01'])->assertStatus(422); // not in the future
        foreach ([fn () => ToothChartEntry::query()->update(['status' => 'Healthy']), fn () => ToothChartEntry::query()->delete()] as $change) {
            try { DB::transaction($change); $this->fail('history changed'); } catch (\Illuminate\Database\QueryException) {}
        }
    }

    public function test_roles_see_what_they_should_and_audit_holds_no_notes(): void
    {
        $this->actingAsUser('dentist3');
        $this->record([])->assertForbidden(); // not caring for this patient
        $this->actingAsUser('dentist2');
        $this->record([])->assertForbidden(); // same branch, but not their patient: access is workflow-tied, never branch-wide
        $this->getJson('/api/patients/'.$this->p['A']->public_id.'/chart')->assertNotFound();
        $cancelled = $this->existing('A', 'd2', 'b1', 'svc1', '2026-09-30', '11:00');
        $cancelled->update(['status' => 'Cancelled']);
        $this->record([])->assertForbidden(); // a cancelled booking grants nothing
        $this->actingAsUser('dentist1');
        $this->record([])->assertCreated();

        $this->actingAsUser('staffB1');
        $staff = $this->getJson('/api/patients/'.$this->p['A']->public_id.'/chart')->assertOk();
        $this->assertSame('Caries', $staff->json('data.current.0.status'));
        $this->assertStringNotContainsString('Deep lesion', $staff->getContent()); // read-only chart without notes
        $this->record([])->assertForbidden();
        $this->actingAsUser('owner');
        $this->getJson('/api/patients/'.$this->p['A']->public_id.'/chart')->assertForbidden();
        $this->actingAsUser('patientA');
        $mine = $this->getJson('/api/me/chart')->assertOk();
        $this->assertSame('Caries', $mine->json('data.current.0.status'));
        $this->assertNull($mine->json('data.history'));
        $this->assertStringNotContainsString('Deep lesion', $mine->getContent());
        $this->actingAsUser('patientB');
        $this->getJson('/api/me/chart?patient_id='.$this->p['A']->public_id)->assertNotFound();

        $audit = AuditLog::where('action', 'like', 'chart.%')->get();
        $this->assertSame(['chart.recorded', 'chart.viewed'], $audit->pluck('action')->all());
        $this->assertStringNotContainsString('Deep lesion', $audit->toJson());
        $this->assertNotSame('Deep lesion, monitor sensitivity', DB::table('tooth_chart_entries')->value('note')); // encrypted at rest
    }
}
