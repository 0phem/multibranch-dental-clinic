<?php

namespace App\Console\Commands;

use App\Services\Appointments\AppointmentService;
use Illuminate\Console\Command;

class ReleaseExpiredAppointmentHolds extends Command
{
    protected $signature = 'appointments:release-expired-holds';

    protected $description = 'Releases pending appointments whose 15-minute checkout hold has expired (Section 22.3)';

    public function handle(AppointmentService $appointments): int
    {
        $released = $appointments->releaseExpiredHolds();
        $this->info("Released {$released} expired appointment hold(s).");

        return self::SUCCESS;
    }
}
