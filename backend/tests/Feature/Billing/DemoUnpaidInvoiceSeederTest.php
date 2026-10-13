<?php

namespace Tests\Feature\Billing;

use App\Models\Invoice;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoUnpaidInvoiceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Demo data for the PayMongo test checkout: an Issued, unpaid, itemized invoice made through the real billing commands. */
class DemoUnpaidInvoiceSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_issues_an_itemized_unpaid_invoice_for_the_demo_patient_through_the_billing_flow(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoUnpaidInvoiceSeeder::class);
        $invoice = Invoice::with(['lines', 'histories', 'patient.person'])->sole();
        $this->assertSame(['Issued', '1800.00', '1800.00', '0.00'], [$invoice->status, (string) $invoice->gross_amount, (string) $invoice->patient_responsibility_amount, (string) $invoice->paid_amount]);
        $this->assertSame([['Oral Prophylaxis', '1000.00'], ['Composite Restoration', '800.00']], $invoice->lines->sortBy('line_no')->map(fn ($l) => [$l->service_name, (string) $l->unit_price])->values()->all());
        $this->assertSame('patient@example.test', $invoice->patient->person->email);
        $this->assertSame(['invoice.created', 'invoice.reviewed', 'invoice.issued'], $invoice->histories->sortBy('id')->pluck('event')->values()->all());
        $this->seed(DemoUnpaidInvoiceSeeder::class); // each run adds one more unpaid invoice; prices are not duplicated
        $this->assertSame(2, Invoice::where('status', 'Issued')->count());
        $this->assertSame(2, \App\Models\ServicePrice::count());
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->app->instance('env', 'production');
        try {
            (new DemoUnpaidInvoiceSeeder())->run();
        } finally {
            $this->app->instance('env', 'testing');
        }
        $this->assertSame(0, Invoice::count());
    }
}
