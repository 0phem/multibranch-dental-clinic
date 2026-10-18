<?php

namespace App\Services\Closures;

use Carbon\CarbonImmutable;

/**
 * F5 suggestions only: the fixed-rule Philippine national holidays (regular holidays and the usual special non-working days) for
 * the coming twelve months. They are NOT closures: each one waits for the Owner to confirm it. Some dates are set each year by
 * proclamation (and Eid holidays, Chinese New Year and EDSA day are not listed), so the Owner checks the official list.
 */
final class PhilippineHolidays
{
    /** @return list<array{date:string, name:string}> */
    public static function upcoming(CarbonImmutable $from, int $days = 365): array
    {
        $out = [];
        foreach ([$from->year, $from->year + 1] as $year) {
            foreach (self::forYear($year) as $date => $name) {
                if ($date >= $from->toDateString() && $date <= $from->addDays($days)->toDateString()) $out[] = ['date' => $date, 'name' => $name];
            }
        }
        usort($out, fn ($a, $b) => strcmp($a['date'], $b['date']));

        return $out;
    }

    /** @return array<string, string> date => name */
    public static function forYear(int $year): array
    {
        $easter = self::easter($year);
        $lastMondayOfAugust = CarbonImmutable::create($year, 8, 31)->startOfDay();
        while (! $lastMondayOfAugust->isMonday()) $lastMondayOfAugust = $lastMondayOfAugust->subDay();
        $list = [
            "$year-01-01" => 'New Year’s Day',
            $easter->subDays(3)->toDateString() => 'Maundy Thursday',
            $easter->subDays(2)->toDateString() => 'Good Friday',
            $easter->subDay()->toDateString() => 'Black Saturday',
            "$year-04-09" => 'Araw ng Kagitingan',
            "$year-05-01" => 'Labor Day',
            "$year-06-12" => 'Independence Day',
            "$year-08-21" => 'Ninoy Aquino Day',
            $lastMondayOfAugust->toDateString() => 'National Heroes Day',
            "$year-11-01" => 'All Saints’ Day',
            "$year-11-30" => 'Bonifacio Day',
            "$year-12-08" => 'Feast of the Immaculate Conception',
            "$year-12-25" => 'Christmas Day',
            "$year-12-30" => 'Rizal Day',
            "$year-12-31" => 'Last day of the year',
        ];
        ksort($list);

        return $list;
    }

    /** Western (Gregorian) Easter Sunday — the anonymous Gregorian algorithm. */
    private static function easter(int $y): CarbonImmutable
    {
        $a = $y % 19; $b = intdiv($y, 100); $c = $y % 100; $d = intdiv($b, 4); $e = $b % 4; $f = intdiv($b + 8, 25); $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30; $i = intdiv($c, 4); $k = $c % 4; $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7; $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31); $day = (($h + $l - 7 * $m + 114) % 31) + 1;

        return CarbonImmutable::create($y, $month, $day)->startOfDay();
    }
}
