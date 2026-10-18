<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\MailDispatch;
use App\Models\Patient;
use App\Models\Person;
use App\Models\Service;
use App\Models\User;
use App\Models\Visit;
use App\Services\Appointments\AppointmentCommandException;
use App\Services\Appointments\AppointmentService;
use App\Services\Billing\BillingService;
use App\Services\Messaging\MessagingService;
use App\Support\ClinicClock;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * DEMO DATA ONLY (decision 13): a lived-in clinic for the demo and the defense, in a SEPARATE demo database. Refuses to run in
 * production, and runs once per database (a second run changes nothing). Run after `php artisan db:seed`:
 *
 *   php artisan db:seed --class=DemoClinicSeeder
 *
 * Everything goes through the clinic's real commands (appointment booking, the visit → Treatment → invoice order, Staff payment,
 * Patient messaging), so the data obeys every rule the live system enforces. People and contact details are fictional
 * (@example.test). Prices are DEMO PRICES from interview Q12 (lower end), not the clinic's price list. Emails that seeding would
 * queue for the fictional @example.test patients are cancelled (marked superseded), so nobody is emailed.
 */
class DemoClinicSeeder extends Seeder
{
    use Concerns\CreatesDemoVisits;

    private const PATIENTS = [
        ['Maria', 'Santos', 'maria.santos@example.test', '09171234501', '1990-04-12', 'Female'],
        ['Juan', 'Dela Cruz', 'juan.delacruz@example.test', '09171234502', '1985-09-03', 'Male'],
        ['Lorna', 'Reyes', 'lorna.reyes@example.test', '09171234503', '1978-01-25', 'Female'],
        ['Miguel', 'Bautista', 'miguel.bautista@example.test', '09171234504', '2001-07-18', 'Male'],
    ];

