<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * M17 encryption at rest (Phase 2 decision 5) — converts message text written before encryption, and re-encrypts for key rotation.
 *
 *   php artisan messages:encrypt-bodies --dry-run      count what would change, change nothing
 *   php artisan messages:encrypt-bodies                plain `body` -> `body_encrypted`, in batches (resumable: it only ever picks rows
 *                                                      that are still plain, so stopping and re-running continues where it left off)
 *   php artisan messages:encrypt-bodies --rotate       after moving the old APP_KEY to APP_PREVIOUS_KEYS: re-encrypt every encrypted row
 *                                                      with the current key; resume with --from-id=<last id printed>
 *
 * Each batch is one transaction that sets `app.m17_body_migration = 'on'`, the only condition under which the message trigger allows a
 * body change (and only of the two body columns). Every row is decrypted again and compared before it is written. The same pass removes
 * message text from stored idempotency responses (command_keys), which must not hold plain text either.
 */
class EncryptMessageBodies extends Command
{
    protected $signature = 'messages:encrypt-bodies {--batch=200 : Rows per transaction} {--dry-run : Report only} {--rotate : Re-encrypt already encrypted rows with the current APP_KEY} {--from-id=0 : With --rotate, start after this message id}';

    protected $description = 'Encrypt plain-text message bodies at rest (resumable), or re-encrypt them after an APP_KEY rotation';

    public function handle(): int
    {
        $batch = max(1, min(5000, (int) $this->option('batch')));
        $this->line('Database: '.DB::connection()->getDatabaseName());
        if ($this->option('dry-run')) {
            $plain = DB::table('conversation_messages')->whereNull('body_encrypted')->count();
            $encrypted = DB::table('conversation_messages')->whereNotNull('body_encrypted')->count();
            $keys = $this->keyRowsWithText()->count();
            $this->line("Dry run: {$plain} plain message(s) to encrypt, {$encrypted} already encrypted, {$keys} idempotency record(s) holding message text. Nothing changed.");

            return self::SUCCESS;
        }

        return $this->option('rotate') ? $this->rotate($batch) : $this->encrypt($batch);
    }

    private function encrypt(int $batch): int
    {
        $done = 0;
        while (true) {
            $count = DB::transaction(function () use ($batch) {
                DB::statement("SET LOCAL app.m17_body_migration = 'on'");
                $rows = DB::table('conversation_messages')->whereNull('body_encrypted')->orderBy('id')->limit($batch)->lockForUpdate()->get(['id', 'body']);
                foreach ($rows as $row) {
                    $cipher = Crypt::encryptString($row->body);
                    if (Crypt::decryptString($cipher) !== $row->body) throw new \RuntimeException("Verification failed for message {$row->id}; nothing in this batch was written.");
                    DB::table('conversation_messages')->where('id', $row->id)->whereNull('body_encrypted')->update(['body' => null, 'body_encrypted' => $cipher]);
                }

                return $rows->count();
            });
            $done += $count;
            if ($count > 0) $this->line("Encrypted {$done} message(s) so far…");
            if ($count < $batch) break;
        }
        $scrubbed = $this->scrubKeyRows();
        $left = DB::table('conversation_messages')->whereNull('body_encrypted')->count();
        $this->info("Done: {$done} message(s) encrypted, {$scrubbed} idempotency record(s) cleaned, {$left} plain message(s) left.");

        return $left === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function rotate(int $batch): int
    {
        $last = max(0, (int) $this->option('from-id'));
        $done = 0;
        while (true) {
            $rows = DB::transaction(function () use ($batch, $last) {
                DB::statement("SET LOCAL app.m17_body_migration = 'on'");
                $rows = DB::table('conversation_messages')->whereNotNull('body_encrypted')->where('id', '>', $last)->orderBy('id')->limit($batch)->lockForUpdate()->get(['id', 'body_encrypted']);
                foreach ($rows as $row) {
                    $plain = Crypt::decryptString($row->body_encrypted); // current key or any APP_PREVIOUS_KEYS
                    $cipher = Crypt::encryptString($plain);              // always the current key
                    if (Crypt::decryptString($cipher) !== $plain) throw new \RuntimeException("Verification failed for message {$row->id}.");
                    DB::table('conversation_messages')->where('id', $row->id)->update(['body_encrypted' => $cipher]);
                }

                return $rows;
            });
            if ($rows->isEmpty()) break;
            $done += $rows->count();
            $last = $rows->last()->id;
            $this->line("Re-encrypted {$done} message(s); last id {$last} (resume with --from-id={$last}).");
        }
        $this->info("Done: {$done} message(s) re-encrypted with the current key.");

        return self::SUCCESS;
    }

    private function keyRowsWithText()
    {
        return DB::table('command_keys')->whereIn('command', ['conversation.send', 'conversation.start'])
            // jsonb_exists() rather than the `?` operator, which PDO would read as a bound parameter.
            ->where(fn ($q) => $q->whereRaw("jsonb_exists(response_body::jsonb -> 'data', 'body')")->orWhereRaw("jsonb_exists(response_body::jsonb -> 'data' -> 'message', 'body')"));
    }

    private function scrubKeyRows(): int
    {
        return $this->keyRowsWithText()->update(['response_body' => DB::raw("((response_body::jsonb #- '{data,body}') #- '{data,message,body}')::json")]);
    }
}
