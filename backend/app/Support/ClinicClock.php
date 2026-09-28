<?php

namespace App\Support;

use Carbon\CarbonImmutable;

// The one server-side clinic clock (CONTRACTS.md §2), mirroring src/clock.js: timestamps are stored in UTC, but
// clinic business dates ("today", a booking date) and wall-clock times (branch hours, Dentist shifts) are
// interpreted in Asia/Manila.
final class ClinicClock
{
    public const TIMEZONE = 'Asia/Manila';

    public static function now(): CarbonImmutable
    {
        return CarbonImmutable::now(self::TIMEZONE);
    }

    public static function today(): string
    {
        return self::now()->toDateString();
    }

    /** A clinic-local business date + HH:MM wall-clock time as an absolute instant. */
    public static function at(string $date, string $time): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('Y-m-d H:i', "{$date} {$time}", self::TIMEZONE)->startOfMinute();
    }

    public static function local(\DateTimeInterface $instant): CarbonImmutable
    {
        return CarbonImmutable::instance($instant)->setTimezone(self::TIMEZONE);
    }

    /** Calendar-month addition with end-of-month clamping (src/clock.js addCalendarMonths). */
    public static function addCalendarMonths(string $date, int $months): string
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', $date, self::TIMEZONE)->addMonthsNoOverflow($months)->toDateString();
    }

    public static function validDate(mixed $date): bool
    {
        if (! is_string($date) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }
        [$y, $m, $d] = array_map('intval', explode('-', $date));

        return checkdate($m, $d, $y);
    }

    public static function validTime(mixed $time): bool
    {
        return is_string($time) && (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time);
    }

    public static function minutes(string $time): int
    {
        [$h, $m] = array_map('intval', explode(':', substr($time, 0, 5)));

        return $h * 60 + $m;
    }

    public static function time(int $minutes): string
    {
        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }
}
