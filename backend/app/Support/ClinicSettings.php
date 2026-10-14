<?php

namespace App\Support;

use App\Models\ClinicSetting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * White-label settings edited by the Owner (decision 12). Read through App\Support\Brand, which falls back to config/clinic.php for
 * anything not set. Loaded once per request or queue job (a scoped binding) from the cache, so a running worker sees a change on
 * its next job. If the table does not exist yet (a database not migrated), every setting simply falls back to the defaults.
 */
class ClinicSettings
{
    public const KEYS = ['name', 'name_line', 'subtitle', 'sender_name', 'address', 'phone', 'email', 'design', 'primary', 'primary_dark', 'accent', 'accent_dark', 'logo'];

    private const CACHE_KEY = 'clinic-settings:v1';

    private ?array $values = null;

    public static function current(): self
    {
        return app(self::class);
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        if ($this->values === null) {
            try {
                $this->values = Cache::rememberForever(self::CACHE_KEY, fn () => ClinicSetting::query()->pluck('value', 'key')->all());
            } catch (\Throwable) {
                $this->values = []; // not migrated yet, or the database is unavailable: defaults apply
            }
        }

        return $this->values;
    }

    public function get(string $key): mixed
    {
        return $this->all()[$key] ?? null;
    }

    /** Saves the given settings (null or '' removes one, restoring its default) and returns the keys that changed. */
    public function put(array $values, ?User $actor): array
    {
        $changed = [];
        DB::transaction(function () use ($values, $actor, &$changed) {
            foreach (array_intersect_key($values, array_flip(self::KEYS)) as $key => $value) {
                $value = is_string($value) ? trim($value) : $value;
                $current = ClinicSetting::find($key);
                if ($value === null || $value === '') {
                    if ($current) { $current->delete(); $changed[] = $key; }
                    continue;
                }
                if ($current && $current->value === $value) continue;
                ClinicSetting::updateOrCreate(['key' => $key], ['value' => $value, 'updated_by_user_id' => $actor?->id, 'updated_at' => now()]);
                $changed[] = $key;
            }
        });
        $this->flush();

        return $changed;
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
        $this->values = null;
    }
}
