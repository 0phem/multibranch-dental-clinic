<?php

namespace App\Services\Assistant;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Service;
use App\Services\Scheduling\SchedulingService;
use App\Services\Scheduling\SlotRequest;
use App\Support\Brand;
use App\Support\ClinicClock;
use Carbon\CarbonImmutable;

/**
 * Server-side tools the Clinic Assistant may call. Every tool is read-only. The two personal tools (`my_appointments`, `my_billing`)
 * take NO identifier: they always read the Patient bound to this instance (the signed-in account), so no input can reach another
 * Patient's records. `suggest_action` executes nothing: it only shows a button in the portal (booking, billing, front desk).
 * Prices are not offered: no service price is approved for display to Patients (M13 contract).
 */
final class AssistantTools
{
    /** @var list<array{type:string, service?:string, branch?:string, label:string}> */
    public array $actions = [];

    /** @var list<string> */
    public array $used = [];

    /** Money amounts and reference numbers that came from tool results this turn (the only ones an answer may contain). */
    public array $grounded = [];

    public function __construct(private readonly Patient $patient, private readonly SchedulingService $scheduling) {}

    /** @return list<array> tool definitions for the Messages API */
    public static function definitions(): array
    {
        $none = ['type' => 'object', 'properties' => new \stdClass()];

        return [
            ['name' => 'list_services', 'description' => 'The clinic\'s active services: name, category, short description and typical duration. Prices are not available.', 'input_schema' => $none],
            ['name' => 'list_branches', 'description' => 'The clinic\'s open branches: name, address, phone, email (or none on file), opening hours per day, plus the clinic\'s main contact.', 'input_schema' => $none],
            ['name' => 'search_clinic_answers', 'description' => 'The clinic\'s own written answers (about the clinic, HMO, payment, dental-care tips and more) that match a question. Use them word for word; if none match, offer the front desk.',
                'input_schema' => ['type' => 'object', 'properties' => ['question' => ['type' => 'string']], 'required' => ['question']]],
            ['name' => 'find_available_slots', 'description' => 'The earliest bookable appointment times for a service, optionally at one branch and from a date (YYYY-MM-DD). Read-only: it books nothing.',
                'input_schema' => ['type' => 'object', 'properties' => ['service' => ['type' => 'string', 'description' => 'Service name'], 'branch' => ['type' => 'string', 'description' => 'Branch name (optional)'],
                    'from_date' => ['type' => 'string', 'description' => 'YYYY-MM-DD (optional)']], 'required' => ['service']]],
            ['name' => 'my_appointments', 'description' => 'The signed-in patient\'s OWN upcoming and recent appointments. Takes no input.', 'input_schema' => $none],
            ['name' => 'my_billing', 'description' => 'The signed-in patient\'s OWN invoices and total balance due. Takes no input.', 'input_schema' => $none],
            ['name' => 'suggest_action', 'description' => 'Show the patient ONE button. It performs nothing by itself: the patient decides. Use open_booking (optionally with service and branch names), open_billing or contact_front_desk.',
                'input_schema' => ['type' => 'object', 'properties' => ['action' => ['type' => 'string', 'enum' => ['open_booking', 'open_billing', 'contact_front_desk']],
                    'service' => ['type' => 'string'], 'branch' => ['type' => 'string']], 'required' => ['action']]],
        ];
    }

    /** Runs one tool and returns a JSON-encodable result (an error message for unknown tools or bad input). */
    public function run(string $name, array $input): array
    {
        $this->used[] = $name;

        return match ($name) {
            'list_services' => $this->services(),
            'list_branches' => $this->branches(),
            'search_clinic_answers' => (new KnowledgeAssistant($this))->search(mb_substr((string) ($input['question'] ?? ''), 0, 300)),
            'find_available_slots' => $this->slots((string) ($input['service'] ?? ''), (string) ($input['branch'] ?? ''), (string) ($input['from_date'] ?? '')),
            'my_appointments' => $this->appointments(),
            'my_billing' => $this->billing(),
            'suggest_action' => $this->suggest((string) ($input['action'] ?? ''), (string) ($input['service'] ?? ''), (string) ($input['branch'] ?? '')),
            default => ['error' => 'Unknown tool.'],
        };
    }

