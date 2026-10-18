<?php

namespace App\Support;

use App\Models\Branch;

/** Branch opening hours in plain words, grouped by days with the same hours (from Branch::weekHours, never hard-coded). */
final class BranchHours
{
    public const DAYS = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday'];

    /** "Monday to Friday 8:00 AM to 8:00 PM; Saturday 8:00 AM to 5:00 PM; Sunday closed" */
    public static function summary(Branch $branch): string
    {
        $groups = [];
        foreach ($branch->weekHours() as $day => $hours) {
            $label = $hours ? self::time($hours['open']).' to '.self::time($hours['close']) : 'closed';
            $last = array_key_last($groups);
            if ($last !== null && $groups[$last]['label'] === $label && $groups[$last]['to'] === $day - 1) $groups[$last]['to'] = $day;
            else $groups[] = ['from' => $day, 'to' => $day, 'label' => $label];
        }

        return implode('; ', array_map(fn ($g) => ($g['from'] === $g['to'] ? self::DAYS[$g['from']] : self::DAYS[$g['from']].($g['to'] === $g['from'] + 1 ? ' and ' : ' to ').self::DAYS[$g['to']]).' '.$g['label'], $groups));
    }

    /** "8:00 AM" from "08:00". */
    public static function time(string $hhmm): string
    {
        [$h, $m] = array_map('intval', explode(':', substr($hhmm, 0, 5)));

        return (($h + 11) % 12 + 1).':'.str_pad((string) $m, 2, '0', STR_PAD_LEFT).' '.($h >= 12 ? 'PM' : 'AM');
    }
}
