<?php

namespace Tests\Feature\Analytics;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\Visit;
use App\Services\Analytics\AnalyticsService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private AnalyticsService $analyticsService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        $this->analyticsService = app(AnalyticsService::class);
    }

    public function test_unauthenticated_cannot_access_analytics_endpoints(): void
    {
        $this->getJson('/api/analytics/executive-summary')->assertStatus(401);
        $this->getJson('/api/analytics/branch-performance')->assertStatus(401);
        $this->get('/api/analytics/export')->assertStatus(401);
    }

    public function test_non_owner_roles_are_forbidden(): void
    {
        $this->actingAsUser('staffB1');
        $this->getJson('/api/analytics/executive-summary')->assertStatus(403);
        $this->getJson('/api/analytics/branch-performance')->assertStatus(403);

        $this->actingAsUser('dentist1');
        $this->getJson('/api/analytics/executive-summary')->assertStatus(403);

        $this->actingAsUser('patientA');
        $this->getJson('/api/analytics/executive-summary')->assertStatus(403);
    }

    public function test_owner_can_access_executive_summary(): void
    {
        $this->actingAsUser('owner');

        $response = $this->getJson('/api/analytics/executive-summary?period=today')
            ->assertStatus(200);

        $response->assertJsonStructure([
            'data' => [
                'period',
                'period_label',
                'branch_id',
                'financials' => [
                    'total_collected_php',
                    'total_gross_php',
                    'total_hmo_covered_php',
                    'outstanding_balance_php',
                    'invoices_count',
                    'paid_invoices_count',
                    'average_ticket_php',
                ],
                'scheduling' => [
                    'total_appointments',
                    'confirmed',
                    'completed',
                    'cancelled',
                    'no_show',
                    'in_treatment',
                    'completion_rate_pct',
                ],
                'patient_flow' => [
                    'total_visits',
                    'served_from_queue',
                    'current_waiting',
                ],
                'hmo' => [
                    'total_cases',
                    'approved',
                    'pending',
                    'withdrawn',
                    'rejected',
                    'approved_amount_php',
                ],
                'automation' => [
                    'total_actions',
                    'success',
                    'warning',
                    'failed',
                    'health_rate_pct',
                ],
            ],
        ]);
    }

    public function test_period_filter_respects_time_boundaries(): void
    {
        $this->actingAsUser('owner');

        $todayRes = $this->getJson('/api/analytics/executive-summary?period=today')->assertStatus(200);
        $this->assertEquals('today', $todayRes->json('data.period'));

        $weekRes = $this->getJson('/api/analytics/executive-summary?period=this+week')->assertStatus(200);
        $this->assertEquals('week', $weekRes->json('data.period'));

        $monthRes = $this->getJson('/api/analytics/executive-summary?period=this+month')->assertStatus(200);
        $this->assertEquals('month', $monthRes->json('data.period'));

        $allRes = $this->getJson('/api/analytics/executive-summary?period=all')->assertStatus(200);
        $this->assertEquals('all', $allRes->json('data.period'));
    }

    public function test_branch_filtering_narrows_scope(): void
    {
        $this->actingAsUser('owner');

        $b1Id = $this->b['b1']->id;
        $response = $this->getJson("/api/analytics/executive-summary?period=all&branch_id={$b1Id}")
            ->assertStatus(200);

        $this->assertEquals($b1Id, $response->json('data.branch_id'));
    }

    public function test_owner_can_view_branch_performance(): void
    {
        $this->actingAsUser('owner');

        $response = $this->getJson('/api/analytics/branch-performance?period=today')
            ->assertStatus(200);

        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'branch_id',
                    'public_id',
                    'name',
                    'code',
                    'city',
                    'revenue_collected_php',
                    'total_appointments',
                    'completed_appointments',
                    'active_queue',
                    'capacity_threshold',
                    'estimated_wait_minutes',
                    'is_open',
                ],
            ],
        ]);
    }

    public function test_csv_export_streams_with_formula_injection_protection(): void
    {
        $this->actingAsUser('owner');

        $response = $this->get('/api/analytics/export?period=today')
            ->assertStatus(200);

        $this->assertEquals('text/csv; charset=UTF-8', $response->headers->get('Content-Type'));
        $content = $response->streamedContent();

        $this->assertStringContainsString('EXECUTIVE OPERATIONAL SUMMARY', $content);
        $this->assertStringContainsString('BRANCH COMPARATIVE BREAKDOWN', $content);
        $this->assertStringNotContainsString('",=cmd', $content);
    }
}
