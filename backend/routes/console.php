<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// M5 cutover pre-flight (decision Q-T8): exits non-zero while any Visit is In Treatment without a server Treatment.
Artisan::command('treatments:cutover-check', function () {
    $blockers = \App\Services\Treatments\TreatmentCutover::blockers();
    if ($blockers) {
        $this->error(\App\Services\Treatments\TreatmentCutover::describe($blockers));

        return 1;
    }
    $this->info('M5 Treatment cutover check passed: no Visit is In Treatment without a server Treatment.');

    return 0;
})->purpose('Verify no Visit is In Treatment without a server Treatment before the M5 cutover');
