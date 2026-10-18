<?php

namespace App\Support;

use App\Models\Appointment;

/** A calendar file (iCalendar, RFC 5545) for one appointment: time, branch and links only, never clinical details. */
final class Ics
{
    public static function appointment(Appointment $appointment): string
    {
        $utc = fn (\DateTimeInterface $t) => \Carbon\CarbonImmutable::instance($t)->utc()->format('Ymd\THis\Z');
        $esc = fn (?string $v) => str_replace(["\\", ';', ',', "\r\n", "\n"], ["\\\\", '\;', '\,', '\n', '\n'], (string) $v);
        $branch = $appointment->branch;
        $host = parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'clinic.local';
        $lines = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//'.$esc(Brand::name()).'//Appointments//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            "UID:{$appointment->public_id}-r{$appointment->revision}@$host",
            'DTSTAMP:'.$utc(now()),
            'DTSTART:'.$utc($appointment->starts_at),
            'DTEND:'.$utc($appointment->ends_at ?? \Carbon\CarbonImmutable::instance($appointment->starts_at)->addMinutes((int) ($appointment->duration_minutes ?: 30))),
            'SUMMARY:'.$esc('Dental appointment - '.($branch?->name ?? Brand::name())),
            'LOCATION:'.$esc($branch?->address),
            'DESCRIPTION:'.$esc('Reference '.$appointment->appointment_code.'. Reschedule or cancel: '.Brand::appointmentUrl($appointment->public_id)),
            'END:VEVENT', 'END:VCALENDAR',
        ];
        return implode("\r\n", array_map([self::class, 'fold'], $lines))."\r\n";
    }

    /** Folds a line at 73 octets without splitting a UTF-8 character (continuation lines start with a space). */
    private static function fold(string $line): string
    {
        $out = '';
        $width = 0;
        foreach (mb_str_split($line) as $char) {
            if ($width + strlen($char) > 73) { $out .= "\r\n "; $width = 1; }
            $out .= $char;
            $width += strlen($char);
        }

        return $out;
    }
}