    public function services(): array
    {
        return ['services' => Service::where('status', 'Active')->orderBy('category')->orderBy('name')->get()->map(fn (Service $s) => [
            'name' => $s->name, 'category' => $s->category, 'description' => $s->description, 'typical_minutes' => $s->duration_minutes,
        ])->values()->all(), 'note' => 'Prices are confirmed by the clinic.'];
    }

    public function branches(): array
    {
        return ['branches' => Branch::where('status', 'Open')->orderBy('name')->get()->map(fn (Branch $b) => [
            'name' => $b->name, 'address' => $b->address, 'city' => $b->city,
            // The clinic's real contacts (given 2026-10-17); a branch without an email has none on file.
            'phone' => $b->phone ?: null, 'email' => $b->email ?: 'none on file',
            'hours' => \App\Support\BranchHours::summary($b),
        ])->values()->all(), 'clinic_phone' => Brand::forEmail()['phone'], 'clinic_email' => Brand::forEmail()['email']];
    }

    public function slots(string $serviceName, string $branchName, string $fromDate): array
    {
        $service = $this->findService($serviceName);
        if (! $service) return ['error' => 'No active service matches that name. Call list_services for the names.'];
        $branches = $this->scheduling->branchesOffering($service);
        if ($branchName !== '') {
            $branch = $this->findBranch($branchName);
            if (! $branch) return ['error' => 'No open branch matches that name.'];
            $branches = $branches->where('id', $branch->id)->values();
        }
        [$first, $last] = $this->scheduling->patientWindow();
        $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromDate) && $fromDate > $first ? $fromDate : $first;
        $found = [];
        foreach ($branches as $branch) {
            $pool = $this->scheduling->eligibleDentists($branch, $service);
            if ($pool->isEmpty()) continue;
            $base = new SlotRequest($this->patient, $branch, $service, null, null, null, true);
            $busy = $this->scheduling->busyBetween(ClinicClock::at($from, '00:00'), ClinicClock::at($last, '00:00')->addDay(), $pool->pluck('id')->all(), $this->patient->id);
            for ($date = $from, $n = 0; $date <= $last && $n < 3; $date = CarbonImmutable::createFromFormat('!Y-m-d', $date, ClinicClock::TIMEZONE)->addDay()->toDateString()) {
                foreach ($this->scheduling->slotsOn($base, $date, $pool, $busy, null, 3 - $n) as $slot) {
                    $found[] = ['branch' => $branch->name, 'when' => ClinicClock::at($slot['date'], $slot['start_time'])->format('D, M j \a\t g:i A')];
                    $n++;
                }
            }
        }

