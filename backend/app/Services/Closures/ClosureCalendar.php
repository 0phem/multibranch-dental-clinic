<?php

namespace App\Services\Closures;

use App\Models\BranchClosure;

/**
 * F5: the active closed dates, read once per request, job or command (a scoped instance) and consulted by Branch::hoursOnDate —
 * the one place every booking rule, calendar, reminder and email reads branch hours from. A branch's own closure wins over an
 * all-branches closure on the same date. Suggested (unconfirmed) holidays are ignored.
 */
final class ClosureCalendar
{
    /** @var array<string, array<int, BranchClosure>>|null date => [branch_id or 0 => closure] */
    private ?array $byDate = null;

    public function forDate(int $branchId, string $date): ?BranchClosure
    {
        $this->byDate ??= $this->load();
        $day = $this->byDate[$date] ?? [];

        return $day[$branchId] ?? $day[0] ?? null;
    }

    public function flush(): void
    {
        $this->byDate = null;
    }

    private function load(): array
    {
        $out = [];
        foreach (BranchClosure::where('status', 'active')->where('closed_on', '>=', now()->subYear()->toDateString())->get() as $c) $out[$c->dateString()][$c->branch_id ?? 0] = $c;

        return $out;
    }
}