    public function run(): void
    {
        if ($refusal = \App\Support\ClinicDatabaseGuard::refusal('DemoClinicSeeder')) {
            $this->command?->error($refusal);

            return;
        }
        if (app()->isProduction()) {
            $this->command?->error('DemoClinicSeeder refuses to run in production.');

            return;
        }
        $owner = User::where('email', 'owner@example.test')->first();
        $staff = User::where('email', 'staff.reception@example.test')->first();
        $branch = Branch::where('legacy_ref', 'b1')->first();
        $dentist = DentistProfile::where('legacy_ref', 'd1')->first();
        $demoPatientUser = User::where('role', Role::Patient)->whereHas('person', fn ($q) => $q->where('first_name', 'Demo')->orWhere('last_name', 'Villanueva'))->first();
        if (! $owner || ! $staff || ! $branch || ! $dentist || ! $demoPatientUser?->patient) {
            $this->command?->error('DemoClinicSeeder needs the base demo data: run `php artisan db:seed` first.');

            return;
        }
        $this->call(RealBranchSeeder::class); // the clinic's real branch names, addresses, contacts, hours and map coordinates
        $this->call(AssistantAnswerSeeder::class); // the assistant's draft answers (from facts in the repository)
        $this->call(InterviewRoundTwoDemoSeeder::class); // R2: consultation-first services, unverified HMOs, demo names
        if (Person::where('email', self::PATIENTS[0][2])->exists()) {
            $this->command?->warn('DemoClinicSeeder already ran on this database; demo data unchanged (real branch names, contacts and opening hours checked).');

            return;
        }
        // Jobs are not handed to a running worker while seeding (it could email a fictional patient before the cancel below);
        // the email intents stay in the outbox and the mail sweeper (`mail:process-due`, run by the scheduler) sends the real ones.
        config(['queue.default' => 'null']);
        $firstDispatch = (int) MailDispatch::max('id');
        $password = Hash::make(env('DEMO_ACCOUNT_PASSWORD', 'DemoPass123'));

        // Realistic names for the demo Dentist and the demo Patient (their sign-in emails do not change).
        $dentistUser = User::where('person_id', $dentist->person_id)->first();
        Person::whereKey($dentist->person_id)->update(['first_name' => 'Camille', 'last_name' => 'Santiago']);
        $demoPatientUser->person->update(['first_name' => 'Bea', 'last_name' => 'Villanueva']);

        $patients = [];
        foreach (self::PATIENTS as [$first, $last, $email, $phone, $born, $sex]) {
            $person = Person::create(['first_name' => $first, 'last_name' => $last, 'email' => $email, 'phone' => $phone, 'date_of_birth' => $born, 'sex' => $sex]);
            $patient = Patient::create(['person_id' => $person->id, 'patient_code' => Patient::nextCode(), 'consent' => true]);
            User::create(['person_id' => $person->id, 'email' => $email, 'password' => $password, 'role' => Role::Patient, 'account_status' => 'Active', 'email_verified_at' => now()]);
            $patients[$first] = $patient->load('person');
        }
        $this->ensureDemoPrices($owner, ['svc2', 'svc3', 'svc4']);

        // Upcoming appointments, booked by the front desk through the real scheduling rules.
        $booked = 0;
        foreach ([[$demoPatientUser->patient, 'svc2'], [$patients['Maria'], 'svc1'], [$patients['Lorna'], 'svc2'], [$patients['Miguel'], 'svc1']] as $i => [$patient, $ref]) {
            $booked += $this->book($staff, $patient, $branch, Service::where('legacy_ref', $ref)->firstOrFail(), $i) ? 1 : 0;
        }

        // History: two completed visits that were paid at the front desk, and one unpaid invoice ready to pay online.
        $billing = app(BillingService::class);
        $paid = $this->issueInvoice($staff, $this->completedTreatment($patients['Juan'], $branch, $dentist, $dentistUser ?? $owner, ['svc4']));
        $billing->pay($staff, $paid, $paid->revision, 'Cash', null);
        $paid2 = $this->issueInvoice($staff, $this->completedTreatment($patients['Lorna'], $branch, $dentist, $dentistUser ?? $owner, ['svc2', 'svc3']));
        $billing->pay($staff, $paid2, $paid2->revision, 'E-Wallet', 'DEMO-GCASH-'.Str::upper(Str::random(6)));
        $unpaid = $this->issueInvoice($staff, $this->completedTreatment($demoPatientUser->patient, $branch, $dentist, $dentistUser ?? $owner, ['svc2', 'svc3']));

        // A conversation the demo Patient started with the front desk, and the clinic's reply.
        $messaging = app(MessagingService::class);
        $started = $messaging->start($demoPatientUser, $branch, 'Hi! Can I also have my teeth cleaned when I come in for my appointment? Thank you.', 'demo-conv-'.Str::uuid())->getData(true);
        $conversation = \App\Models\Conversation::where('public_id', $started['data']['conversation']['id'])->firstOrFail();
        $messaging->send($staff, $conversation, 'Hello Bea! Yes, we can do the cleaning during the same visit. See you then.', 'demo-reply-'.Str::uuid());

        // Nobody fictional is emailed: cancel what seeding queued for @example.test addresses (the real demo inbox still gets its emails).
        $cancelled = MailDispatch::where('id', '>', $firstDispatch)->whereIn('status', ['pending', 'retry_scheduled'])
            ->whereHas('recipient', fn ($q) => $q->where('email', 'like', '%@example.test'))->update(['status' => 'superseded', 'completed_at' => now()]);

        $this->command?->info("Demo clinic ready: 4 patients, {$booked} upcoming appointments, 2 paid invoices, unpaid {$unpaid->invoice_number} (PHP {$unpaid->patient_responsibility_amount}) for {$demoPatientUser->email}, 1 conversation. {$cancelled} email(s) to fictional patients cancelled.");
    }

    /** Books the first valid slot from the next weekday on (09:00–16:00, hourly), by the front desk; false if none is free. */
    private function book(User $staff, Patient $patient, Branch $branch, Service $service, int $offset): bool
    {
        $appointments = app(AppointmentService::class);
        for ($day = 1 + $offset; $day <= 14 + $offset; $day++) {
            $date = ClinicClock::now()->addDays($day);
            if ($date->isSunday()) continue;
            foreach (['10:00', '11:00', '14:00', '15:00', '09:00', '16:00'] as $time) {
                try {
                    $response = $appointments->create($staff, $patient, $branch, $service, null, ['date' => $date->toDateString(), 'start_time' => $time], 'demo-appt-'.Str::uuid());
                    if ($response->getStatusCode() < 300) return true;
                } catch (AppointmentCommandException) {
                    // not a valid slot under the clinic's rules: try the next one
                }
            }
        }
        $this->command?->warn("  no free slot found for {$patient->person?->first_name} ({$service->name}); skipped");

        return false;
    }
}
