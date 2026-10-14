<?php

namespace Tests\Feature\Billing;

use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\Invoice;
use App\Models\MailDispatch;
use App\Models\Patient;
use App\Models\ServicePrice;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoClinicSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Demo data for the demo and defense (decision 13): made through the real commands, separate, never in production, run once. */
class DemoClinicSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_builds_a_lived_in_demo_clinic_through_the_real_commands_and_emails_nobody_fictional(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoClinicSeeder::class);

        $this->assertSame(5, Patient::count(), 'the demo Patient plus four fictional patients');
        $this->assertGreaterThanOrEqual(3, Appointment::where('status', 'Confirmed')->count());
        $this->assertSame(2, Invoice::where('status', 'Paid')->count());
        $unpaid = Invoice::where('status', 'Issued')->with('patient.user')->sole();
        $this->assertSame('patient@example.test', $unpaid->patient->user->email, 'one unpaid invoice, for the demo Patient');
        $this->assertSame('1800.00', (string) $unpaid->patient_responsibility_amount);
        $this->assertSame(['1000.00', '800.00', '10000.00'], ServicePrice::orderBy('id')->pluck('amount')->map(fn ($a) => (string) $a)->all(), 'only interview Q12 demo prices');
        $this->assertSame(1, Conversation::count());
        $this->assertSame(0, MailDispatch::whereIn('status', ['pending', 'retry_scheduled'])
            ->whereHas('recipient', fn ($q) => $q->where('email', 'like', '%@example.test')->where('email', '!=', 'patient@example.test'))->count(), 'no fictional patient is emailed');

        $before = [Patient::count(), Invoice::count(), Appointment::count()];
        $this->seed(DemoClinicSeeder::class);
        $this->assertSame($before, [Patient::count(), Invoice::count(), Appointment::count()], 'a second run changes nothing');
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->app->instance('env', 'production');
        try {
            (new DemoClinicSeeder())->run();
        } finally {
            $this->app->instance('env', 'testing');
        }
        $this->assertSame(1, Patient::count());
        $this->assertSame(0, Invoice::count());
    }
}