        return ['service' => $service->name, 'earliest' => $found, 'note' => $found ? 'These are open now; booking happens only in the Book page.' : 'No open time in the online booking window.'];
    }

    public function appointments(): array
    {
        $rows = Appointment::where('patient_id', $this->patient->id)->with(['service', 'branch', 'dentist.person'])
            ->orderByDesc('starts_at')->limit(8)->get();

        return ['appointments' => $rows->map(fn (Appointment $a) => [
            'service' => $a->service?->name, 'branch' => $a->branch?->name, 'dentist' => $a->dentist?->person?->fullName(),
            'when' => ClinicClock::local($a->starts_at)->format('D, M j, Y \a\t g:i A'), 'status' => $a->status,
            'upcoming' => $a->starts_at > now() && in_array($a->status, ['Confirmed', 'Pending'], true),
        ])->values()->all()];
    }

    public function billing(): array
    {
        $rows = Invoice::where('patient_id', $this->patient->id)->whereIn('status', ['Issued', 'Paid'])->orderByDesc('id')->limit(10)->get();
        $due = $rows->where('status', 'Issued')->sum(fn (Invoice $i) => (float) $i->balance());
        $result = ['invoices' => $rows->map(fn (Invoice $i) => [
            'invoice_number' => $i->invoice_number, 'status' => $i->status === 'Issued' ? 'Payment due' : 'Paid',
            'total' => Brand::money($i->patient_responsibility_amount), 'balance_due' => Brand::money($i->balance()),
            'issued' => $i->issued_at ? ClinicClock::local($i->issued_at)->format('M j, Y') : null,
        ])->values()->all(), 'total_balance_due' => Brand::money($due), 'pay_online' => 'Billing page, Review and pay'];
        array_walk_recursive($result, function ($v) { if (is_string($v)) $this->ground($v); });

        return $result;
    }

    private function suggest(string $action, string $service, string $branch): array
    {
        if (! in_array($action, ['open_booking', 'open_billing', 'contact_front_desk'], true)) return ['error' => 'Unknown action.'];
        $button = ['type' => $action, 'label' => match ($action) { 'open_booking' => 'Book an appointment', 'open_billing' => 'Open Billing', default => 'Message the front desk' }];
        if ($action === 'open_booking') {
            if ($s = $this->findService($service)) { $button['service'] = $s->legacy_ref; $button['label'] = "Book {$s->name}"; }
            if ($b = $this->findBranch($branch)) $button['branch'] = $b->legacy_ref;
        }
        if (! collect($this->actions)->contains('type', $action)) $this->actions[] = $button;

        return ['shown' => true, 'note' => 'A button is shown; nothing was booked, paid or sent.'];
    }

    private function ground(string $text): void
    {
        preg_match_all('/₱\s?[\d,]+(?:\.\d{2})?|\bINV-\d{4}-\d+\b|\bRCT-\d{4}-\d+\b/u', $text, $m);
        foreach ($m[0] as $token) $this->grounded[] = preg_replace('/\s+/', '', $token);
    }

    private function findService(string $name): ?Service
    {
        $name = mb_strtolower(trim($name));
        if ($name === '') return null;
        $services = Service::where('status', 'Active')->get();

        return $services->first(fn (Service $s) => mb_strtolower($s->name) === $name)
            ?? $services->first(fn (Service $s) => str_contains(mb_strtolower($s->name), $name) || str_contains($name, mb_strtolower($s->name)))
            ?? $services->first(fn (Service $s) => $this->synonym($name) !== null && str_contains(mb_strtolower($s->name), $this->synonym($name)));
    }

    private function synonym(string $name): ?string
    {
        return match (true) {
            (bool) preg_match('/clean|prophy/', $name) => 'prophylaxis', (bool) preg_match('/fill|restor/', $name) => 'restoration',
            (bool) preg_match('/extract|pull/', $name) => 'extraction', (bool) preg_match('/check|consult/', $name) => 'consultation',
            (bool) preg_match('/whit/', $name) => 'whitening', (bool) preg_match('/brace|ortho/', $name) => 'orthodontic',
            default => null,
        };
    }

    private function findBranch(string $name): ?Branch
    {
        $name = mb_strtolower(trim($name));
        if ($name === '') return null;
        $branches = Branch::where('status', 'Open')->get();

        return $branches->first(fn (Branch $b) => mb_strtolower($b->name) === $name)
            ?? $branches->first(fn (Branch $b) => str_contains(mb_strtolower($b->name.' '.$b->city.' '.$b->address), $name));
    }

    /** Public helpers for the rule-based fallback (the same data, no model). */
    public function matchService(string $text): ?Service
    {
        foreach (Service::where('status', 'Active')->get() as $s) {
            if (str_contains(mb_strtolower($text), mb_strtolower($s->name))) return $s;
        }
        $syn = $this->synonym(mb_strtolower($text));

        return $syn ? Service::where('status', 'Active')->get()->first(fn (Service $s) => str_contains(mb_strtolower($s->name), $syn)) : null;
    }
}
