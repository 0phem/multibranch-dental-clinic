<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * ROLLBACK ONLY for M17 encryption at rest: writes message text back to the plain `body` column so the schema migration can be rolled
 * back (`php artisan migrate:rollback` refuses while any message is encrypted). Restoring the pre-migration backup is the preferred
 * rollback. Requires --force. Resumable (only picks rows that are still encrypted).
 */
class DecryptMessageBodies extends Command
{
    protected $signature = 'messages:decrypt-bodies {--batch=200} {--force : Required — this stores message text unencrypted}';

    protected $description = 'Rollback only: decrypt message bodies back to plain text';

    public function handle(): int
    {
        if (! $this->option('force')) {
            $this->error('This writes message text back in plain form. Re-run with --force only to roll back the encryption migration.');

            return self::FAILURE;
        }
        $batch = max(1, min(5000, (int) $this->option('batch')));
        $done = 0;
        while (true) {
            $count = DB::transaction(function () use ($batch) {
                DB::statement("SET LOCAL app.m17_body_migration = 'on'");
                $rows = DB::table('conversation_messages')->whereNotNull('body_encrypted')->orderBy('id')->limit($batch)->lockForUpdate()->get(['id', 'body_encrypted']);
                foreach ($rows as $row) {
                    DB::table('conversation_messages')->where('id', $row->id)->update(['body' => Crypt::decryptString($row->body_encrypted), 'body_encrypted' => null]);
                }

                return $rows->count();
            });
            $done += $count;
            if ($count < $batch) break;
        }
        $this->info("Done: {$done} message(s) decrypted.");

        return self::SUCCESS;
    }
}
