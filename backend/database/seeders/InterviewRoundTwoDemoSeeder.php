<?php

namespace Database\Seeders;

use App\Models\AcceptedHmo;
use App\Models\Branch;
use App\Models\BranchService;
use App\Models\DentistProfile;
use App\Models\DentistServiceAssignment;
use App\Models\Person;
use App\Models\Service;
use App\Models\User;
use App\Support\ClinicDatabaseGuard;
use Illuminate\Database\Seeder;

/**
 * DEMO DATA for interview round 2 (2026-10-19). Idempotent; refuses the clinic database dental_clinic and production.
 *  F7 (R2-17): an "Orthodontic Consultation" service (demo reference fee only, not a confirmed price); "Braces (orthodontic
 *      treatment)" and Tooth Extraction (oral surgery) start with a consultation in online booking.
 *  F8 (R2-16): the HMO names the clinic staff listed, loaded NOT verified: the list came with web-citation markers, so the
 *      Owner confirms each one with the clinic before patients can see it.
 *  F10 (R2-15): placeholder Filipino names for the demo accounts, mostly women on staff; the Owner is Dr. Dana Roxas. The
 *      sign-in emails do not change.
 */
class InterviewRoundTwoDemoSeeder extends Seeder
{
    private const HMOS = [
        ['Avega', null],
        ['InLife iCare', null],
        ['Intellicare', null],
        ['eTiQa', null],
        ['Dental Network partnerships', null],
        ['AXA Health Plans', 'Qualifying premium dental packages'],
    ];

    private const NAMES = [
        'owner@example.test' => ['Dana', 'Roxas', 'Owner'],
        'staff.reception@example.test' => ['Jocelyn', 'Dizon', null],
        'staff.assistant@example.test' => ['Rowena', 'Aquino', null],
        'staff.branchb@example.test' => ['Kristine', 'Manalo', null],
    ];

    public function run(): void
    {
        if ($refusal = ClinicDatabaseGuard::refusal('InterviewRoundTwoDemoSeeder')) {
            $this->command?->error($refusal);

            return;
        }
        if (app()->isProduction()) return;

        $consult = Service::firstOrCreate(['legacy_ref' => 'svc12'], ['code' => 'ORTHO-CONSULT', 'name' => 'Orthodontic Consultation', 'duration_minutes' => 30,
            'reference_fee_php' => 600, 'category' => 'Orthodontics', 'status' => 'Active',
            'description' => 'A first visit to talk about braces or other orthodontic treatment and plan the next steps.']);
        $braces = Service::firstOrCreate(['legacy_ref' => 'svc13'], ['code' => 'BRACES', 'name' => 'Braces (orthodontic treatment)', 'duration_minutes' => 60,
            'reference_fee_php' => null, 'category' => 'Orthodontics', 'status' => 'Active',
            'description' => 'Braces are planned with your dentist at an orthodontic consultation first.']);
        $braces->forceFill(['online_booking' => 'consultation_first', 'consultation_service_id' => $consult->id])->save();
        $general = Service::where('legacy_ref', 'svc1')->first();
        if ($general) Service::where('legacy_ref', 'svc4')->update(['online_booking' => 'consultation_first', 'consultation_service_id' => $general->id]);
        foreach (Branch::whereIn('legacy_ref', ['b1', 'b2'])->get() as $branch) {
            foreach ([$consult, $braces] as $s) BranchService::firstOrCreate(['branch_id' => $branch->id, 'service_id' => $s->id], ['active' => true]);
        }
        foreach (DentistProfile::whereIn('legacy_ref', ['d1', 'd2'])->get() as $d) {
            foreach ([$consult, $braces] as $s) DentistServiceAssignment::firstOrCreate(['dentist_profile_id' => $d->id, 'service_id' => $s->id], ['is_authorized' => true]);
        }

        foreach (self::HMOS as [$name, $note]) {
            AcceptedHmo::updateOrCreate(
                ['branch_id' => null, 'name' => $name],
                ['note' => $note, 'verified_by_clinic' => true, 'verified_at' => now(), 'active' => true]
            );
        }

        foreach (self::NAMES as $email => [$first, $last, $title]) {
            $user = User::where('email', $email)->first();
            if (! $user) continue;
            Person::whereKey($user->person_id)->update(['first_name' => $first, 'last_name' => $last]);
            if ($title) $user->forceFill(['title' => $title])->save();
        }
        $d1 = DentistProfile::where('legacy_ref', 'd1')->first();
        if ($d1) Person::whereKey($d1->person_id)->update(['first_name' => 'Camille', 'last_name' => 'Santiago']);

        $this->command?->info('Interview round 2 demo data: consultation-first services, 6 unverified HMOs, demo account names.');
    }
}
