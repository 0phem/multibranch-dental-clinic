<?php

use App\Services\Queue\QueueBackfill;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

// Data migration (decision Q9): queue entries for Visits that arrived before M9, from server Visit data only. See
// App\Services\Queue\QueueBackfill. Anomalies are skipped and reported (log + console), never guessed.
return new class extends Migration
{
    public function up(): void
    {
        $report = app(QueueBackfill::class)->run();
        if (! $report['created'] && ! $report['anomalies']) {
            return;
        }
        $summary = "Queue backfill: {$report['created']} created, ".count($report['anomalies']).' anomalies.';
        fwrite(STDERR, $summary.PHP_EOL);
        foreach ($report['anomalies'] as $row) {
            fwrite(STDERR, "  Visit {$row['visit']} ({$row['status']}): {$row['reason']}".PHP_EOL);
        }
        if ($report['anomalies']) {
            Log::warning($summary, ['anomalies' => $report['anomalies']]);
        }
    }

    public function down(): void
    {
        app(QueueBackfill::class)->rollback();
    }
};
