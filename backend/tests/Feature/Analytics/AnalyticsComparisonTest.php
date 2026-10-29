<?php

namespace Tests\Feature\Analytics;

use App\Models\{Invoice, Payment, Treatment, Visit};
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

class AnalyticsComparisonTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private function invoice(string $date, string $amount, string $status = 'Paid', string $branch = 'b1'): void
    {
        $when=CarbonImmutable::parse($date.' 12:00:00','Asia/Manila');
        $dentist=$this->d[$branch==='b1'?'d1':'d3'];
        $visit=Visit::create(['patient_id'=>$this->p['A']->id,'branch_id'=>$this->b[$branch]->id,'source'=>'walk_in','status'=>'Completed',
            'responsible_dentist_profile_id'=>$dentist->id,'requested_service_id'=>$this->svc['svc1']->id,'arrived_at'=>$when->subHour(),
            'clinic_date'=>$date,'closed_at'=>$when,'revision'=>1,'created_by_user_id'=>$this->u['owner']->id,'updated_by_user_id'=>$this->u['owner']->id]);
        $treatment=Treatment::create(['visit_id'=>$visit->id,'dentist_profile_id'=>$dentist->id,'status'=>'Completed','started_at'=>$when->subMinutes(30),
            'completed_at'=>$when,'revision'=>1,'created_by_user_id'=>$this->u['owner']->id,'updated_by_user_id'=>$this->u['owner']->id]);
        $invoice=new Invoice(['visit_id'=>$visit->id,'treatment_id'=>$treatment->id,'patient_id'=>$this->p['A']->id,'branch_id'=>$this->b[$branch]->id,
            'invoice_number'=>'INV-A5-'.Str::upper(Str::random(10)),'status'=>$status,'revision'=>1,'gross_amount'=>$amount,'discount_amount'=>'0.00',
            'hmo_coverage_amount'=>'0.00','patient_responsibility_amount'=>$amount,'paid_amount'=>$status==='Paid'?$amount:'0.00','issued_at'=>$when,
            'paid_at'=>$status==='Paid'?$when:null,'created_by_user_id'=>$this->u['owner']->id,'updated_by_user_id'=>$this->u['owner']->id]);
        $invoice->created_at=$when; $invoice->updated_at=$when; $invoice->save();
        if($status==='Paid') Payment::create(['invoice_id'=>$invoice->id,'amount'=>$amount,'method'=>'Cash','recorded_by_user_id'=>$this->u['owner']->id,'recorded_at'=>$when]);
    }

    public function test_custom_current_and_previous_windows_keep_payment_visit_and_outstanding_definitions_and_branch_scope(): void
    {
        $this->setUpSchedulingWorld();
        $this->travelTo(CarbonImmutable::parse('2026-10-29 15:00:00','Asia/Manila'));
        $this->invoice('2026-09-29','2000.00');
        $this->invoice('2026-09-30','1000.00');
        $this->invoice('2026-10-29','500.00');
        $this->invoice('2026-09-30','400.25','Issued');
        $this->invoice('2026-09-29','900.00','Issued');
        $this->invoice('2026-10-29','9000.00','Paid','b2');
        $this->invoice('2026-08-30','8000.00'); // before both windows
        $this->invoice('2026-10-30','7000.00'); // after the current window
        $this->actingAsUser('owner');
        $branch=$this->b['b1']->public_id;
        $current="date_from=2026-09-30&date_to=2026-10-29&branch_id=$branch";
        $previous="date_from=2026-08-31&date_to=2026-09-29&branch_id=$branch";
        $this->getJson('/api/analytics/daily-revenue?'.$current)->assertOk()->assertJsonPath('data.totals.gross_collected_php','1500.00')->assertJsonCount(30,'data.days');
        $this->getJson('/api/analytics/daily-revenue?'.$previous)->assertOk()->assertJsonPath('data.totals.gross_collected_php','2000.00')->assertJsonCount(30,'data.days');
        $this->getJson('/api/analytics/executive-summary?'.$current)->assertOk()->assertJsonPath('data.patient_flow.total_visits',3)
            ->assertJsonPath('data.financials.outstanding_balance_php','400.25');
        $this->getJson('/api/analytics/executive-summary?'.$previous)->assertOk()->assertJsonPath('data.patient_flow.total_visits',2)
            ->assertJsonPath('data.financials.outstanding_balance_php','900.00');
    }
}
