<?php

namespace Tests\Feature\Intake;

use App\Mail\AppointmentConfirmationMail;
use App\Mail\OneTimeCodeMail;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\IntakeSubmission;
use App\Models\MailDispatch;
use App\Models\Patient;
use App\Models\PatientGuardian;
use App\Models\Person;
use App\Services\Intake\JoinCodes;
use App\Services\Mail\MailOutbox;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Appointments\SchedulingFixture;
use Tests\TestCase;

/**
 * Registration intake (R2-03, R2-05, R2-08, R2-12) and the demo fixes: the daily counter code, rate limits, the cross-branch
 * duplicate guard, minors and guardians, the own-account claim, that no ID image or number is stored, the fake-domain mail
 * guard and the calendar counting each dentist once. Frozen at Monday 2026-09-28 10:00 Asia/Manila.
 */
class IntakeTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private const FAKE_ID_NUMBER = 'PSN-7777-0000-1234-5678';

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->setUpSchedulingWorld();
    }

    private function form(array $self = [], array $extra = []): array
    {
        return $extra + ['branch_ref' => 'b1', 'code' => JoinCodes::current($this->b['b1'])->code, 'consent' => true, 'join_queue' => true, 'channel' => 'phone',
            'self' => $self + ['first_name' => 'Joanna', 'last_name' => 'Specimen', 'date_of_birth' => '1990-05-17', 'sex' => 'Female', 'phone' => '0917 555 0101',
                'email' => null, 'address' => 'Bocaue, Bulacan', 'emergency_contact' => ['name' => 'Ramon Specimen', 'phone' => '0917 555 0102']],
            'scan' => ['id_type' => 'philid', 'fields' => ['first_name', 'last_name', 'date_of_birth']]];
    }

    private function submitForm(array $body, string $device = 'device-a')
    {
        return $this->withHeaders(['X-Device-Id' => $device])->postJson('/api/public/intake', $body);
    }

    public function test_the_daily_counter_code_is_required_changes_on_refresh_and_expires_at_midnight(): void
    {
        $this->submitForm($this->form([], ['code' => null]))->assertStatus(422)->assertJsonValidationErrors('code');
        $this->submitForm($this->form([], ['code' => 'WRONG1']))->assertStatus(422)->assertJsonValidationErrors('code');
        $this->actingAsUser('staffB1');
        $code = $this->getJson('/api/intake/code')->assertOk()->json('data.code');
        $this->app['auth']->forgetGuards();
        $this->submitForm($this->form([], ['code' => strtolower($code)]))->assertCreated()->assertJsonPath('data.join_queue', true);

        $this->actingAsUser('staffB1');
        $new = $this->postJson('/api/intake/code/refresh')->assertOk()->json('data.code');
        $this->assertNotSame($code, $new);
        $this->app['auth']->forgetGuards();
        $this->submitForm($this->form(['phone' => '0917 555 0199'], ['code' => $code]), 'device-b')->assertStatus(422);

        $this->travelTo(CarbonImmutable::parse('2026-09-29 00:00', 'Asia/Manila')); // the next clinic day
        $this->submitForm($this->form(['phone' => '0917 555 0198'], ['code' => $new]), 'device-c')->assertStatus(422);
        $this->assertTrue(AuditLog::where('action', 'intake.join_code_refreshed')->exists());
    }

    public function test_registrations_are_rate_limited_per_device(): void
    {
        for ($i = 0; $i < 4; $i++) $this->submitForm($this->form(['phone' => '0917 555 01'.(10 + $i)]))->assertCreated();
        $this->submitForm($this->form(['phone' => '0917 555 0120']))->assertStatus(429);
        $this->submitForm($this->form(['phone' => '0917 555 0121']), 'device-other')->assertCreated(); // another device is not blocked
    }

    public function test_a_possible_existing_patient_from_another_branch_is_shown_and_never_auto_merged(): void
    {
        $existing = $this->p['B'];
        $existing->person->update(['first_name' => 'Joanna', 'last_name' => 'Specimen', 'date_of_birth' => '1990-05-17', 'phone' => '+639175550101']);
        $this->existing('B', 'd3', 'b2', 'svc1', '2026-09-20', '10:00', 30, 'Completed');
        $people = Person::count();
        $this->submitForm($this->form())->assertCreated();

        $this->actingAsUser('staffB1');
        $row = $this->getJson('/api/intake/submissions')->assertOk()->json('data.0');
        $this->assertSame('Self-registered', $row['channel'] === 'phone' ? 'Self-registered' : null);
        $this->assertSame($existing->public_id, $row['duplicates'][0]['patient_id']);
        $this->assertSame('Branch B2', $row['duplicates'][0]['found_from']); // "Record found from Branch X" (R2-08)
        $this->assertSame($people, Person::count()); // nothing created before staff decide

        $this->postJson("/api/intake/submissions/{$row['id']}/confirm", ['use_patient' => $existing->public_id, 'id_verified' => true, 'id_type' => 'philid'])
            ->assertOk()->assertJsonPath('data.patient.id', $existing->public_id);
        $this->assertSame($people, Person::count());
        $this->assertNotNull($existing->fresh()->id_verified_at);
        $this->assertSame(1, \App\Models\Visit::where('patient_id', $existing->id)->where('source', 'walk_in')->count()); // joined today's queue
        $audit = AuditLog::where('action', 'intake.confirmed')->sole();
        $this->assertTrue($audit->payload['used_existing_record']);
    }

    public function test_staff_confirm_or_correct_a_new_registration_and_corrections_are_audited(): void
    {
        $this->submitForm($this->form())->assertCreated();
        $this->actingAsUser('staffB2');
        $this->getJson('/api/intake/submissions')->assertOk()->assertJsonCount(0, 'data'); // another branch's staff
        $this->actingAsUser('staffB1');
        $id = $this->getJson('/api/intake/submissions')->json('data.0.id');
        $this->postJson("/api/intake/submissions/$id/confirm", ['corrections' => ['last_name' => 'Specimen-Cruz'], 'id_verified' => true, 'id_type' => 'drivers_license', 'id_last4' => '9999'])->assertOk();
        $patient = Patient::whereHas('person', fn ($q) => $q->where('last_name', 'Specimen-Cruz'))->sole();
        $this->assertSame('counter', $patient->registration_source);
        $this->assertNull($patient->id_last4); // the Owner did not turn on keeping the last 4 characters
        $this->assertSame(['last_name'], AuditLog::where('action', 'intake.confirmed')->sole()->payload['corrected_fields']);
        $this->assertSame(['confirmed' => true], IntakeSubmission::sole()->data); // the form is not kept once it is the record
        $this->postJson("/api/intake/submissions/$id/confirm", [])->assertStatus(422); // handled once
    }

    public function test_a_minor_needs_a_guardian_and_the_guardian_registers_the_child_in_the_same_form(): void
    {
        $this->submitForm($this->form(['date_of_birth' => '2012-01-01']))->assertStatus(422)->assertJsonValidationErrors('self.date_of_birth');
        $this->submitForm($this->form([], ['visit_for' => 'dependent:0', 'dependents' => [['first_name' => 'Ana', 'last_name' => 'Specimen', 'date_of_birth' => '2018-03-03', 'relationship' => 'Daughter']]]))->assertCreated();
        $this->actingAsUser('staffB1');
        $row = $this->getJson('/api/intake/submissions')->json('data.0');
        $this->assertTrue($row['dependents'][0]['minor']);
        $this->postJson("/api/intake/submissions/{$row['id']}/confirm", ['id_verified' => true, 'id_type' => 'umid'])->assertOk()->assertJsonPath('data.patient.name', 'Ana Specimen');
        $link = PatientGuardian::sole();
        $this->assertSame('Daughter', $link->relationship);
        $ana = $link->dependent;
        $this->assertNull($ana->person->email);
        $record = $this->getJson("/api/patients/{$ana->public_id}")->assertOk();
        $this->assertTrue($record->json('data.minor'));
        $this->assertSame('Joanna Specimen', $record->json('data.guardians.0.name')); // staff see "Minor: guardian Joanna Specimen"
    }

    public function test_a_guardian_books_and_is_reminded_for_a_dependent_and_loses_access_after_the_dependent_claims_at_18(): void
    {
        $this->u['patientA']->forceFill(['email' => 'guardian@mailbox.ph', 'email_verified_at' => now()])->save();
        $this->p['A']->person->update(['date_of_birth' => '1985-01-01']);
        $this->actingAsUser('patientA');
        $this->postJson('/api/me/dependents', ['first_name' => 'Ana', 'last_name' => 'Kid', 'date_of_birth' => '2016-02-02', 'relationship' => 'Daughter'])->assertStatus(422); // consent
        $ana = $this->postJson('/api/me/dependents', ['first_name' => 'Ana', 'last_name' => 'Kid', 'date_of_birth' => '2016-02-02', 'relationship' => 'Daughter', 'consent' => true])
            ->assertCreated()->assertJsonPath('data.minor', true)->json('data.id');
        $id = $this->book(['for_patient_id' => $ana, 'date' => '2026-09-30', 'start_time' => '09:00'])->assertCreated()->json('data.id');
        Mail::assertSent(AppointmentConfirmationMail::class, fn ($m) => $m->hasTo('guardian@mailbox.ph'));
        $this->getJson("/api/appointments/$id")->assertOk();
        $this->actingAsUser('patientB');
        $this->getJson("/api/appointments/$id")->assertForbidden();
        $this->book(['for_patient_id' => $ana])->assertForbidden();

        // Years later Ana is an adult: the guardian invites her, she claims her account, and the guardian's access ends.
        $kai = $this->p['A'];
        $this->actingAsUser('patientA');
        $adult = $this->postJson('/api/me/dependents', ['first_name' => 'Kai', 'last_name' => 'Kid', 'date_of_birth' => '2008-01-01', 'relationship' => 'Son', 'consent' => true])->json('data.id');
        $this->postJson("/api/patients/$ana/claim-invite", ['email' => 'ana@mailbox.ph'])->assertStatus(422); // under 18
        $this->postJson("/api/patients/$adult/claim-invite", ['email' => 'kai@mailbox.ph'])->assertOk();
        $adultAppt = $this->book(['for_patient_id' => $adult, 'date' => '2026-10-01', 'start_time' => '10:00'])->assertCreated()->json('data.id');
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/account/claim', ['email' => 'kai@mailbox.ph', 'date_of_birth' => '2008-01-01', 'password' => 'Secret123', 'password_confirmation' => 'Secret123'])->assertCreated();
        $code = null;
        Mail::assertSent(OneTimeCodeMail::class, function (OneTimeCodeMail $m) use (&$code) { if ($m->hasTo('kai@mailbox.ph')) $code = $m->code; return (bool) $code; });
        $this->postJson('/api/register/verify', ['email' => 'kai@mailbox.ph', 'otp' => $code])->assertOk();
        $this->assertSame('ended', PatientGuardian::whereHas('dependent', fn ($q) => $q->where('public_id', $adult))->sole()->status);
        $this->assertTrue(AuditLog::where('action', 'patient.guardian_access_ended')->exists());
        $this->actingAsUser('patientA');
        $this->getJson("/api/appointments/$adultAppt")->assertForbidden();
        $this->getJson("/api/appointments/$id")->assertOk(); // still the guardian of the child
        $this->assertSame([$ana], array_column($this->getJson('/api/me/dependents')->json('data'), 'id'));
    }

    public function test_no_id_image_or_id_number_is_stored_anywhere_after_a_scan_and_register_run(): void
    {
        // What the browser sends after a scan: only the name parts and the birth date, plus which fields came from the ID.
        $this->submitForm($this->form())->assertCreated();
        // An ID number or image is refused even if a page sent it by mistake.
        $this->submitForm($this->form([], ['id_number' => self::FAKE_ID_NUMBER]), 'device-x')->assertStatus(422);
        $this->submitForm($this->form([], ['scan' => ['id_type' => 'philid', 'image' => 'data:image/png;base64,iVBORw0KGgo=', 'number' => self::FAKE_ID_NUMBER]]), 'device-y')->assertStatus(422);
        $this->actingAsUser('staffB1');
        $id = $this->getJson('/api/intake/submissions')->json('data.0.id');
        $this->postJson("/api/intake/submissions/$id/confirm", ['id_verified' => true, 'id_type' => 'philid', 'id_last4' => '5678'])->assertOk();

        $needles = [self::FAKE_ID_NUMBER, '777700001234', 'iVBORw0KGgo', 'data:image'];
        $tables = collect(DB::select("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"))->pluck('table_name');
        foreach ($tables as $table) {
            foreach ($needles as $needle) {
                $hits = DB::selectOne("select count(*) as n from \"$table\" t where t::text ilike ?", ['%'.$needle.'%'])->n;
                $this->assertSame(0, (int) $hits, "$table contains $needle");
            }
        }
        $log = @file_get_contents(storage_path('logs/laravel.log')) ?: '';
        foreach ($needles as $needle) $this->assertStringNotContainsString($needle, $log);
        $this->assertSame(0, MailDispatch::count()); // nothing about the ID went to the outbox
        $this->assertNull(Patient::whereHas('person', fn ($q) => $q->where('last_name', 'Specimen'))->sole()->id_last4);
    }

    public function test_the_mail_guard_never_sends_to_reserved_or_fake_domains(): void
    {
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.transport' => 'smtp']);
        foreach (['someone@example.test', 'a@example.com', 'b@clinic.test', 'c@host.invalid', 'd@localhost'] as $i => $email) {
            $this->u['patientA']->forceFill(['email' => $email])->save();
            $a = $this->existing('A', 'd1', 'b1', 'svc1', '2026-10-0'.($i + 1), '09:00');
            $d = app(MailOutbox::class)->queue('appointment_confirmation', "guard-$i", $a, 1, $this->u['patientA'], null);
            app(MailOutbox::class)->process($d->id); // the worker (already run synchronously in tests: then this claims nothing)
            $this->assertSame('suppressed', $d->fresh()->status, $email);
        }
        Mail::assertNothingSent();
        $this->assertSame(5, MailDispatch::where('status', 'suppressed')->count());
        $this->u['patientA']->forceFill(['email' => 'real.person@mailbox.ph'])->save();
        $a = Appointment::where('patient_id', $this->p['A']->id)->first();
        $d = app(MailOutbox::class)->queue('appointment_confirmation', 'guard-ok', $a, 1, $this->u['patientA'], null);
        app(MailOutbox::class)->process($d->id);
        $this->assertSame('transport_accepted', $d->fresh()->status);
    }

    public function test_the_calendar_counts_a_dentist_working_at_two_branches_once_per_day_and_says_capacity_is_estimated(): void
    {
        $this->d['d1']->branches()->attach($this->b['b2']->id);
        $this->actingAsUser('owner');
        $day = $this->getJson('/api/calendar/load?from=2026-09-29&to=2026-09-29')->assertOk();
        $this->assertSame(3 * 540, $day->json('data.days.0.capacity_minutes')); // d1, d2, d3 once each, not d1 twice
        $this->assertStringContainsString('estimated', $day->json('data.capacity_note'));
    }

    public function test_a_confirmed_walk_in_enters_the_chosen_or_shortest_dentist_queue_and_a_booking_today_is_checked_in_instead(): void
    {
        // d1 already has one patient waiting; "any available" for svc1 at b1 picks d2 (shortest queue).
        $busy = $this->existing('B', 'd1', 'b1', 'svc1', '2026-09-28', '10:30');
        $this->actingAsUser('staffB1');
        $this->postJson('/api/visits/check-in', ['appointment_id' => $busy->public_id, 'expected_revision' => 1], ['Idempotency-Key' => 'ci-busy'])->assertCreated();
        $this->app['auth']->forgetGuards();
        $this->submitForm($this->form())->assertCreated();
        $this->actingAsUser('staffB1');
        $id = $this->getJson('/api/intake/submissions')->json('data.0.id');
        $this->postJson("/api/intake/submissions/$id/confirm", ['service_ref' => 'svc1'])->assertOk();
        $walkIn = \App\Models\Visit::where('source', 'walk_in')->sole();
        $this->assertSame($this->d['d2']->id, $walkIn->responsible_dentist_profile_id);
        $this->assertNotNull(\App\Models\QueueEntry::where('visit_id', $walkIn->id)->first());

        // A patient with an account and a booking today joins with the code: staff confirm checks in THAT booking.
        $booking = $this->existing('A', 'd1', 'b1', 'svc1', '2026-09-28', '11:00');
        $this->actingAsUser('patientA');
        $this->postJson('/api/intake/join', ['branch_ref' => 'b1', 'code' => JoinCodes::current($this->b['b1'])->code])->assertCreated();
        $this->actingAsUser('staffB1');
        $row = collect($this->getJson('/api/intake/submissions')->json('data'))->firstWhere('channel', 'account');
        $this->postJson("/api/intake/submissions/{$row['id']}/confirm", ['id_verified' => true, 'id_type' => 'umid'])->assertOk();
        $this->assertSame('Checked In', $booking->fresh()->status);
        $this->assertSame($this->d['d1']->id, \App\Models\Visit::where('appointment_id', $booking->id)->sole()->responsible_dentist_profile_id);
    }

    public function test_an_earlier_unverified_claim_cannot_lock_out_the_real_owner(): void
    {
        $this->p['B']->person->update(['email' => 'owner.of.record@mailbox.ph', 'date_of_birth' => '1980-02-02']);
        $this->u['patientB']->forceDelete(); // a record registered at the counter: no account yet
        $claim = fn (string $password) => $this->postJson('/api/account/claim', ['email' => 'owner.of.record@mailbox.ph', 'date_of_birth' => '1980-02-02', 'password' => $password, 'password_confirmation' => $password])->assertCreated();
        $claim('Attacker123');
        $this->postJson('/api/login', ['email' => 'owner.of.record@mailbox.ph', 'password' => 'Attacker123'])->assertStatus(422); // unverified: no sign-in
        $this->travel(2)->minutes(); // past the resend cooldown
        $claim('RealOwner123');
        $code = null;
        Mail::assertSent(OneTimeCodeMail::class, function (OneTimeCodeMail $m) use (&$code) { if ($m->hasTo('owner.of.record@mailbox.ph')) $code = $m->code; return true; });
        $this->postJson('/api/register/verify', ['email' => 'owner.of.record@mailbox.ph', 'otp' => $code])->assertOk();
        $this->postJson('/api/login', ['email' => 'owner.of.record@mailbox.ph', 'password' => 'Attacker123'])->assertStatus(422);
        $this->postJson('/api/login', ['email' => 'owner.of.record@mailbox.ph', 'password' => 'RealOwner123'])->assertOk();
    }
}
