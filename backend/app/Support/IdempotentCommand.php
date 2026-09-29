<?php

namespace App\Support;

use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

// Runs a named command once per (account, Idempotency-Key) — CONTRACTS.md §2: a replay returns the original result
// instead of acting twice. Extracted unchanged from the M6 AppointmentService so M6 and M8 share one mechanism:
//   - the key row is written inside the command's own transaction, so a failed command stores nothing and can be
//     retried with the same key;
//   - a concurrent duplicate waits on the (user_id, idempotency_key) unique index, then replays the committed response;
//   - the same key with a different request is refused through $keyReused;
//   - a deadlocked transaction is re-run (Laravel's transaction attempts).
final class IdempotentCommand
{
    /**
     * @param  class-string<Model>  $keyModel  the key table model (AppointmentCommandKey, CommandKey)
     * @param  Closure(): array{0: array, 1: int, 2?: array}  $work  returns [response body, HTTP status, extra key-row columns]
     * @param  Closure(): Throwable  $keyReused  the refusal for a key reused with a different request
     * @param  (Closure(QueryException): void)|null  $onQueryError  may translate a database error into a domain refusal
     */
    public static function run(string $keyModel, User $actor, ?string $key, string $command, array $payload, Closure $work, Closure $keyReused, ?Closure $onQueryError = null, int $attempts = 3): JsonResponse
    {
        ksort($payload);
        $hash = hash('sha256', json_encode([$command, $payload]));
        if ($key !== null && ($replay = self::replay($keyModel, $actor, $key, $hash, $keyReused))) {
            return $replay;
        }

        try {
            [$body, $status] = DB::transaction(function () use ($keyModel, $actor, $key, $command, $hash, $work) {
                $record = $key === null ? null : $keyModel::create([
                    'user_id' => $actor->id, 'idempotency_key' => $key, 'command' => $command, 'request_hash' => $hash, 'created_at' => now(),
                ]);
                $result = $work();
                [$body, $status] = $result;
                $record?->update(($result[2] ?? []) + ['response_status' => $status, 'response_body' => $body]);

                return [$body, $status];
            }, $attempts);
        } catch (UniqueConstraintViolationException $e) {
            if ($key !== null && ($replay = self::replay($keyModel, $actor, $key, $hash, $keyReused))) {
                return $replay;
            }
            if ($onQueryError) {
                $onQueryError($e);
            }
            throw $e;
        } catch (QueryException $e) {
            if ($onQueryError) {
                $onQueryError($e);
            }
            throw $e;
        }

        return response()->json($body, $status);
    }

    private static function replay(string $keyModel, User $actor, string $key, string $hash, Closure $keyReused): ?JsonResponse
    {
        $existing = $keyModel::where('user_id', $actor->id)->where('idempotency_key', $key)->first();
        if (! $existing) {
            return null;
        }
        if (! hash_equals($existing->request_hash, $hash)) {
            throw $keyReused();
        }

        return response()->json($existing->response_body, $existing->response_status)->header('Idempotent-Replayed', 'true');
    }
}
