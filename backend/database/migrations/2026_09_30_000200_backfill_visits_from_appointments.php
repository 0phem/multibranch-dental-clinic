<?php

use App\Services\Visits\VisitBackfill;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

// Data migration (decision D6): create Visits for appointments that were already checked in through the retired M6
// lifecycle commands, using only authoritative server data. See App\Services\Visits\VisitBackfill for the exact rules.
// Rows whose required facts are missing are skipped and reported (log + console), never guessed.
return new class extends Migration
{
    public function up(): void
    {
        $report = app(VisitBackfill::class)->run();
        if (! $report['created'] && ! $report['anomalies']) {
            return;
        }
        $summary = "Visit backfill: {$report['created']} created, ".count($report['anomalies']).' anomalies.';
        fwrite(STDERR, $summary.PHP_EOL);
        foreach ($report['anomalies'] as $row) {
            fwrite(STDERR, "  {$row['code']} ({$row['appointment']}, {$row['status']}): {$row['reason']}".PHP_EOL);
        }
        if ($report['anomalies']) {
            Log::warning($summary, ['anomalies' => $report['anomalies']]);
        }
    }

    public function down(): void
    {
        app(VisitBackfill::class)->rollback();
    }
};
