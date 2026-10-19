<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\DentistSchedule;
use Illuminate\Database\Seeder;

/**
 * M3 demo weekly schedules for the demo dentists, flagged `demo`: the UI labels them "demo schedule, not confirmed by the clinic"
 * (OPEN_ITEMS: the clinic still has to give each dentist's real hours). Built from each dentist's profile hours, with a lunch
 * break and inside the branch hours; a dentist at two branches works at each on different days. Skips a dentist who already has
 * a schedule, so it never overwrites real hours.
 */
class WorkScheduleDemoSeeder extends Seeder
{
    /** dentist => [branch => weekdays] */
    private const PLAN = [
        'd1' => ['b1' => [1, 2, 3, 4, 5, 6]],
        'd2' => ['b1' => [1, 3, 5, 6]],
        'd3' => ['b2' => [1, 2, 3, 4, 5, 6]],
        'd4' => ['b3' => [1, 2, 3, 4, 5]],
        'd5' => ['b2' => [1, 2, 3], 'b3' => [4, 5, 6]],
    ];

    public function run(): void
    {
        $rows = 0;
        foreach (self::PLAN as $ref => $byBranch) {
            $dentist = DentistProfile::where('legacy_ref', $ref)->first();
            if (! $dentist || DentistSchedule::where('dentist_profile_id', $dentist->id)->exists()) continue;
            foreach ($byBranch as $branchRef => $weekdays) {
                $branch = Branch::where('legacy_ref', $branchRef)->first();
                if (! $branch || ! $dentist->branches()->where('branches.id', $branch->id)->exists()) continue;
                foreach ($weekdays as $weekday) {
                    $hours = $branch->hoursOnDay($weekday);
                    if (! $hours) continue;
                    $start = max(substr((string) $dentist->shift_start, 0, 5), $hours['open']);
                    $end = min(substr((string) $dentist->shift_end, 0, 5), $hours['close']);
                    if ($start >= $end) continue;
                    // A one-hour lunch break in the middle of a day of six hours or more.
                    $minutes = fn (string $t) => (int) substr($t, 0, 2) * 60 + (int) substr($t, 3, 2);
                    $break = $minutes($end) - $minutes($start) >= 360 ? (int) (floor(($minutes($start) + $minutes($end)) / 120) * 60) : null;
                    DentistSchedule::create(['dentist_profile_id' => $dentist->id, 'branch_id' => $branch->id, 'weekday' => $weekday, 'start_time' => $start, 'end_time' => $end,
                        'break_start' => $break ? sprintf('%02d:00', $break / 60) : null, 'break_end' => $break ? sprintf('%02d:00', $break / 60 + 1) : null, 'demo' => true]);
                    $rows++;
                }
            }
        }
        $this->command?->info("Demo work schedules: $rows weekly rows (demo schedule, not confirmed by the clinic).");
    }
}
