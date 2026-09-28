<?php

namespace Tests\Feature\Appointments;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\BranchService;
use App\Models\DentistProfile;
use App\Models\Patient;
use App\Models\Person;
use App\Models\Service;
use App\Models\User;
use App\Models\UserBranchScope;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

// Shared M6 test world. The clinic clock is frozen at 2026-09-28 10:00 Asia/Manila, so the Patient window is
// 2026-09-29 (tomorrow) .. 2026-10-29 (one calendar month after tomorrow), inclusive.
//
//   b1 Branch A 09:00-18:00 Open: svc1 (30 min), svc2 (60 min)      d1 (svc1, svc2), d2 (svc1) — both 09:00-18:00
//   b2 Branch B 09:00-18:00 Open: svc1                               d3 (svc1)
//   Staff: staffB1 scoped to b1, staffB2 scoped to b2, staffBoth scoped to b1+b2, staffNone with no scope.
trait SchedulingFixture
{
    protected array $b = [];

    protected array $svc = [];

    protected array $d = [];

    protected array $u = [];

    protected array $p = [];

    protected function setUpSchedulingWorld(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-09-28 10:00:00', 'Asia/Manila'));

        $this->b['b1'] = $this->branch('b1');
        $this->b['b2'] = $this->branch('b2');
        $this->svc['svc1'] = $this->service('svc1', 30);
        $this->svc['svc2'] = $this->service('svc2', 60);
        $this->offer('b1', 'svc1');
        $this->offer('b1', 'svc2');
        $this->offer('b2', 'svc1');

        [$this->d['d1'], $this->u['dentist1']] = $this->dentist('d1', ['b1'], ['svc1', 'svc2']);
        [$this->d['d2'], $this->u['dentist2']] = $this->dentist('d2', ['b1'], ['svc1']);
        [$this->d['d3'], $this->u['dentist3']] = $this->dentist('d3', ['b2'], ['svc1']);

        [$this->u['patientA'], $this->p['A']] = $this->patient('PAT-0001');
        [$this->u['patientB'], $this->p['B']] = $this->patient('PAT-0002');
        $this->u['staffB1'] = $this->account(Role::Staff, 'b1');
        $this->u['staffB2'] = $this->account(Role::Staff, 'b2');
        $this->u['staffBoth'] = $this->account(Role::Staff, ['b1', 'b2']);
        $this->u['staffNone'] = $this->account(Role::Staff, null);
        $this->u['owner'] = $this->account(Role::Owner, null);
    }

    protected function actingAsUser(string $key): User
    {
        Sanctum::actingAs($this->u[$key]);

        return $this->u[$key];
    }

    protected function branch(string $ref): Branch
    {
        return Branch::create([
            'legacy_ref' => $ref, 'branch_code' => 'BRC-'.strtoupper($ref), 'name' => 'Branch '.strtoupper($ref),
            'city' => 'Bocaue', 'address' => '123 St', 'open_time' => '09:00', 'close_time' => '18:00',
            'status' => 'Open', 'capacity_threshold' => 80,
        ]);
    }

    protected function service(string $ref, int $minutes): Service
    {
        return Service::create([
            'legacy_ref' => $ref, 'code' => strtoupper($ref), 'name' => 'Service '.$ref, 'duration_minutes' => $minutes,
            'reference_fee_php' => 600, 'category' => 'General Dentistry', 'status' => 'Active',
        ]);
    }

    protected function offer(string $branch, string $service, ?int $override = null): BranchService
    {
        return BranchService::create([
            'branch_id' => $this->b[$branch]->id, 'service_id' => $this->svc[$service]->id, 'active' => true,
            'duration_override_minutes' => $override,
        ]);
    }

    /** A Dentist profile; with $login=false the Person has no User account at all (roster-only, like seeded d2-d5). */
    protected function dentist(string $ref, array $branches, array $services, bool $login = true): array
    {
        $user = $login ? $this->account(Role::Dentist, null) : null;
        $profile = DentistProfile::create([
            'legacy_ref' => $ref, 'person_id' => $user?->person_id ?? Person::factory()->create()->id,
            'shift_start' => '09:00', 'shift_end' => '18:00', 'available' => true,
        ]);
        $profile->branches()->attach(array_map(fn ($b) => $this->b[$b]->id, $branches));
        $profile->services()->attach(array_map(fn ($s) => $this->svc[$s]->id, $services), ['is_authorized' => true]);

        return [$profile, $user];
    }

    protected function patient(string $code): array
    {
        $user = $this->account(Role::Patient, null);
        $patient = Patient::create(['person_id' => $user->person_id, 'patient_code' => $code, 'consent' => true]);

        return [$user, $patient];
    }

    /** @param string|list<string>|null $scopes authorization branch scopes (user_branch_scopes) */
    protected function account(Role $role, string|array|null $scopes): User
    {
        $person = Person::factory()->create();
        $user = User::factory()->create(['person_id' => $person->id, 'role' => $role, 'password' => Hash::make('Passw0rd!')]);
        foreach ((array) $scopes as $scope) {
            UserBranchScope::create(['user_id' => $user->id, 'branch_id' => $this->b[$scope]->id]);
        }

        return $user->fresh();
    }

    /** Insert an appointment directly (bypassing the API) to arrange existing schedule state. */
    protected function existing(string $patient, string $dentist, string $branch, string $service, string $date, string $time, int $minutes = 30, string $status = 'Confirmed'): Appointment
    {
        $start = CarbonImmutable::parse("{$date} {$time}", 'Asia/Manila');

        return Appointment::create([
            'patient_id' => $this->p[$patient]->id, 'branch_id' => $this->b[$branch]->id, 'service_id' => $this->svc[$service]->id,
            'dentist_profile_id' => $this->d[$dentist]->id, 'starts_at' => $start, 'ends_at' => $start->addMinutes($minutes),
            'duration_minutes' => $minutes, 'status' => $status, 'source' => 'front_desk', 'assignment_method' => 'selected', 'revision' => 1,
        ]);
    }

    protected function book(array $overrides = [], array $headers = [])
    {
        return $this->withHeaders($headers)->postJson('/api/appointments', $overrides + [
            'branch_ref' => 'b1', 'service_ref' => 'svc1', 'date' => '2026-09-29', 'start_time' => '09:00',
        ]);
    }

    protected function staffBook(array $overrides = [], array $headers = [])
    {
        return $this->book($overrides + ['patient_id' => $this->p['A']->public_id], $headers);
    }
}
